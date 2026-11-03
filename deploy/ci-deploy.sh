#!/usr/bin/env bash
# Entry point for the CD pipeline. The CI key in authorized_keys is pinned to this script
# (`restrict,command=...`), so the only thing a leaked key can do is deploy a commit SHA.
# The SHA arrives in SSH_ORIGINAL_COMMAND.
set -euo pipefail

SHA="${SSH_ORIGINAL_COMMAND:-}"
if [[ ! "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
    echo "refusing to deploy: expected a 40-character commit SHA" >&2
    exit 2
fi

cd "$(dirname "$0")/.."
exec flock --timeout 900 /tmp/splitandgo-deploy.lock deploy/deploy.sh "$SHA"
