#!/usr/bin/env bash
# Helper to read and update the "Split and Go Case" GitHub Project board.
#
# Usage:
#   scripts/board/board.sh info
#   scripts/board/board.sh list
#   scripts/board/board.sh get-status <issue-number>
#   scripts/board/board.sh set-status <issue-number> <status>
#   scripts/board/board.sh add <issue-number>
#   scripts/board/board.sh clear-cache
#
# Valid statuses: "Backlog", "In Progress", "In Review/Testing", "Done".
#
# Requires: gh CLI authenticated with the `project` scope
#   (gh auth refresh -s project).
#
# API usage: project, field, option and item ids are cached in a local file
# (default: <git-dir>/board-cache.env, never versioned), so a status change costs a
# single GraphQL call once the cache is warm. If a cached id turns out to be stale
# (for example after setup-board.sh recreated the Status options), the cache is
# discarded and the operation is retried once.
#
# Overrides (optional env vars): BOARD_PROJECT_TITLE, BOARD_OWNER, BOARD_REPO,
# BOARD_CACHE_FILE.

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

# ---------------------------------------------------------------------------
# Cache (KEY=VALUE lines, parsed with grep/sed and never sourced)
# ---------------------------------------------------------------------------

cache_file() {
  if [[ -n "${BOARD_CACHE_FILE:-}" ]]; then
    printf '%s' "$BOARD_CACHE_FILE"
  elif git_dir="$(git rev-parse --git-common-dir 2>/dev/null)"; then
    printf '%s/board-cache.env' "$git_dir"
  else
    printf '%s/split-and-go-board-cache.env' "${XDG_CACHE_HOME:-$HOME/.cache}"
  fi
}

cache_get() {
  local file
  file="$(cache_file)"
  [[ -f "$file" ]] || return 0
  sed -n "s/^$1=//p" "$file" | head -n 1
}

cache_set() {
  local file tmp
  file="$(cache_file)"
  mkdir -p "$(dirname "$file")"
  tmp="$(mktemp "${file}.XXXXXX")"
  { [[ -f "$file" ]] && grep -v "^$1=" "$file" || true; } >"$tmp"
  printf '%s=%s\n' "$1" "$2" >>"$tmp"
  mv "$tmp" "$file"
}

cache_clear() {
  rm -f "$(cache_file)"
}

status_key() {
  case "$1" in
    "Backlog") echo "OPTION_BACKLOG" ;;
    "In Progress") echo "OPTION_IN_PROGRESS" ;;
    "In Review/Testing") echo "OPTION_IN_REVIEW" ;;
    "Done") echo "OPTION_DONE" ;;
    *) die "invalid status '$1'" ;;
  esac
}

# ---------------------------------------------------------------------------
# Context resolution (cached)
# ---------------------------------------------------------------------------

