#!/usr/bin/env bash
# Write .changeset/unreleased-commits.md: one line for each commit on HEAD since
# the last release tag, newest first. knope-prepare.yml runs this before `knope prepare-release`,
# so a Renovate bump with no hand-written changeset still opens a release PR.
#
# The fragment is never committed to master. It exists only on the `release`
# branch, and knope deletes it when it writes CHANGELOG.md.
#
# Commits that add or change a file in .changeset/ are left out, because their
# changeset already describes them.
#
# Exit codes: 0 = the fragment was written, or there is nothing to release.
#             3 = the release of the package.json version is not tagged yet.
set -euo pipefail

version=$(node -p "require('./package.json').version")
tag="v$version"
if ! git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
  # The release PR merged, but knope-release.yml did not create the tag yet,
  # or it failed. A new release PR now would skip a version.
  echo "Tag $tag does not exist yet."
  exit 3
fi

lines=""
while IFS= read -r sha; do
  files=$(git diff-tree --no-commit-id --name-only -r "$sha")
  if grep -q '^\.changeset/' <<<"$files"; then
    continue
  fi
  lines+="- $(git log -1 --format=%s "$sha")"$'\n'
done < <(git rev-list --no-merges "$tag..HEAD")

out=.changeset/unreleased-commits.md
if [ -z "$lines" ]; then
  rm -f "$out"
  echo "No commits without a changeset since $tag."
  exit 0
fi

mkdir -p .changeset
{
  printf -- '---\ndefault: other\n---\n\n'
  printf '# Commits since %s\n\n' "$tag"
  printf '%s' "$lines"
} > "$out"
echo "Wrote $out ($(grep -c '^- ' "$out") commits since $tag)."
