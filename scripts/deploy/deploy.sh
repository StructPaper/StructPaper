#!/bin/bash
# ==============================================================================
# StructPaper deployment script (staging AND production).
#
# Usage:
#   ./deploy.sh [<commit-sha>]
#
# Examples:
#   ./deploy.sh 1a2b3c4d   # pin every image to :1a2b3c4d (what CI does)
#   ./deploy.sh            # re-apply the current release (.env.release, else .env tags)
#
# Required in <env dir>/.env when a commit SHA is passed:
#   REGISTRY_IMAGE=registry.example.com:443/group/project   (must match the `docker login` host)
# Recommended:
#   DEPLOY_ENV=staging|production   (production makes pre-deploy.sh mandatory)
#
# Release files:
#   .env.release        the release that is CURRENTLY live and verified (last good)
#   .env.release.next   the candidate being deployed; promoted only after all checks pass
#
# What it does:
#   1. Takes an exclusive lock (no two deploys at once)
#   2. Validates the SHA and writes the candidate .env.release.next
#   3. Runs pre-deploy.sh (DB backup; mandatory for production)
#   4. docker compose pull + up -d (db-init migrates first, then api/worker/web)
#   5. Verifies api, web and worker
#   6. Success: promotes the candidate to .env.release and records .last-good-tag
#      Failure: restarts the previous .env.release and re-checks its health
#
# Exit codes: 0 success, 1 failure (rolled back when possible), 2 invalid usage/config.
# ==============================================================================
set -euo pipefail

readonly APP_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
readonly ENV_NAME="$(basename "$APP_DIR")"
readonly LOG_FILE="$APP_DIR/deploy.log"
readonly LOCK_FILE="$APP_DIR/.deploy.lock"
readonly LAST_GOOD_TAG_FILE="$APP_DIR/.last-good-tag"
readonly RELEASE_ENV_FILE="$APP_DIR/.env.release"
readonly CANDIDATE_ENV_FILE="$APP_DIR/.env.release.next"
# Only commit SHAs are deployable: named tags (latest, buildcache, src-*) are rejected so a
# leaked CI key cannot point production at an arbitrary or non-runnable image.
readonly TAG_PATTERN='^[0-9a-f]{7,40}$'
readonly HEALTH_ATTEMPTS="${HEALTH_ATTEMPTS:-60}"
readonly HEALTH_INTERVAL_SECONDS="${HEALTH_INTERVAL_SECONDS:-3}"
readonly WORKER_STABILIZE_SECONDS="${WORKER_STABILIZE_SECONDS:-15}"

log() {
  printf '[%s] [%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$ENV_NAME" "$*" | tee -a "$LOG_FILE"
}

# Reads KEY from the compose .env file without sourcing it (values may contain shell chars).
read_env_value() {
  local key="$1" default_value="$2" value
  value="$(grep -E "^${key}=" "$APP_DIR/.env" 2>/dev/null | tail -n1 | cut -d= -f2- || true)"
  value="${value%\"}"; value="${value#\"}"
  printf '%s' "${value:-$default_value}"
}

# Explicit DEPLOY_ENV wins; the folder-name heuristic is only a fallback for older setups.
resolve_deploy_env() {
  local configured
  configured="$(read_env_value DEPLOY_ENV "")"
  if [ -n "$configured" ]; then
    printf '%s' "$configured"
  elif [[ "$ENV_NAME" =~ (^|[-_])(prod|production)$ ]]; then
    printf 'production'
  else
    printf 'staging'
  fi
}

write_candidate_env() {
  local tag="$1" registry_base
  registry_base="$(read_env_value REGISTRY_IMAGE "")"
  if [ -z "$registry_base" ]; then
    # Without it compose would silently keep the image refs from .env and deploy the wrong version.
    log "ERROR: REGISTRY_IMAGE is not set in $APP_DIR/.env; cannot pin images to $tag"
    exit 2
  fi
  cat <<EOF > "$CANDIDATE_ENV_FILE"
IMAGE_TAG=$tag
API_IMAGE=$registry_base/api:$tag
WORKER_IMAGE=$registry_base/worker:$tag
WEB_IMAGE=$registry_base/web:$tag
DB_INIT_IMAGE=$registry_base/db-init:$tag
EOF
}

# Prints compose --env-file arguments (one per line) for the given release file, if it exists.
compose_env_args_for() {
  local release_file="$1"
  printf '%s\n' --env-file "$APP_DIR/.env"
  if [ -n "$release_file" ] && [ -f "$release_file" ]; then
    printf '%s\n' --env-file "$release_file"
  fi
}

compose() {
  docker compose "${COMPOSE_ENV_ARGS[@]}" "$@"
}

wait_for_http() {
  local name="$1" url="$2" attempt
  for attempt in $(seq 1 "$HEALTH_ATTEMPTS"); do
    if curl -sf --max-time 5 -o /dev/null "$url"; then
      log "Health check PASSED for $name ($url) on attempt $attempt"
      return 0
    fi
    log "Attempt $attempt/$HEALTH_ATTEMPTS: $name not ready ($url)"
    sleep "$HEALTH_INTERVAL_SECONDS"
  done
  return 1
}

