#!/usr/bin/env bash
# One task: persist a completed directory stage. Actions owns stage sequencing.
set -euo pipefail
stage=${1:?capture or render required}
archive=${2:?dedicated archive checkout required}
case "$stage" in
  capture) owned=snapshots ;;
  render) owned=posts ;;
  *) echo 'Only capture or render can persist' >&2; exit 1 ;;
esac
[[ $(git -C "$archive" symbolic-ref --short HEAD) == mirror-data-v2 ]]
input=$(git -C "$archive" rev-parse HEAD)
{
  echo "### $stage persistence"
  echo "Input revision: $input"
} >> "$GITHUB_STEP_SUMMARY"
git -C "$archive" add -A -- metadata.json
if [[ -d "$archive/$owned" ]]; then
  git -C "$archive" add -A -- "$owned"
fi
if git -C "$archive" diff --cached --quiet; then
  change=no-change
else
  git -C "$archive" commit -m "$stage directory archive"
  change=changed
fi
candidate=$(git -C "$archive" rev-parse HEAD)
echo "Local candidate: $candidate ($change); push not yet confirmed" >> "$GITHUB_STEP_SUMMARY"
# A nonzero result stays a failure even if the server may have accepted bytes.
if ! git -C "$archive" push origin HEAD:mirror-data-v2; then
  echo 'Push failed or outcome uncertain. Downstream blocked; inspect remote before a fresh run.' >> "$GITHUB_STEP_SUMMARY"
  exit 1
fi
echo "Confirmed pushed: $candidate ($change)" >> "$GITHUB_STEP_SUMMARY"
{
  echo "input=$input"
  echo "revision=$candidate"
  echo "change=$change"
} >> "$GITHUB_OUTPUT"
