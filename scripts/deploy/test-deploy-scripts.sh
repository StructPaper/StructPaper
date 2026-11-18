#!/bin/bash
# ==============================================================================
# Tests for scripts/deploy/validate-and-deploy.sh and scripts/deploy/deploy.sh.
#
# Runs fully offline: docker, curl and sudo are replaced by stubs on PATH, so no daemon,
# registry or VM is needed. Requires bash >= 4 and flock (util-linux or busybox).
#
# Usage:  bash scripts/deploy/test-deploy-scripts.sh
# Exit:   0 when every test passes, 1 otherwise.
# ==============================================================================
set -uo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly WORK_ROOT="$(mktemp -d)"
trap 'rm -rf "$WORK_ROOT"' EXIT

passed=0
failed=0

pass() { passed=$((passed + 1)); echo "  PASS  $1"; }
fail() { failed=$((failed + 1)); echo "  FAIL  $1"; }
assert() { local name="$1"; shift; if "$@"; then pass "$name"; else fail "$name"; fi; }

# ------------------------------------------------------------------------------
# Stubs
# ------------------------------------------------------------------------------
readonly STUB_BIN="$WORK_ROOT/bin"
mkdir -p "$STUB_BIN"

# sudo: records its argv instead of switching user.
cat > "$STUB_BIN/sudo" <<'EOF'
#!/bin/bash
printf '%s\n' "$*" > "$STUB_STATE/sudo_args"
EOF

# docker: records compose calls; the env file of the last `up` marks the "active" release.
cat > "$STUB_BIN/docker" <<'EOF'
#!/bin/bash
echo "docker $*" >> "$STUB_STATE/docker_calls"
if [ "$1" = "compose" ]; then
  shift
  last_env_file=""
  while [ "$1" = "--env-file" ]; do last_env_file="$2"; shift 2; done
  case "$1" in
    pull) [ "${FAIL_PULL:-0}" = 1 ] && exit 1; exit 0 ;;
    up)   printf '%s\n' "$last_env_file" > "$STUB_STATE/active_release"; exit 0 ;;
    ps)   echo "worker-container-id"; exit 0 ;;
    *)    exit 0 ;;
  esac
fi
[ "$1" = "inspect" ] && { echo "running:0"; exit 0; }
exit 0
EOF