worker_restart_count() {
  local container_id
  container_id="$(compose ps -q worker 2>/dev/null || true)"
  [ -n "$container_id" ] || { printf 'missing'; return; }
  docker inspect --format '{{.State.Status}}:{{.RestartCount}}' "$container_id" 2>/dev/null || printf 'missing'
}

# A single status snapshot misses crash loops; require "running" and no restarts over a window.
verify_worker() {
  local before after
  before="$(worker_restart_count)"
  sleep "$WORKER_STABILIZE_SECONDS"
  after="$(worker_restart_count)"
  log "Worker state before/after ${WORKER_STABILIZE_SECONDS}s: $before -> $after"
  [[ "$after" == running:* ]] && [ "$before" = "$after" ]
}

verify_services() {
  wait_for_http "api" "http://127.0.0.1:${API_PORT}/health" || return 1
  wait_for_http "web" "http://127.0.0.1:${WEB_PORT}/" || return 1
  verify_worker || { log "Worker exited or is crash-looping"; return 1; }
}

dump_diagnostics() {
  compose ps 2>&1 | tee -a "$LOG_FILE" || true
  compose logs --tail 80 api web worker db-init 2>&1 | tee -a "$LOG_FILE" || true
}

# Restarts the previously verified release. Schema changes made by db-init are NOT reverted:
# migrations must stay backward compatible (expand/contract) for this to be safe.
rollback_deployment() {
  local reason="$1"
  log "CRITICAL FAILURE: $reason"
  dump_diagnostics
  if [ -z "$DEPLOY_TAG" ] || [ ! -f "$RELEASE_ENV_FILE" ]; then
    log "No previous verified release ($RELEASE_ENV_FILE); automatic rollback skipped."
    exit 1
  fi
  log "Rolling back to previous release: $(cat "$LAST_GOOD_TAG_FILE" 2>/dev/null || echo unknown)"
  mapfile -t COMPOSE_ENV_ARGS < <(compose_env_args_for "$RELEASE_ENV_FILE")
  if compose up -d --remove-orphans 2>&1 | tee -a "$LOG_FILE" && verify_services; then
    log "Rollback succeeded; previous release is serving again."
  else
    log "ROLLBACK FAILED: manual intervention required."
    dump_diagnostics
  fi
  exit 1
}

cleanup_candidate() {
  rm -f "$CANDIDATE_ENV_FILE"
}

main() {
  cd "$APP_DIR"

  # Serialize deployments: a second run waits up to 10 minutes instead of racing the first one.
  exec 9>"$LOCK_FILE"
  if ! flock -w 600 9; then
    echo "ERROR: another deployment is still running for $ENV_NAME" >&2
    exit 1
  fi

  DEPLOY_TAG="${1:-}"
  local release_file="$RELEASE_ENV_FILE"
  if [ -n "$DEPLOY_TAG" ]; then
    if ! [[ "$DEPLOY_TAG" =~ $TAG_PATTERN ]]; then
      echo "ERROR: invalid deployment tag '$DEPLOY_TAG' (expected a commit SHA)" >&2
      exit 2
    fi
    # The candidate never replaces the live release file until it is verified.
    trap cleanup_candidate EXIT
    write_candidate_env "$DEPLOY_TAG"
    release_file="$CANDIDATE_ENV_FILE"
  fi
  mapfile -t COMPOSE_ENV_ARGS < <(compose_env_args_for "$release_file")

  readonly DEPLOY_ENV="$(resolve_deploy_env)"
  readonly API_PORT="$(read_env_value API_PORT 3001)"
  readonly WEB_PORT="$(read_env_value WEB_PORT 3000)"

  log "===== Starting deployment (env: $DEPLOY_ENV, tag: ${DEPLOY_TAG:-current}) ====="

  if [ "$DEPLOY_ENV" = "production" ] && [ ! -x "$APP_DIR/pre-deploy.sh" ]; then
    log "ERROR: production requires an executable $APP_DIR/pre-deploy.sh (database backup)."
    exit 2
  fi
  if [ -x "$APP_DIR/pre-deploy.sh" ]; then
    log "[0/4] Running pre-deploy hook"
    "$APP_DIR/pre-deploy.sh" 2>&1 | tee -a "$LOG_FILE"
  fi

  # A pull failure exits here (set -e) with the running containers and live release untouched.
  log "[1/4] Pulling images"
  compose pull 2>&1 | tee -a "$LOG_FILE"

  log "[2/4] Applying changes (db-init -> api/worker -> web)"
  compose up -d --remove-orphans 2>&1 | tee -a "$LOG_FILE" \
    || rollback_deployment "docker compose up failed during container startup or migration"

  log "[3/4] Verifying services"
  verify_services || rollback_deployment "post-deploy verification failed"

  if [ -n "$DEPLOY_TAG" ]; then
    mv -f "$CANDIDATE_ENV_FILE" "$RELEASE_ENV_FILE"
    printf '%s\n' "$DEPLOY_TAG" > "$LAST_GOOD_TAG_FILE"
    log "Promoted release $DEPLOY_TAG to $RELEASE_ENV_FILE"
  fi

  log "[4/4] Pruning dangling images"
  docker image prune -f 2>&1 | tee -a "$LOG_FILE"

  log "===== Deployment finished successfully ====="
}

main "$@"
