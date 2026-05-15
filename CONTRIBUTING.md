# Contributing to autohupr

Thanks for your interest! A few rules to keep releases automatic and clean.

## Commit messages drive releases

We follow [Semantic Versioning](https://semver.org/).

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
```

## CI for external contributors

All users that are not a member or owner of this repository will require approval to run workflows.

## Pull request checklist

- [ ] One logical change per PR
- [ ] `Change-type` trailer set (unless intentionally no-release)
- [ ] Tests/lint pass locally (`npm test`)
