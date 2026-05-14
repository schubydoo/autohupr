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
```

### From GitHub Container Registry (mirror)

```yaml
    image: ghcr.io/schubydoo/autohupr:latest  # or :<version>
```

## Configuration

| Variable | Default | Notes |
|----------|---------|-------|
| `HUP_TARGET_VERSION` | *(none)* | **Required for OS updates.** `latest`, `recommended`, or a specific OS version (e.g. `2.107.10`). Leave empty to disable OS updates. |
| `HUP_CHECK_INTERVAL` | `1d` | Time between OS update checks (e.g. `1h`, `30m`). |
| `SUPERVISOR_TARGET_VERSION` | *(none)* | Supervisor release to pin to. `latest`/`recommended`, or a specific version (e.g. `14.13.7`). Leave empty to disable supervisor updates. |
| `SUPERVISOR_CHECK_INTERVAL` | `1d` | Time between supervisor update checks. |

`BALENA_API_KEY`, `BALENA_API_URL`, and `BALENA_DEVICE_UUID` are injected
automatically when `io.balena.features.balena-api: 1` is set.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Releases are automated from
`Change-type:` commit trailers via Versionist.

## License

[Apache-2.0](LICENSE). See [NOTICE](NOTICE) for attribution.
