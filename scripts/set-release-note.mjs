// Set the balenaHub block "Release notes" for a just-published release.
//
// The hub "Release notes" panel renders the balena release `note` field
// (confirmed empirically). The official balena-io/upload-balena-release-asset
// action handles the downloadable CHANGELOG.md asset separately — it CANNOT
// set the release note, which is the only reason this script exists.
//
// Env:
//   BALENA_API_KEY (required) — balena API token (auth.loginWithToken)
//   RELEASE_ID     (required) — release_id output of deploy-to-balena-action
//   BALENA_API_URL (optional) — default https://api.balena-cloud.com

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import BalenaSdk from 'balena-sdk';

const getSdk = BalenaSdk.getSdk ?? BalenaSdk.default?.getSdk;
const API_URL = process.env.BALENA_API_URL || 'https://api.balena-cloud.com';
const CHANGELOG_PATH = fileURLToPath(new URL('../CHANGELOG.md', import.meta.url));

function die(msg, err) {
	console.error(`x ${msg}`);
	if (err) {
		console.error(err && err.stack ? err.stack : err);
	}
	process.exit(1);
}

// The newest release's section only: from the first "# vX" header up to (but
// excluding) the second "# vX" header. Excludes the "# Change Log" title.
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

async function main() {
	if (typeof getSdk !== 'function') {
		die('Could not load getSdk from balena-sdk.');
	}
	const token = process.env.BALENA_API_KEY;
	const releaseId = Number(process.env.RELEASE_ID);
	if (!token) {
		die('BALENA_API_KEY env var is required.');
	}
	if (!Number.isInteger(releaseId) || releaseId <= 0) {
		die(
			`RELEASE_ID must be a positive integer (got "${process.env.RELEASE_ID}"); is the deploy step's release_id output set?`,
		);
	}

	const note = newestReleaseSection(await readFile(CHANGELOG_PATH, 'utf8'));
	if (!note) {
		die('Could not extract a release section from CHANGELOG.md.');
	}

	const balena = getSdk({ apiUrl: API_URL });
	await balena.auth.loginWithToken(token);

	console.log(`Setting note on release ${releaseId} (${note.length} chars)...`);
	await balena.models.release.setNote(releaseId, note);
	console.log('  setNote OK');
}

main().catch((err) => die('set-release-note failed.', err));
