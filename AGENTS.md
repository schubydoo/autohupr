# autohupr

A drop-in **balena block** that automatically keeps a device's balenaOS host OS
release and balena supervisor up-to-date. TypeScript; runs as a container on the
device. Apache-2.0.

**Fork of / successor to** [`balena-io-experimental/autohupr-example`](https://github.com/balena-io-experimental/autohupr-example)
(see [NOTICE](NOTICE)). Published as a balena block to balenaHub (`bh.cr/schubydoo/autohupr`)
and mirrored to GHCR, as multi-arch images (`amd64`/`arm64`/`arm/v7`).

## Build · test · lint

```
npm run build      # tsc → build/
npm run lint       # balena-lint on src/
npm test           # lint + build + build:test + node --test (build-test/)
```

## Hard rules

- The block requires the `io.balena.features.balena-api` + `io.balena.features.supervisor-api`
  labels (they inject `BALENA_API_KEY`/`BALENA_API_URL` and the supervisor address) — don't drop them.
- **Conventional Commits** for PR titles; release automation drives versioning + CHANGELOG —
  don't hand-edit `CHANGELOG.md`.
- **GitHub Actions are SHA-pinned**; Renovate manages dependency + action bumps.
- CI gates: build/test (`ci.yml`), CodeQL, Trivy, TruffleHog, Scorecard.

## Release

Every release publishes two multi-arch images — the balena block to balenaHub and a
GHCR mirror. Default and PR target branch is **`master`**.