# curl: unhealthy while the candidate release is active and FAIL_NEW_HEALTH=1.
cat > "$STUB_BIN/curl" <<'EOF'
#!/bin/bash
active="$(cat "$STUB_STATE/active_release" 2>/dev/null || true)"
if [ "${FAIL_NEW_HEALTH:-0}" = 1 ] && [[ "$active" == *.env.release.next ]]; then exit 22; fi
exit 0
EOF
chmod +x "$STUB_BIN"/*

# flock is absent on some dev machines (e.g. Git Bash); locking itself is not under test here.
if ! command -v flock >/dev/null 2>&1; then
  printf '#!/bin/bash\nexit 0\n' > "$STUB_BIN/flock"
  chmod +x "$STUB_BIN/flock"
fi

export PATH="$STUB_BIN:$PATH"
export HEALTH_ATTEMPTS=1 HEALTH_INTERVAL_SECONDS=0 WORKER_STABILIZE_SECONDS=0

# Creates a fresh environment directory and sets the globals env_dir and STUB_STATE.
# Must not be called in a subshell, otherwise the exported STUB_STATE never reaches the stubs.
new_env_dir() {
  local name="$1"
  env_dir="$WORK_ROOT/envs/$name"
  export STUB_STATE="$WORK_ROOT/state/$name"
  mkdir -p "$env_dir" "$STUB_STATE"
  cp "$SCRIPT_DIR/deploy.sh" "$env_dir/deploy.sh"
  chmod +x "$env_dir/deploy.sh"
  printf 'REGISTRY_IMAGE=registry.example.com:443/group/app\nAPI_PORT=3101\nWEB_PORT=3100\n' > "$env_dir/.env"
}

# ------------------------------------------------------------------------------
# validate-and-deploy.sh
# ------------------------------------------------------------------------------
echo "validate-and-deploy.sh"
readonly WRAPPER="$SCRIPT_DIR/validate-and-deploy.sh"
export STUB_STATE="$WORK_ROOT/state/wrapper"
mkdir -p "$STUB_STATE"

run_wrapper() {
  rm -f "$STUB_STATE/sudo_args"
  SSH_ORIGINAL_COMMAND="$1" bash "$WRAPPER" "${@:2}" >/dev/null 2>&1
}
sudo_args() { cat "$STUB_STATE/sudo_args" 2>/dev/null || true; }

run_wrapper "deploy 1a2b3c4d" /srv/app-staging dev
assert "valid SHA is forwarded to sudo" [ "$(sudo_args)" = "-n -u dev /srv/app-staging/deploy.sh 1a2b3c4d" ]

run_wrapper "deploy" /srv/app-staging/ dev
assert "bare deploy re-applies release, trailing slash normalised" \
  [ "$(sudo_args)" = "-n -u dev /srv/app-staging/deploy.sh" ]

run_wrapper 'deploy 1a2b3c4d; rm -rf /' /srv/app-staging dev
assert "command injection is rejected" [ $? -ne 0 -a -z "$(sudo_args)" ]

run_wrapper "deploy latest" /srv/app-staging dev
assert "named tags are rejected" [ $? -ne 0 -a -z "$(sudo_args)" ]

run_wrapper "deploy 1a2b3c4d" /srv/../etc dev
assert "path traversal in env dir is rejected" [ $? -ne 0 -a -z "$(sudo_args)" ]

DEPLOY_RUN_AS=root run_wrapper "deploy 1a2b3c4d" /srv/app-staging
assert "run-as user cannot be injected via environment" \
  [ "$(sudo_args)" = "-n -u dev /srv/app-staging/deploy.sh 1a2b3c4d" ]

run_wrapper "deploy 1a2b3c4d" /srv/app-staging 'root;id'
assert "malformed run-as user is rejected" [ $? -ne 0 -a -z "$(sudo_args)" ]

# ------------------------------------------------------------------------------
# deploy.sh
# ------------------------------------------------------------------------------
echo "deploy.sh"

new_env_dir success
"$env_dir/deploy.sh" abcdef12 >/dev/null 2>&1
assert "successful deploy exits 0" [ $? -eq 0 ]
assert "release is pinned to the SHA" grep -q '^API_IMAGE=registry.example.com:443/group/app/api:abcdef12$' "$env_dir/.env.release"
assert "last good tag is recorded" [ "$(cat "$env_dir/.last-good-tag")" = "abcdef12" ]
assert "candidate file is cleaned up" [ ! -e "$env_dir/.env.release.next" ]

new_env_dir no-registry
printf 'API_PORT=3101\n' > "$env_dir/.env"
"$env_dir/deploy.sh" abcdef12 >/dev/null 2>&1
assert "missing REGISTRY_IMAGE fails with exit 2" [ $? -eq 2 ]
assert "missing REGISTRY_IMAGE never runs compose" [ ! -e "$STUB_STATE/docker_calls" ]

new_env_dir bad-tag
"$env_dir/deploy.sh" 'latest' >/dev/null 2>&1
assert "non-SHA tag fails with exit 2" [ $? -eq 2 ]

new_env_dir pull-failure
printf 'IMAGE_TAG=00000001\n' > "$env_dir/.env.release"
FAIL_PULL=1 "$env_dir/deploy.sh" abcdef12 >/dev/null 2>&1
assert "pull failure exits non-zero" [ $? -ne 0 ]
assert "pull failure keeps the live release file" [ "$(cat "$env_dir/.env.release")" = "IMAGE_TAG=00000001" ]
assert "pull failure removes the candidate" [ ! -e "$env_dir/.env.release.next" ]

new_env_dir rollback
printf 'IMAGE_TAG=00000001\n' > "$env_dir/.env.release"
printf '00000001\n' > "$env_dir/.last-good-tag"
FAIL_NEW_HEALTH=1 "$env_dir/deploy.sh" abcdef12 >/dev/null 2>&1
assert "failed health check exits 1" [ $? -eq 1 ]
assert "rollback restarts the previous release" [ "$(cat "$STUB_STATE/active_release")" = "$env_dir/.env.release" ]
assert "rollback keeps the previous release file" [ "$(cat "$env_dir/.env.release")" = "IMAGE_TAG=00000001" ]
assert "rollback keeps the previous last good tag" [ "$(cat "$env_dir/.last-good-tag")" = "00000001" ]
assert "rollback is verified and logged" grep -q 'Rollback succeeded' "$env_dir/deploy.log"

new_env_dir production
echo 'DEPLOY_ENV=production' >> "$env_dir/.env"
"$env_dir/deploy.sh" abcdef12 >/dev/null 2>&1
assert "production without pre-deploy.sh fails with exit 2" [ $? -eq 2 ]

new_env_dir app-cheban-prod
printf '#!/bin/bash\necho backup-ok\n' > "$env_dir/pre-deploy.sh"
chmod +x "$env_dir/pre-deploy.sh"
"$env_dir/deploy.sh" abcdef12 >/dev/null 2>&1
assert "production (folder fallback) runs pre-deploy.sh" grep -q 'backup-ok' "$env_dir/deploy.log"

echo
echo "Result: $passed passed, $failed failed"
[ "$failed" -eq 0 ]
