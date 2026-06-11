# Change Log

# v0.5.9
## (2026-06-11)

* fix: store balena session token in memory, drop /tmp/work tmpfs
* chore(deps): lock file maintenance
* chore(deps): update dependency @types/node to v24.13.2
* chore(deps): update trufflesecurity/trufflehog action to v3.95.5
* chore(deps): update github actions to v6.0.3
* chore(deps): update balena packages
* Bump Alpine, Node, npm, curl versions
* chore(deps): update security actions to 8aad20d
* chore(deps): lock file maintenance
* chore(deps): update balena-io/deploy-to-balena-action action to v2.2.10
* chore(deps): update docker/setup-qemu-action digest to 0611638

# v0.5.8
## (2026-05-29)

* fix: skip unsatisfiable supervisor downgrades
* chore(deps): lock file maintenance
* chore(deps): update docker actions
* chore(deps): update github/codeql-action digest to 7211b7c
* Consolidate balena deploy matrix into one job (#46)
* Tie URLs to commits (#45)
* Use official upload-balena-release-asset; slim note script
* Clarify supervisor latest/recommended is newest-available, not balena-recommended
* Automate balenaHub release notes; tidy changelog; add TruffleHog
* Add isolated write-note / write-asset spike modes
* Add throwaway release-notes spike (workflow_dispatch)

# v0.5.7
## (2026-05-17)

* Compare supervisor versions v-prefix/variant-insensitively

# v0.5.6
## (2026-05-17)

* Document supervisor-convergence latency; tighten HUP version gate
* chore(deps): lock file maintenance

# v0.5.5
## (2026-05-17)

* Add container HEALTHCHECK
* Clarify park behaviour in README and start.sh
* Add SECURITY.md
* Restrict workflow GITHUB_TOKEN to least privilege

# v0.5.4
## (2026-05-17)

* Drop editorializing line from the Acknowledgements section
* Make update loops resilient to transient API errors
* Drop logo and inline code from the balenaHub landing

# v0.5.3
## (2026-05-17)

* Fix OS up-to-date detection and slow supervisor gate
* Add a post-provisioning landing page for the balenaHub block

# v0.5.2
## (2026-05-15)

* Mention the supervisor in the project description
* chore(deps): lock file maintenance
* chore(deps): update security actions
* chore(deps): update actions/upload-artifact action to v7

# v0.5.1
## (2026-05-15)

* Replace ENABLED_SERVICES with a DISABLED_SERVICES kill-switch
* Set OCI description annotation on the image index
* Fix cosign verify regexp in README

# v0.5.0
## (2026-05-15)

* Fix shellcheck findings in release.yml
* Add CodeQL, Scorecard, Trivy, image signing and SBOM

# v0.4.0
## (2026-05-15)

* Add version-family targeting, park behavior, multi-stage build

# v0.3.0
## (2026-05-15)

* Sync version files to v0.2.0
* Align PR template with current CONTRIBUTING.md
* Read Node version from package.json engines in CI workflows
* Suppress alpine date-snapshot tag noise in Renovate logs
* chore: record intentional divergence from upstream
* Remove stale tooling and update contribution guidelines
* Pin Alpine packages to full apk version strings for Renovate
* Declare node types explicitly for TypeScript v6
* Add explicit rootDir for TypeScript v6 compatibility
* chore(deps): update dependency typescript to v6
* chore(deps): update github actions to v6
* fix(deps): update dependency ms to v3.0.0-canary.202508261828
* chore(deps): update docker actions
* chore(deps): lock file maintenance
* Group Renovate Action updates to reduce PR noise
* Add DCO sign-off to Renovate commits
* chore(config): migrate config renovate.json (#6)
* Rename release secret from FLOWZONE_TOKEN to RELEASE_TOKEN
* Remove SECURITY.md and drop personal copyright from NOTICE
* Replace Flowzone with explicit, focused workflows
* Refresh README with new image paths and attribution
* Add NOTICE, CONTRIBUTING, SECURITY, CODEOWNERS, PR template
* Add Renovate config
* Add multi-arch GHCR publish workflow
* Pin Flowzone to a commit SHA and restrict custom actions
* Expand supported device types for amd64/aarch64/armv7hf
* Switch container base to alpine with apk-installed Node 24
* Rename fork to autohupr and reset version to 0.0.0
* Update to Node 24, modernize deps, add supervisor updates
* Merge pull request #11 from balena-io-experimental/use_detached_hup
* Use HUP detached mode for improved resilience with an unreliable network
* Update configuration and dependencies; implement lint fixes
* Merge pull request #8 from balena-labs-projects/jaomaloy/set-target-version
* Allow user to set target version
* Merge pull request #7 from balena-labs-projects/move-to-labs-projects
* moving from balenablocks to balena-labs-projects
* Merge pull request #6 from balenablocks/flowzone
* Switch from balenaCI to flowzone
* Merge pull request #3 from balenablocks/kyle/update-readme
* Fix typo in readme
* Merge pull request #2 from balenablocks/kyle/publish-to-balenahub
* Update balena-sdk to v15.59.2
* Merge pull request #1 from balenablocks/kyle/publish-to-balenahub
* Set balenaCI repo type to generic
* Update packages
* Update readme and docker-compose examples
* Add balena.yml with block description and assets
* Add deploy-to-balena github action
* Catch errors when upgrade status cannot be retrieved
* Remove fail/retry loop and wait until next interval
* Initial commit

# v0.2.0
## (2026-05-15)

* Pin Alpine packages to full apk version strings for Renovate
* Declare node types explicitly for TypeScript v6
* Add explicit rootDir for TypeScript v6 compatibility
* chore(deps): update dependency typescript to v6
* chore(deps): update github actions to v6
* fix(deps): update dependency ms to v3.0.0-canary.202508261828
* chore(deps): update docker actions
* chore(deps): lock file maintenance
* Group Renovate Action updates to reduce PR noise
* Add DCO sign-off to Renovate commits
* chore(config): migrate config renovate.json (#6)
* Rename release secret from FLOWZONE_TOKEN to RELEASE_TOKEN
* Remove SECURITY.md and drop personal copyright from NOTICE
* Replace Flowzone with explicit, focused workflows
* Refresh README with new image paths and attribution
* Add NOTICE, CONTRIBUTING, SECURITY, CODEOWNERS, PR template
* Add Renovate config
* Add multi-arch GHCR publish workflow
* Pin Flowzone to a commit SHA and restrict custom actions
* Expand supported device types for amd64/aarch64/armv7hf
* Switch container base to alpine with apk-installed Node 24
* Rename fork to autohupr and reset version to 0.0.0
* Update to Node 24, modernize deps, add supervisor updates

# v0.1.2
## (2026-05-14)

* Rename release secret from FLOWZONE_TOKEN to RELEASE_TOKEN

# v0.1.1
## (2026-05-14)

* Remove SECURITY.md and drop personal copyright from NOTICE

# v0.1.0
## (2026-05-14)

* Replace Flowzone with explicit, focused workflows
* Refresh README with new image paths and attribution
* Add NOTICE, CONTRIBUTING, SECURITY, CODEOWNERS, PR template
* Add Renovate config
* Add multi-arch GHCR publish workflow
* Pin Flowzone to a commit SHA and restrict custom actions
* Expand supported device types for amd64/aarch64/armv7hf
* Switch container base to alpine with apk-installed Node 24
* Rename fork to autohupr and reset version to 0.0.0
* Update to Node 24, modernize deps, add supervisor updates
* Merge pull request #11 from balena-io-experimental/use_detached_hup
* Use HUP detached mode for improved resilience with an unreliable network
* Update configuration and dependencies; implement lint fixes
* Merge pull request #8 from balena-labs-projects/jaomaloy/set-target-version
* Allow user to set target version
* Merge pull request #7 from balena-labs-projects/move-to-labs-projects
* moving from balenablocks to balena-labs-projects
* Merge pull request #6 from balenablocks/flowzone
* Switch from balenaCI to flowzone
* Merge pull request #3 from balenablocks/kyle/update-readme
* Fix typo in readme
* Merge pull request #2 from balenablocks/kyle/publish-to-balenahub
* Update balena-sdk to v15.59.2
* Merge pull request #1 from balenablocks/kyle/publish-to-balenahub
* Set balenaCI repo type to generic
* Update packages
* Update readme and docker-compose examples
* Add balena.yml with block description and assets
* Add deploy-to-balena github action
* Catch errors when upgrade status cannot be retrieved
* Remove fail/retry loop and wait until next interval
* Initial commit
