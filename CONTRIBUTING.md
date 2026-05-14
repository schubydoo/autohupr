# Contributing to autohupr

Thanks for your interest! A few rules to keep releases automatic and clean.

## Sign your commits

We use the DCO. Every commit needs `Signed-off-by: Your Name <you@example.com>`. Use `git commit -s`.

## Commit messages drive releases

We use [Versionist](https://github.com/product-os/versionist), per the
[Etcher commit guidelines](https://etcher.pages.dev/COMMIT-GUIDELINES/).

Each commit on `master` that should produce a release MUST include a
`Change-type:` trailer in its footer:

- `Change-type: patch` — bug fixes, internal changes
- `Change-type: minor` — backward-compatible features
- `Change-type: major` — breaking changes

Housekeeping commits that should NOT cut a release may omit the trailer
(rare on `master`).

Example:

```
Catch errors when upgrade status cannot be retrieved

Change-type: patch
Signed-off-by: Jane Doe <jane@example.com>
```

## CI for external contributors

If this is your first PR to the repo, a maintainer must approve the CI run
before tests/builds execute. This is a GitHub security default for outside
collaborators.

## Pull request checklist

- [ ] One logical change per PR
- [ ] `Change-type` trailer set (unless intentionally no-release)
- [ ] `Signed-off-by` present on every commit
- [ ] Tests/lint pass locally (`npm test`)
