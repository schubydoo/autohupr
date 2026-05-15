import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const WIN = process.platform === 'win32';
const opts = { skip: WIN ? 'no POSIX sh on Windows' : false };

const START_SH = path.resolve(__dirname, '..', '..', 'start.sh');

const stubDir = (() => {
	const dir = mkdtempSync(path.join(tmpdir(), 'autohupr-sh-'));
	const stub = (name: string, body: string) => {
		const p = path.join(dir, name);
		writeFileSync(p, `#!/bin/sh\n${body}\n`);
		chmodSync(p, 0o755);
	};
	stub('node', 'echo "NODE-EXEC $*"\nexit 0');
	stub('curl', 'echo "CURL-CALLED"\nexit 0');
	stub('tail', 'exit 0'); // park()'s `exec tail -f /dev/null` must not hang
	return dir;
})();

const run = (env: Record<string, string>): string => {
	const res = spawnSync('sh', [START_SH], {
		cwd: path.dirname(START_SH),
		encoding: 'utf8',
		timeout: 10_000,
		env: { PATH: `${stubDir}${path.delimiter}${process.env.PATH ?? ''}`, ...env },
	});
	return `${res.stdout ?? ''}${res.stderr ?? ''}`;
};

const proceeded = (out: string) => out.includes('NODE-EXEC');
const parked = (out: string) => !proceeded(out);

test('parks when listed in DISABLED_SERVICES (kill-switch)', opts, () => {
	const out = run({
		DISABLED_SERVICES: 'foo, autohupr ,bar',
		BALENA_SERVICE_NAME: 'autohupr',
		HUP_TARGET_VERSION: 'recommended',
	});
	assert.ok(parked(out));
	assert.match(out, /DISABLED_SERVICES/);
});

test('proceeds when not listed in DISABLED_SERVICES', opts, () => {
	const out = run({
		DISABLED_SERVICES: 'foo,bar',
		BALENA_SERVICE_NAME: 'autohupr',
		HUP_TARGET_VERSION: 'recommended',
	});
	assert.ok(proceeded(out));
});

test('parks when neither target version is set', opts, () => {
	const out = run({});
	assert.ok(parked(out));
	assert.match(out, /neither HUP_TARGET_VERSION/);
});

test('parks on invalid HUP_TARGET_VERSION', opts, () => {
	const out = run({ HUP_TARGET_VERSION: 'garbage' });
	assert.ok(parked(out));
	assert.match(out, /not a valid target/);
});

test('proceeds on a valid HUP version family', opts, () => {
	assert.ok(proceeded(run({ HUP_TARGET_VERSION: '17.1' })));
	assert.ok(proceeded(run({ HUP_TARGET_VERSION: '17.1.1+rev2' })));
});

test('supervisor target rejects rev/v forms', opts, () => {
	assert.ok(parked(run({ SUPERVISOR_TARGET_VERSION: '14.13.7+rev1' })));
	assert.ok(parked(run({ SUPERVISOR_TARGET_VERSION: 'v14.13.7' })));
	assert.ok(proceeded(run({ SUPERVISOR_TARGET_VERSION: '14.13' })));
});

test('interval rules: unit allow-list + 30m floor', opts, () => {
	const base = { HUP_TARGET_VERSION: '17.1' };
	assert.ok(proceeded(run({ ...base, HUP_CHECK_INTERVAL: '30m' })));
	assert.ok(proceeded(run({ ...base, HUP_CHECK_INTERVAL: '1d' })));
	for (const bad of ['29m', '100s', '5000ms', '1h30m', '0m']) {
		assert.ok(
			parked(run({ ...base, HUP_CHECK_INTERVAL: bad })),
			`${bad} should park`,
		);
	}
});
