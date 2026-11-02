#!/usr/bin/env bash
# One-time setup of the "Split and Go Case" GitHub Project board:
#   1. links the project to the repository
#   2. makes the project public
#   3. sets the Status column options to: Backlog, In Progress, In Review/Testing, Done
#
# Run this BEFORE adding items: replacing the Status options regenerates their ids.
#
# Requires: gh CLI authenticated with the `project` scope (gh auth refresh -s project).

set -euo pipefail

PROJECT_TITLE="${BOARD_PROJECT_TITLE:-Split and Go Case}"

die() {
  echo "error: $*" >&2
  exit 1
}

command -v gh >/dev/null 2>&1 || die "gh CLI not found"

OWNER="${BOARD_OWNER:-$(gh repo view --json owner --jq .owner.login)}"
REPO="${BOARD_REPO:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"

PROJECT_NUMBER="$(gh project list --owner "$OWNER" --limit 100 --format json \
  --jq ".projects[] | select(.title == \"$PROJECT_TITLE\") | .number" | head -n 1)"
[[ -n "$PROJECT_NUMBER" ]] || die "project \"$PROJECT_TITLE\" not found for owner $OWNER"

echo "Project #$PROJECT_NUMBER found for $OWNER."

echo "Linking project to $REPO..."
gh project link "$PROJECT_NUMBER" --owner "$OWNER" --repo "$REPO" >/dev/null 2>&1 ||
  echo "  (already linked or link not needed)"

echo "Setting visibility to PUBLIC..."
gh project edit "$PROJECT_NUMBER" --owner "$OWNER" --visibility PUBLIC >/dev/null

STATUS_FIELD_ID="$(gh project field-list "$PROJECT_NUMBER" --owner "$OWNER" --format json \
  --jq '.fields[] | select(.name == "Status") | .id')"
[[ -n "$STATUS_FIELD_ID" ]] || die "Status field not found"

echo "Configuring Status options..."
payload="$(mktemp)"
trap 'rm -f "$payload"' EXIT

cat >"$payload" <<JSON
{
  "query": "mutation(\$fieldId: ID!, \$options: [ProjectV2SingleSelectFieldOptionInput!]!) { updateProjectV2Field(input: { fieldId: \$fieldId, singleSelectOptions: \$options }) { projectV2Field { ... on ProjectV2SingleSelectField { options { id name } } } } }",
  "variables": {
    "fieldId": "$STATUS_FIELD_ID",
    "options": [
      { "name": "Backlog", "color": "GRAY", "description": "Planned work, not started" },
      { "name": "In Progress", "color": "YELLOW", "description": "Being developed" },
      { "name": "In Review/Testing", "color": "BLUE", "description": "Pull request open, under review" },
      { "name": "Done", "color": "GREEN", "description": "Reviewed, merged and verified" }
    ]
  }
}
JSON

gh api graphql --input "$payload" --jq '.data.updateProjectV2Field.projectV2Field.options[].name'

"$(dirname "${BASH_SOURCE[0]}")/board.sh" clear-cache >/dev/null 2>&1 || true

echo "Board ready: $(gh project view "$PROJECT_NUMBER" --owner "$OWNER" --format json --jq .url)"
