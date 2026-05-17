// THROWAWAY SPIKE — delete after we learn what drives balenaHub "Release notes".
//
// Tests, side by side, the two balena-sdk mechanisms that might populate the
// "Release notes" section of https://hub.balena.io/blocks/2363450/autohupr:
//
//   1. balena.models.release.setNote(releaseId, text)
//   2. balena.models.release.asset.upload({ asset, asset_key, release })  (CHANGELOG.md)
//
// MODE env var: inventory (read-only, default) | write | revert
// Auth: BALENA_API_KEY env var (an API key works with auth.loginWithToken).
// Target app: BLOCK_SLUG env var (default marcus7/autohupr).

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import BalenaSdk from 'balena-sdk';

const getSdk = BalenaSdk.getSdk ?? BalenaSdk.default?.getSdk;

const MODE = (process.env.MODE || 'inventory').toLowerCase();
const BLOCK_SLUG = process.env.BLOCK_SLUG || 'marcus7/autohupr';
const API_URL = process.env.BALENA_API_URL || 'https://api.balena-cloud.com';
const ASSET_KEY = 'CHANGELOG.md';
const NOTE_MARKER = '「spike setNote」'; // 「spike setNote」 — unmistakable in the UI
const CHANGELOG_URL = new URL('../CHANGELOG.md', import.meta.url);
const CHANGELOG_PATH = fileURLToPath(CHANGELOG_URL);

function die(msg, err) {
	console.error(`✗ ${msg}`);
	if (err) {
		console.error(err && err.stack ? err.stack : err);
	}
	process.exit(1);
}

// Top CHANGELOG section: everything up to (but excluding) the 2nd "# v" header.
function topChangelogSection(text) {
	const lines = text.split('\n');
	let seenFirstVersion = false;
	const out = [];
	for (const line of lines) {
		if (/^# v\d/.test(line)) {
			if (seenFirstVersion) {
				break;
			}
			seenFirstVersion = true;
		}
		out.push(line);
	}
	return out.join('\n').trim();
}

async function resolveDefaultRelease(balena) {
	let app;
	try {
		app = await balena.models.application.get(BLOCK_SLUG, {
			$select: ['id', 'slug'],
			$expand: {
				should_be_running__release: {
					$select: ['id', 'raw_version', 'commit', 'note', 'is_final', 'status'],
				},
			},
		});
	} catch (err) {
		die(
			`Could not read application "${BLOCK_SLUG}". Does the BALENA_API_KEY account have access?`,
			err,
		);
	}
	console.log(`App: ${app.slug} (id ${app.id})`);

	const tracked = app.should_be_running__release?.[0];
	if (tracked) {
		return tracked;
	}

	console.log(
		'No tracked default release on the app; falling back to newest final release.',
	);
	const finals = await balena.models.release.getAllByApplication(BLOCK_SLUG, {
		$select: ['id', 'raw_version', 'commit', 'note', 'is_final', 'status'],
		$filter: { is_final: true, status: 'success' },
		$orderby: { created_at: 'desc' },
		$top: 1,
	});
	if (!finals.length) {
		die(`No final successful releases found for ${BLOCK_SLUG}.`);
	}
	return finals[0];
}

async function printInventory(balena, target) {
	const releases = await balena.models.release.getAllByApplication(BLOCK_SLUG, {
		$select: ['id', 'raw_version', 'commit', 'status', 'is_final', 'note'],
		$orderby: { created_at: 'desc' },
		$top: 10,
	});
	console.log('\nRecent releases (newest first):');
	for (const r of releases) {
		const marker = r.id === target.id ? ' <-- DEFAULT/TARGET' : '';
		const note = r.note ? JSON.stringify(r.note.slice(0, 80)) : 'null';
		console.log(
			`  id=${r.id} v=${r.raw_version} final=${r.is_final} status=${r.status} note=${note}${marker}`,
		);
	}

	const assets = await balena.models.release.asset.getAllByRelease(target.id, {
		$select: ['id', 'asset_key'],
	});
	console.log(
		`\nExisting assets on target release ${target.id} (v${target.raw_version}):`,
	);
	if (!assets.length) {
		console.log('  (none)');
	} else {
		for (const a of assets) {
			console.log(`  id=${a.id} key=${a.asset_key}`);
		}
	}
}

async function main() {
	if (typeof getSdk !== 'function') {
		die('Could not load getSdk from balena-sdk.');
	}
	if (!process.env.BALENA_API_KEY) {
		die('BALENA_API_KEY env var is required.');
	}

	const balena = getSdk({ apiUrl: API_URL });
	await balena.auth.loginWithToken(process.env.BALENA_API_KEY);

	const target = await resolveDefaultRelease(balena);
	console.log(
		`Target release: id=${target.id} v=${target.raw_version} commit=${target.commit} final=${target.is_final}`,
	);
	console.log(`Current note: ${target.note ? JSON.stringify(target.note) : 'null'}`);

	// Always show the starting state so a later revert is verifiable.
	await printInventory(balena, target);

	if (MODE === 'inventory') {
		console.log('\nMODE=inventory — read-only, no changes made.');
		return;
	}

	if (MODE === 'write') {
		const changelog = await readFile(CHANGELOG_PATH, 'utf8');
		const noteText = `${NOTE_MARKER}\n\n${topChangelogSection(changelog)}`;

		console.log(`\nMODE=write — setNote on release ${target.id}...`);
		await balena.models.release.setNote(target.id, noteText);
		console.log('  setNote OK');

		console.log(
			`MODE=write — uploading ${ASSET_KEY} asset to release ${target.id}...`,
		);
		const asset = await balena.models.release.asset.upload(
			{
				asset: CHANGELOG_PATH,
				asset_key: ASSET_KEY,
				release: target.id,
			},
			{ overwrite: true },
		);
		console.log(`  asset.upload OK: ${JSON.stringify(asset)}`);
		console.log(
			'\nNow check https://hub.balena.io/blocks/2363450/autohupr "Release notes".',
		);
		return;
	}

	if (MODE === 'revert') {
		console.log(`\nMODE=revert — clearing note on release ${target.id}...`);
		await balena.models.release.setNote(target.id, null);
		console.log('  setNote(null) OK');

		console.log(`MODE=revert — removing ${ASSET_KEY} asset...`);
		try {
			await balena.models.release.asset.remove({
				asset_key: ASSET_KEY,
				release: target.id,
			});
			console.log('  asset.remove OK');
		} catch (err) {
			console.log(
				`  asset.remove skipped (likely not present): ${err && err.message}`,
			);
		}
		return;
	}

	die(`Unknown MODE "${MODE}" (expected inventory|write|revert).`);
}

main().catch((err) => die('Spike failed.', err));
