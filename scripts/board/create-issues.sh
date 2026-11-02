#!/usr/bin/env bash
# Creates one GitHub issue per task in docs/tasks/backlog.md and adds each to the board (Backlog).
# Idempotent: tasks whose title already exists as an issue are skipped.
#
# Task numbers are expected to match issue numbers (T-07 -> #7). The script warns if they diverge.
#
# Requires: gh CLI authenticated with the `project` scope (gh auth refresh -s project).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKLOG="$ROOT_DIR/docs/tasks/backlog.md"

die() {
  echo "error: $*" >&2
  exit 1
}

command -v gh >/dev/null 2>&1 || die "gh CLI not found"
[[ -f "$BACKLOG" ]] || die "backlog not found at $BACKLOG"

REPO="${BOARD_REPO:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

echo "Creating labels..."
create_label() {
  gh label create "$1" --repo "$REPO" --color "$2" --description "$3" --force >/dev/null
}
create_label backend "1d76db" "Back-end (NestJS, Prisma) work"
create_label frontend "5319e7" "Front-end (Next.js) work"
create_label infra "fbca04" "Infrastructure, tooling, CI/CD"
create_label docs "0e8a16" "Documentation"

echo "Parsing $BACKLOG..."
awk -v dir="$tmp_dir" '
  /^### T-[0-9]+ · / {
    num = $2
    sub(/^T-/, "", num)
    title = $0
    sub(/^### T-[0-9]+ · /, "", title)
    body = dir "/" num ".md"
    print title > (dir "/" num ".title")
    close(dir "/" num ".title")
    next
  }
  body != "" && /^---$/ { next }
  body != "" { print > body }
' "$BACKLOG"

existing_titles="$(gh issue list --repo "$REPO" --state all --limit 500 --json title --jq '.[].title')"

shopt -s nullglob
for title_file in "$tmp_dir"/*.title; do
  num_padded="$(basename "$title_file" .title)"
  num=$((10#$num_padded))
  title="$(cat "$title_file")"
  body_file="$tmp_dir/$num_padded.md"

  if grep -Fxq -- "$title" <<<"$existing_titles"; then
    echo "T-$num_padded already exists, skipping: $title"
    continue
  fi

  area="$(sed -n 's/^- \*\*Area:\*\* *//p' "$body_file" | head -n 1 | tr -d '[:space:]')"
  [[ -n "$area" ]] || die "task T-$num_padded has no Area"

  printf '\n_Source: `docs/tasks/backlog.md` (T-%s)_\n' "$num_padded" >>"$body_file"

  url="$(gh issue create --repo "$REPO" --title "$title" --body-file "$body_file" --label "$area")"
  issue_number="${url##*/}"
  echo "Created #$issue_number for T-$num_padded: $title"

  if [[ "$issue_number" != "$num" ]]; then
    echo "warning: T-$num_padded became issue #$issue_number; update 'Depends on' references in the backlog" >&2
  fi

  "$SCRIPT_DIR/board.sh" add "$issue_number"
done

echo "Done."
