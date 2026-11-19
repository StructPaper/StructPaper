#!/bin/bash
# ==============================================================================
# SSH forced-command wrapper for StructPaper deployments.
#
# Install on the VM as root-owned (the deploy user must not be able to modify it):
#   sudo install -o root -g root -m 0755 validate-and-deploy.sh /usr/local/bin/validate-and-deploy.sh
#
# ~deploy/.ssh/authorized_keys, one line per environment key:
#   restrict,command="/usr/local/bin/validate-and-deploy.sh /home/dev/infra/app-cheban-staging dev" ssh-ed25519 AAAA... gitlab-ci-cheban-staging
#   restrict,command="/usr/local/bin/validate-and-deploy.sh /home/dev/infra/app-cheban-prod dev" ssh-ed25519 AAAA... gitlab-ci-cheban-prod
#
# Input:  $1 = environment directory (fixed per key in authorized_keys)
#         $2 = user that owns the environment and runs docker (optional, default: dev)
#         $SSH_ORIGINAL_COMMAND = "deploy <commit-sha>" (or bare "deploy" to re-apply the current release)
# Output: execs `sudo -n -u $DEPLOY_RUN_AS <env dir>/deploy.sh [sha]`
# Exit:   1 on any rejected input. Never evaluates the client command as shell code.
#
# Existence checks are intentionally NOT done here: this runs as the unprivileged `deploy`
# user, which (correctly) cannot traverse the 0750 environment directory. sudoers is the gate.
# ==============================================================================
set -euo pipefail

# Run-as user comes from authorized_keys ($2), never from the environment: SSH clients can
# inject environment variables when sshd AcceptEnv/PermitUserEnvironment is loosened.
readonly DEPLOY_RUN_AS="${2:-dev}"
readonly ENV_DIR_PATTERN='^/[A-Za-z0-9._/-]+$'
readonly USER_PATTERN='^[a-z_][a-z0-9_-]{0,31}$'
readonly COMMAND_PATTERN='^deploy([[:space:]]+([0-9a-f]{7,40}))?$'

reject() {
  echo "REJECTED: $1" >&2
  echo "Allowed format: 'deploy' or 'deploy <commit-sha>'" >&2
  exit 1
}

target_env_dir="${1:-}"
if ! [[ "$target_env_dir" =~ $ENV_DIR_PATTERN ]] || [[ "$target_env_dir" == *..* ]]; then
  echo "ERROR: invalid deployment directory configuration in authorized_keys" >&2
  exit 1
fi
if ! [[ "$DEPLOY_RUN_AS" =~ $USER_PATTERN ]]; then
  echo "ERROR: invalid run-as user configuration in authorized_keys" >&2
  exit 1
fi
# Must match the sudoers entry character for character, so normalise a trailing slash.
deploy_script="${target_env_dir%/}/deploy.sh"

original_command="${SSH_ORIGINAL_COMMAND:-}"
[[ "$original_command" =~ $COMMAND_PATTERN ]] || reject "malformed command: '$original_command'"
tag="${BASH_REMATCH[2]:-}"

if [ -n "$tag" ]; then
  echo "Deploying commit $tag via $deploy_script"
  exec sudo -n -u "$DEPLOY_RUN_AS" "$deploy_script" "$tag"
fi
echo "Re-applying current release via $deploy_script"
exec sudo -n -u "$DEPLOY_RUN_AS" "$deploy_script"
