# autohupr

Automatically keep your balenaOS host release and balena supervisor up-to-date
with this drop-in block.

> Fork of and successor to [`balena-io-experimental/autohupr-example`](https://github.com/balena-io-experimental/autohupr-example). See [NOTICE](NOTICE).

## Usage

Two images are published from every release. Both are single multi-arch
manifests covering `linux/amd64`, `linux/arm64`, and `linux/arm/v7` —
balenaCloud's builder pulls the right one for each device.

### From balenaHub (canonical)

```yaml
services:
  autohupr:
    image: bh.cr/schubydoo/autohupr           # or bh.cr/schubydoo/autohupr/<version>
    tmpfs:
      - /tmp/work
    labels:
      io.balena.features.balena-api: 1
      io.balena.features.supervisor-api: 1
```

### From GitHub Container Registry (mirror)

Same `services:` block as above, with the image swapped:

```yaml
    image: ghcr.io/schubydoo/autohupr:latest  # or :<version>
```

Both labels are required:

- `io.balena.features.balena-api: 1` injects `BALENA_API_KEY`, `BALENA_API_URL`,
  and `BALENA_DEVICE_UUID` (used to drive HUP and supervisor updates).
- `io.balena.features.supervisor-api: 1` lets the block stop itself cleanly
  when it is disabled or misconfigured (see [Parking](#parking) below).

## Configuration

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `HUP_TARGET_VERSION` | one of these two | *(none)* | balenaOS target. `latest`, `recommended`, or a version family (see below). Leave unset to disable OS updates. |
| `SUPERVISOR_TARGET_VERSION` | one of these two | *(none)* | Supervisor target. `latest`, `recommended`, or a version family. Leave unset to disable supervisor updates. |
| `HUP_CHECK_INTERVAL` | no | `1d` | Time between OS update checks. |
| `SUPERVISOR_CHECK_INTERVAL` | no | `1d` | Time between supervisor update checks. |
| `ENABLED_SERVICES` | no | *(unset)* | Standard balena multi-block control. If set and this service's name is not in the comma-separated list, the block parks itself. |

At least one of `HUP_TARGET_VERSION` / `SUPERVISOR_TARGET_VERSION` must be set —
the block uses whichever is set and ignores the other. You can run it as an
OS-only updater, a supervisor-only updater, or both.

### Version families

A target version is a **family selector**: the components you specify are
locked, and anything more specific automatically tracks the highest available
release in that family.

| You set | It tracks | It will **not** move to |
|---------|-----------|-------------------------|
| `17` | newest `17.x.y` | `18.x` |
| `17.1` | newest `17.1.x` (e.g. `17.1.5`) | `17.2`, `17.10` |
| `17.1.1` | that patch, newest revision | `17.1.2` |
| `17.1.1+rev2` | exactly that release | anything else |
| `latest` / `recommended` | balena's recommended release | — |

`SUPERVISOR_TARGET_VERSION` accepts the same forms but **without** a revision
suffix (supervisor releases are always `X.X.X`). If no release in the supported
set matches the family, the block logs it and skips — it never jumps to a
different family.

### Check intervals

`<number><unit>` where unit is one of `m` (minutes), `h`, `d`, `w`, `y`.
Compound values (e.g. `1h30m`) and the `s`/`ms` units are rejected, and the
**minimum is 30m** — this protects balena's API from being polled too
aggressively. Invalid values park the block rather than guessing.

### Update ordering

When both features are enabled, the supervisor is brought to its target
**before** each OS update check. The supported set of OS updates depends on the
running supervisor, so the supervisor is converged first; OS update checks wait
until it settles.

### Parking

Instead of crash-looping on bad input, the block asks the balena supervisor to
stop this service (and then idles) when:

- the service is excluded via `ENABLED_SERVICES`,
- neither `HUP_TARGET_VERSION` nor `SUPERVISOR_TARGET_VERSION` is set, or
- any provided value is invalid.

This requires `io.balena.features.supervisor-api: 1`. The reason is logged.

## Supply chain & verification

Every release is keyless-signed with [Cosign](https://docs.sigstore.dev/) and
ships a Software Bill of Materials:

```sh
# Verify the image signature (Sigstore keyless / GitHub OIDC)
cosign verify ghcr.io/schubydoo/autohupr:<version> \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity-regexp '^https://github.com/schubydoo/autohupr/\.github/workflows/.+'

# Inspect the buildx SBOM + provenance attestations baked into the image
docker buildx imagetools inspect ghcr.io/schubydoo/autohupr:<version> \
  --format '{{ json .SBOM }}'
```

A standalone SPDX SBOM (`autohupr.spdx.json`) is attached to each
[GitHub Release](https://github.com/schubydoo/autohupr/releases). The repo is
also scanned by CodeQL, Trivy, and OSSF Scorecard.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Releases are automated from
`Change-type:` commit trailers.

## License

[Apache-2.0](LICENSE). See [NOTICE](NOTICE) for attribution.
