#!/usr/bin/env bash
# Helper to read and update the "Split and Go Case" GitHub Project board.
#
# Usage:
#   scripts/board/board.sh info
#   scripts/board/board.sh list
#   scripts/board/board.sh get-status <issue-number>
#   scripts/board/board.sh set-status <issue-number> <status>
#   scripts/board/board.sh add <issue-number>
#
# Valid statuses: "Backlog", "In Progress", "In Review/Testing", "Done".
#
# Requires: gh CLI authenticated with the `project` scope
#   (gh auth refresh -s project).
#
# Overrides (optional env vars): BOARD_PROJECT_TITLE, BOARD_OWNER, BOARD_REPO.

set -euo pipefail

PROJECT_TITLE="${BOARD_PROJECT_TITLE:-Split and Go Case}"
VALID_STATUSES=("Backlog" "In Progress" "In Review/Testing" "Done")

die() {
  echo "error: $*" >&2
  exit 1
}

require_gh() {
  command -v gh >/dev/null 2>&1 || die "gh CLI not found"
}

resolve_context() {
  OWNER="${BOARD_OWNER:-$(gh repo view --json owner --jq .owner.login)}"
  REPO="${BOARD_REPO:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"

  PROJECT_NUMBER="$(gh project list --owner "$OWNER" --limit 100 --format json \
    --jq ".projects[] | select(.title == \"$PROJECT_TITLE\") | .number" | head -n 1)"
  [[ -n "$PROJECT_NUMBER" ]] || die "project \"$PROJECT_TITLE\" not found for owner $OWNER"

  PROJECT_ID="$(gh project view "$PROJECT_NUMBER" --owner "$OWNER" --format json --jq .id)"
  STATUS_FIELD_ID="$(gh project field-list "$PROJECT_NUMBER" --owner "$OWNER" --format json \
    --jq '.fields[] | select(.name == "Status") | .id')"
  [[ -n "$STATUS_FIELD_ID" ]] || die "Status field not found in project"
}

validate_issue_number() {
  [[ "${1:-}" =~ ^[0-9]+$ ]] || die "issue number must be numeric (got: '${1:-}')"
}

validate_status() {
  local status="$1" valid
  for valid in "${VALID_STATUSES[@]}"; do
    [[ "$status" == "$valid" ]] && return 0
  done
  die "invalid status '$status' (valid: $(printf '"%s" ' "${VALID_STATUSES[@]}"))"
}

status_option_id() {
  local status="$1"
  gh project field-list "$PROJECT_NUMBER" --owner "$OWNER" --format json \
    --jq ".fields[] | select(.name == \"Status\") | .options[] | select(.name == \"$status\") | .id"
}

item_id_for_issue() {
  local issue="$1"
  gh project item-list "$PROJECT_NUMBER" --owner "$OWNER" --limit 500 --format json \
    --jq ".items[] | select(.content.number == $issue and .content.repository == \"$REPO\") | .id" |
    head -n 1
}

cmd_info() {
  echo "owner:   $OWNER"
  echo "repo:    $REPO"
  echo "project: $PROJECT_TITLE (#$PROJECT_NUMBER, id $PROJECT_ID)"
}

cmd_list() {
  gh project item-list "$PROJECT_NUMBER" --owner "$OWNER" --limit 500 --format json \
    --jq '.items[] | [(.content.number | tostring), (.status // "No status"), .content.title] | @tsv' |
    sort -n
}

cmd_get_status() {
  validate_issue_number "${1:-}"
  gh project item-list "$PROJECT_NUMBER" --owner "$OWNER" --limit 500 --format json \
    --jq ".items[] | select(.content.number == $1 and .content.repository == \"$REPO\") | (.status // \"No status\")"
}

cmd_set_status() {
  validate_issue_number "${1:-}"
  [[ -n "${2:-}" ]] || die "usage: board.sh set-status <issue-number> <status>"
  validate_status "$2"

  local item_id option_id
  item_id="$(item_id_for_issue "$1")"
  [[ -n "$item_id" ]] || die "issue #$1 is not on the board (run: board.sh add $1)"
  option_id="$(status_option_id "$2")"
  [[ -n "$option_id" ]] || die "status option '$2' not found on the board (run scripts/board/setup-board.sh)"

  gh project item-edit --id "$item_id" --project-id "$PROJECT_ID" \
    --field-id "$STATUS_FIELD_ID" --single-select-option-id "$option_id" >/dev/null
  echo "#$1 -> $2"
}

cmd_add() {
  validate_issue_number "${1:-}"
  local url
  url="$(gh issue view "$1" --repo "$REPO" --json url --jq .url)"
  if [[ -z "$(item_id_for_issue "$1")" ]]; then
    gh project item-add "$PROJECT_NUMBER" --owner "$OWNER" --url "$url" >/dev/null
  fi
  cmd_set_status "$1" "Backlog"
}

main() {
  require_gh
  local command="${1:-}"
  [[ -n "$command" ]] || die "usage: board.sh <info|list|get-status|set-status|add> [args]"
  shift
  resolve_context

  case "$command" in
    info) cmd_info ;;
    list) cmd_list ;;
    get-status) cmd_get_status "$@" ;;
    set-status) cmd_set_status "$@" ;;
    add) cmd_add "$@" ;;
    *) die "unknown command '$command'" ;;
  esac
}

main "$@"
