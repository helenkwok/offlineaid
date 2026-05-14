#!/usr/bin/env bash
# Sync new commits from internal repo to public, stripping private paths.
#
# Usage:  ./scripts/sync-from-internal.sh [--dry-run]
#
# Prereqs:
#   - 'internal' remote configured (git remote add internal ../offlineaid)
#   - 'last-public-sync' tag exists in the internal repo at the last synced commit
#   - Working tree is clean
#
# What it does:
#   1. Fetches internal/dev
#   2. For each new commit since last-public-sync:
#        - Checks out that commit's tree EXCLUDING private paths
#        - Skips commits that only touched private paths
#        - Commits to public with the internal commit's message/author/date
#   3. Updates last-public-sync tag in internal to the new HEAD
#
# Private paths stripped (edit PRIVATE_PATHS below to add more):
#   .planning, CLAUDE.md, .claude, AGENTS.md, .omx, .vscode, all .DS_Store

set -euo pipefail

# ---- config ----
INTERNAL_REMOTE="internal"
INTERNAL_BRANCH="dev"
SYNC_TAG="last-public-sync"
PRIVATE_PATHS=(
  ".planning"
  "CLAUDE.md"
  ".claude"
  "AGENTS.md"
  ".omx"
  ".vscode"
)

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
  echo "DRY RUN — no changes will be made"
fi

# ---- precondition checks ----
if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: public working tree is dirty. Commit or stash first." >&2
  exit 1
fi

if ! git remote get-url "$INTERNAL_REMOTE" >/dev/null 2>&1; then
  echo "ERROR: no '$INTERNAL_REMOTE' remote. Run: git remote add internal ../offlineaid" >&2
  exit 1
fi

INTERNAL_DIR=$(git remote get-url "$INTERNAL_REMOTE")

# ---- fetch internal ----
echo "Fetching $INTERNAL_REMOTE/$INTERNAL_BRANCH..."
git fetch "$INTERNAL_REMOTE" "$INTERNAL_BRANCH" --quiet

# ---- determine sync range ----
if ! ( cd "$INTERNAL_DIR" && git rev-parse "$SYNC_TAG" >/dev/null 2>&1 ); then
  echo "ERROR: tag '$SYNC_TAG' not found in internal repo. Set it with:" >&2
  echo "  cd $INTERNAL_DIR && git tag $SYNC_TAG <last-synced-sha>" >&2
  exit 1
fi

FROM=$( cd "$INTERNAL_DIR" && git rev-parse "$SYNC_TAG" )
TO=$( cd "$INTERNAL_DIR" && git rev-parse "$INTERNAL_BRANCH" )

if [[ "$FROM" == "$TO" ]]; then
  echo "Already in sync at $(git -C "$INTERNAL_DIR" log -1 --oneline "$TO")"
  exit 0
fi

COMMITS=$( cd "$INTERNAL_DIR" && git rev-list --reverse "$FROM..$TO" )
COUNT=$(echo "$COMMITS" | wc -l | tr -d ' ')
echo "Syncing $COUNT commit(s) from $(git -C "$INTERNAL_DIR" log -1 --format=%h "$FROM") to $(git -C "$INTERNAL_DIR" log -1 --format=%h "$TO")"

# ---- replay each commit ----
SYNCED=0
SKIPPED=0

for sha in $COMMITS; do
  short=$(echo "$sha" | cut -c1-7)
  msg_first_line=$( cd "$INTERNAL_DIR" && git log -1 --format=%s "$sha" )

  tmp_index=$(mktemp -t sync-index-XXXXXX)
  trap 'rm -f "$tmp_index"' EXIT

  GIT_INDEX_FILE="$tmp_index" git read-tree "$sha" 2>/dev/null
  for excl in "${PRIVATE_PATHS[@]}"; do
    GIT_INDEX_FILE="$tmp_index" git rm --cached -rf --ignore-unmatch "$excl" >/dev/null 2>&1 || true
  done
  GIT_INDEX_FILE="$tmp_index" git ls-files \
    | { grep -E '(^|/)\.DS_Store$' || true; } \
    | while read -r f; do
        GIT_INDEX_FILE="$tmp_index" git rm --cached --ignore-unmatch "$f" >/dev/null 2>&1 || true
      done

  new_tree=$(GIT_INDEX_FILE="$tmp_index" git write-tree)
  rm -f "$tmp_index"

  current_tree=$(git rev-parse HEAD^{tree})
  if [[ "$new_tree" == "$current_tree" ]]; then
    echo "  $short  SKIP (private-only)  $msg_first_line"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  if [[ "$DRY_RUN" == "1" ]]; then
    echo "  $short  WOULD SYNC          $msg_first_line"
    continue
  fi

  author_name=$( cd "$INTERNAL_DIR" && git log -1 --format=%an "$sha" )
  author_email=$( cd "$INTERNAL_DIR" && git log -1 --format=%ae "$sha" )
  author_date=$( cd "$INTERNAL_DIR" && git log -1 --format=%aI "$sha" )
  full_msg=$( cd "$INTERNAL_DIR" && git log -1 --format=%B "$sha" )

  git read-tree --reset -u "$new_tree"

  GIT_AUTHOR_NAME="$author_name" \
  GIT_AUTHOR_EMAIL="$author_email" \
  GIT_AUTHOR_DATE="$author_date" \
  GIT_COMMITTER_DATE="$author_date" \
    git commit --quiet --allow-empty-message -m "$full_msg"

  echo "  $short  ✓ synced            $msg_first_line"
  SYNCED=$((SYNCED + 1))
done

if [[ "$DRY_RUN" == "0" ]] && [[ "$SYNCED" -gt 0 || "$SKIPPED" -gt 0 ]]; then
  ( cd "$INTERNAL_DIR" && git tag -f "$SYNC_TAG" "$TO" >/dev/null )
  echo
  echo "Updated $SYNC_TAG in internal to $(echo $TO | cut -c1-7)"
  echo "Synced: $SYNCED  |  Skipped (private-only): $SKIPPED"
  echo
  echo "Next: git push origin master"
fi
