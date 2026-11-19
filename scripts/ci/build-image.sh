#!/bin/sh
# Builds (or reuses) one Docker image identified by its source hash.
#
# Usage: build-image.sh <verify|push>
#
# Required environment (set by .gitlab-ci.yml):
#   SERVICE, DOCKERFILE, HASH_VAR (name of the variable holding the source hash, from plan.env),
#   CI_REGISTRY_IMAGE, CI_COMMIT_SHORT_SHA, CI_COMMIT_SHA, CI_PROJECT_URL
# Optional: FORCE_REBUILD=true  rebuild even if an image for this source hash already exists.
#
# Behaviour:
#   * If <image>:src-<hash> already exists in the registry the sources are identical, so nothing
#     is built. In `push` mode the existing image just gets the immutable :<commit-sha> tag that
#     the deploy job expects (registry-side retag, no layers transferred).
#   * Otherwise the image is built. `push` mode pushes :<commit-sha> and :src-<hash>;
#     `verify` mode (merge requests) only proves that it builds and pushes nothing.
# Any failure exits non-zero. A failed existence check is treated as "missing" and falls back to
# building, which is always safe.
set -eu

mode="${1:?usage: build-image.sh <verify|push>}"
: "${SERVICE:?}" "${DOCKERFILE:?}" "${HASH_VAR:?}"
: "${CI_REGISTRY_IMAGE:?}" "${CI_COMMIT_SHORT_SHA:?}" "${CI_COMMIT_SHA:?}"

case "$mode" in verify | push) ;; *) echo "ERROR: unknown mode '$mode'" >&2; exit 2 ;; esac

source_hash="$(printenv "$HASH_VAR" || true)"
if [ -z "$source_hash" ]; then
  echo "ERROR: $HASH_VAR is empty. Did the 'plan' job artifact (plan.env) reach this job?" >&2
  exit 1
fi

image="$CI_REGISTRY_IMAGE/$SERVICE"
source_tag="src-$source_hash"

if [ "${FORCE_REBUILD:-false}" != "true" ] \
  && docker buildx imagetools inspect "$image:$source_tag" >/dev/null 2>&1; then
  echo "[$SERVICE] sources unchanged ($source_tag already in registry) - skipping build."
  if [ "$mode" = "push" ]; then
    docker buildx imagetools create --tag "$image:$CI_COMMIT_SHORT_SHA" "$image:$source_tag"
  fi
  exit 0
fi

echo "[$SERVICE] building $source_tag (mode: $mode)"
docker buildx create --name ci-builder --driver docker-container --use >/dev/null
docker buildx inspect --bootstrap >/dev/null

if [ "$mode" = "verify" ]; then
  docker buildx build \
    --file "$DOCKERFILE" \
    --cache-from "type=registry,ref=$image:buildcache" \
    --output type=cacheonly \
    .
else
  # ignore-error=true: a cache-export problem must never fail an otherwise good build.
  docker buildx build \
    --file "$DOCKERFILE" \
    --provenance=false \
    --tag "$image:$CI_COMMIT_SHORT_SHA" \
    --tag "$image:$source_tag" \
    --label "org.opencontainers.image.revision=$CI_COMMIT_SHA" \
    --label "org.opencontainers.image.source=${CI_PROJECT_URL:-}" \
    --label "org.opencontainers.image.created=${CI_JOB_STARTED_AT:-}" \
    --cache-from "type=registry,ref=$image:buildcache" \
    --cache-to "type=registry,ref=$image:buildcache,mode=max,oci-mediatypes=true,image-manifest=true,ignore-error=true" \
    --push \
    .
fi
