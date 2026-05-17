// Populate the balenaHub block "Release notes" after a release is published.
//
// The hub "Release notes" panel renders the balena release `note` field
// (confirmed empirically — see the project history). On every tagged release
// this:
//   1. sets the release note to JUST that version's CHANGELOG section, and
//   2. uploads the full CHANGELOG.md as a downloadable release asset.
//
// Run from .github/workflows/balena-publish-block.yml after the block is
// published. Env:
//   BALENA_API_KEY  (required) — balena API token (auth.loginWithToken)
//   GITHUB_REF_NAME (optional) — the tag, e.g. "v0.5.8"; falls back to
//                                 package.json version
//   BLOCK_SLUG      (optional) — default "marcus7/autohupr"
//   BALENA_API_URL  (optional) — default https://api.balena-cloud.com

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import BalenaSdk from 'balena-sdk';

const getSdk = BalenaSdk.getSdk ?? BalenaSdk.default?.getSdk;

const BLOCK_SLUG = process.env.BLOCK_SLUG || 'marcus7/autohupr';
const API_URL = process.env.BALENA_API_URL || 'https://api.balena-cloud.com';
const ASSET_KEY = 'CHANGELOG.md';
const CHANGELOG_PATH = fileURLToPath(new URL('../CHANGELOG.md', import.meta.url));
const PKG_PATH = fileURLToPath(new URL('../package.json', import.meta.url));

function die(msg, err) {
	console.error(`x ${msg}`);
	if (err) {
		console.error(err && err.stack ? err.stack : err);
	}
	process.exit(1);
}

// The newest release's section only: from the first "# vX" header up to (but
// excluding) the second "# vX" header. Excludes the "# Change Log" title and
// any preamble.
function newestReleaseSection(text) {
	const lines = text.split('\n');
	let start = -1;
	for (let i = 0; i < lines.length; i++) {
		if (/^# v\d/.test(lines[i])) {
			start = i;
			break;
		}
	}
	if (start === -1) {
		return '';
	}
	const out = [lines[start]];
	for (let i = start + 1; i < lines.length; i++) {
		if (/^# v\d/.test(lines[i])) {
			break;
		}
		out.push(lines[i]);
	}
	return out.join('\n').trim();
}

async function resolveVersion() {
	const ref = process.env.GITHUB_REF_NAME;
	if (ref) {
		return ref.replace(/^v/, '').trim();
	}
	const pkg = JSON.parse(await readFile(PKG_PATH, 'utf8'));
	return String(pkg.version).trim();
}

async function resolveRelease(balena, version) {
	const releases = await balena.models.release.getAllByApplication(BLOCK_SLUG, {
		$select: ['id', 'raw_version', 'semver', 'revision', 'commit', 'is_final', 'status'],
		$orderby: { created_at: 'desc' },
		$top: 50,
	});

	const usable = releases.filter(
		(r) => r.is_final && r.status === 'success',
	);
	// Exact raw_version, else same semver (newest revision wins — list is
	// already newest-first).
	const match =
		usable.find((r) => r.raw_version === version) ??
		usable.find((r) => r.semver === version);
	if (match) {
		return match;
	}

	// Fallback: the app's tracked default release.
	console.log(
		`No final release with version "${version}"; falling back to tracked default release.`,
	);
	const app = await balena.models.application.get(BLOCK_SLUG, {
		$select: ['id', 'slug'],
		$expand: {
			should_be_running__release: {
				$select: ['id', 'raw_version', 'commit', 'is_final', 'status'],
			},
		},
	});
	const tracked = app.should_be_running__release?.[0];
	if (!tracked) {
		die(
			`Could not resolve a release for "${version}" in ${BLOCK_SLUG} (no match, no tracked default).`,
		);
	}
	return tracked;
}

async function main() {
	if (typeof getSdk !== 'function') {
		die('Could not load getSdk from balena-sdk.');
	}
	if (!process.env.BALENA_API_KEY) {
		die('BALENA_API_KEY env var is required.');
	}

	const version = await resolveVersion();
	console.log(`Target block: ${BLOCK_SLUG}  version: ${version}`);

	const balena = getSdk({ apiUrl: API_URL });
	await balena.auth.loginWithToken(process.env.BALENA_API_KEY);

	const release = await resolveRelease(balena, version);
	console.log(
		`Resolved release: id=${release.id} v=${release.raw_version} commit=${release.commit}`,
	);

	const changelog = await readFile(CHANGELOG_PATH, 'utf8');
	const note = newestReleaseSection(changelog);
	if (!note) {
		die('Could not extract a release section from CHANGELOG.md.');
	}

	console.log(`Setting release note (${note.length} chars)...`);
	await balena.models.release.setNote(release.id, note);
	console.log('  setNote OK');

	console.log(`Uploading ${ASSET_KEY} asset...`);
	const asset = await balena.models.release.asset.upload(
		{
			asset: CHANGELOG_PATH,
			asset_key: ASSET_KEY,
			release: release.id,
		},
		{ overwrite: true },
	);
	console.log(`  asset.upload OK: ${JSON.stringify(asset)}`);
}

main().catch((err) => die('publish-release-notes failed.', err));
