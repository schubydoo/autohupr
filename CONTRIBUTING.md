# Contributing to autohupr

Thanks for your interest! A few rules to keep releases automatic and clean.

We follow [Semantic Versioning](https://semver.org/).

## Releases

[knope](https://knope.tech) makes the releases. You do not set a version or a
trailer by hand.

1. On each push to `master`, the `Prepare Release` workflow opens or refreshes a
   `chore: prepare release X.Y.Z` pull request. It bumps `package.json`,
   `package-lock.json`, `balena.yml`, and `CHANGELOG.md`.
2. A maintainer merges that pull request when the release is wanted.
3. The `Knope Release` workflow creates the `vX.Y.Z` tag and the GitHub release.
4. The tag push publishes the GHCR image and the balenaHub block. Then it starts
   the Trivy scan of the published image.

Every commit since the last tag goes into the release, including a Renovate
bump that has no changeset. So after Renovate merges a vulnerability fix, merge the open
release pull request to publish a fixed image. If no release pull request is
open, run `Prepare Release` from the Actions tab.

Do not create a release or a tag on the GitHub release page. The version files
then stay at the old version. The next release PR then gets a version that is
already tagged, and its merge publishes nothing.

## Changesets

A changeset is a small file in `.changeset/` that becomes a changelog entry and
sets the version bump. Without one, a commit is listed under "Other changes"
with its title, and the release is a patch release. Add a changeset when a
change needs its own line in the changelog, or a minor or major bump. Run
`knope document-change`, or create `.changeset/<short-name>.md` by hand:

```markdown
---
default: minor
---

Add a check interval for the supervisor
```

- `default:` is one of `major` (a breaking change), `minor` (a new feature),
  `patch` (a fix), or `security`.
- The body must be exactly one line.
- Do not add a `README.md` or any other Markdown file to `.changeset/`. knope
  reads each `.md` file there as a changeset.
- Do not edit `CHANGELOG.md` by hand. knope writes it.

## CI for external contributors

All users that are not a member or owner of this repository will require approval to run workflows.

## Pull request checklist

- [ ] One logical change per PR
- [ ] A changeset in `.changeset/` for a change that needs its own changelog line, or a minor or major bump
- [ ] Tests/lint pass locally (`npm test`)