repo_from_git_remote() {
  local url
  url="$(git remote get-url origin 2>/dev/null)" || return 1
  url="${url%.git}"
  url="${url#git@github.com:}"
  url="${url#https://github.com/}"
  [[ "$url" == */* ]] || return 1
  printf '%s' "$url"
}

refresh_context() {
  echo "board: resolving project ids (cache miss)" >&2
  cache_clear

  local repo owner project_number project_id field_id="" kind name id status
  repo="${BOARD_REPO:-$(repo_from_git_remote || gh repo view --json nameWithOwner --jq .nameWithOwner)}"
  owner="${BOARD_OWNER:-${repo%%/*}}"

  project_number="$(gh project list --owner "$owner" --limit 100 --format json \
    --jq ".projects[] | select(.title == \"$PROJECT_TITLE\") | .number" | head -n 1)"
  [[ -n "$project_number" ]] || die "project \"$PROJECT_TITLE\" not found for owner $owner"

  project_id="$(gh project view "$project_number" --owner "$owner" --format json --jq .id)"

  cache_set REPO "$repo"
  cache_set OWNER "$owner"
  cache_set PROJECT_NUMBER "$project_number"
  cache_set PROJECT_ID "$project_id"

  # One call returns the Status field id and all of its options as tab-separated lines.
  while IFS=$'\t' read -r kind name id; do
    case "$kind" in
      FIELD) field_id="$name" ;;
      OPTION)
        for status in "${VALID_STATUSES[@]}"; do
          [[ "$name" == "$status" ]] && cache_set "$(status_key "$status")" "$id"
        done
        ;;
    esac
  done < <(gh project field-list "$project_number" --owner "$owner" --format json \
    --jq '.fields[] | select(.name == "Status") | ("FIELD\t" + .id), (.options[] | "OPTION\t" + .name + "\t" + .id)')

  [[ -n "$field_id" ]] || die "Status field not found in project"
  cache_set STATUS_FIELD_ID "$field_id"

  for status in "${VALID_STATUSES[@]}"; do
    [[ -n "$(cache_get "$(status_key "$status")")" ]] ||
      die "status option '$status' not found on the board (run scripts/board/setup-board.sh)"
  done
}

load_context() {
  REPO="$(cache_get REPO)"
  OWNER="$(cache_get OWNER)"
  PROJECT_NUMBER="$(cache_get PROJECT_NUMBER)"
  PROJECT_ID="$(cache_get PROJECT_ID)"
  STATUS_FIELD_ID="$(cache_get STATUS_FIELD_ID)"
  if [[ -z "$REPO" || -z "$OWNER" || -z "$PROJECT_NUMBER" || -z "$PROJECT_ID" || -z "$STATUS_FIELD_ID" ]]; then
    refresh_context
    load_context
  fi
}

# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

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

# ---------------------------------------------------------------------------
# Items
# ---------------------------------------------------------------------------

# Reads the whole item list once and caches every issue -> item id mapping.
refresh_items() {
  local line number item
  while IFS=$'\t' read -r number item; do
    [[ -n "$number" ]] && cache_set "ITEM_$number" "$item"
  done < <(gh project item-list "$PROJECT_NUMBER" --owner "$OWNER" --limit 500 --format json \
    --jq ".items[] | select(.content.repository == \"$REPO\") | [(.content.number | tostring), .id] | @tsv")
}

item_id_for_issue() {
  local issue="$1" item
  item="$(cache_get "ITEM_$issue")"
  if [[ -z "$item" ]]; then
    refresh_items
    item="$(cache_get "ITEM_$issue")"
  fi
  printf '%s' "$item"
}

# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

cmd_info() {
  echo "owner:   $OWNER"
  echo "repo:    $REPO"
  echo "project: $PROJECT_TITLE (#$PROJECT_NUMBER, id $PROJECT_ID)"
  echo "cache:   $(cache_file)"
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

edit_status() {
  local item_id="$1" status="$2" option_id
  option_id="$(cache_get "$(status_key "$status")")"
  gh project item-edit --id "$item_id" --project-id "$PROJECT_ID" \
    --field-id "$STATUS_FIELD_ID" --single-select-option-id "$option_id" >/dev/null
}

cmd_set_status() {
  validate_issue_number "${1:-}"
  [[ -n "${2:-}" ]] || die "usage: board.sh set-status <issue-number> <status>"
  validate_status "$2"

  local item_id
  item_id="$(item_id_for_issue "$1")"
  [[ -n "$item_id" ]] || die "issue #$1 is not on the board (run: board.sh add $1)"

  if ! edit_status "$item_id" "$2" 2>/dev/null; then
    # Cached ids may be stale (options recreated, item removed): refresh once and retry.
    refresh_context
    load_context
    refresh_items
    item_id="$(cache_get "ITEM_$1")"
    [[ -n "$item_id" ]] || die "issue #$1 is not on the board (run: board.sh add $1)"
    edit_status "$item_id" "$2"
  fi
  echo "#$1 -> $2"
}

cmd_add() {
  validate_issue_number "${1:-}"
  # Idempotent: an issue already on the board keeps its current status.
  if [[ -n "$(item_id_for_issue "$1")" ]]; then
    echo "#$1 already on the board"
    return 0
  fi

  local url="https://github.com/$REPO/issues/$1" item_id attempt
  for attempt in 1 2 3 4 5; do
    if item_id="$(gh project item-add "$PROJECT_NUMBER" --owner "$OWNER" --url "$url" \
      --format json --jq .id 2>/dev/null)" && [[ -n "$item_id" ]]; then
      break
    fi
    [[ "$attempt" -lt 5 ]] || die "could not add #$1 to the board after $attempt attempts"
    sleep $((attempt * 2))
  done
  cache_set "ITEM_$1" "$item_id"
  cmd_set_status "$1" "Backlog"
}

main() {
  require_gh
  local command="${1:-}"
  [[ -n "$command" ]] || die "usage: board.sh <info|list|get-status|set-status|add|clear-cache> [args]"
  shift

  if [[ "$command" == "clear-cache" ]]; then
    cache_clear
    echo "cache cleared"
    return 0
  fi

  load_context

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
