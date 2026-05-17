import test from 'node:test';
import assert from 'node:assert/strict';
import type { BalenaSDK } from 'balena-sdk';
import {
	createService,
	selectOsTarget,
	selectSupervisorTarget,
	type ServiceConfig,
} from '../src/main';

const immediate = (): Promise<void> =>
	new Promise<void>((resolve) => setImmediate(resolve));

interface FakeState {
	online: boolean;
	status: string;
	osVersion: string;
	osVersions: string[];
	recommended: string | null;
	supervisor: string;
	supervisorReleases: string[];
}

interface Harness {
	sdk: BalenaSDK;
	order: string[];
	pin: string[];
	osUpdates: string[];
	state: FakeState;
}

const makeHarness = (overrides: Partial<FakeState> = {}): Harness => {
	const state: FakeState = {
		online: true,
		status: 'idle',
		osVersion: '5.1.30',
		osVersions: ['5.1.36'],
		recommended: '5.1.36',
		supervisor: '17.0.0',
		supervisorReleases: ['17.1.5', '17.0.0'],
		...overrides,
	};
	const order: string[] = [];
	const pin: string[] = [];
	const osUpdates: string[] = [];

	const device = {
		isOnline: async () => state.online,
		getOsVersion: () => state.osVersion,
		get: async (_uuid: string, options?: Record<string, unknown>) => {
			const select = (options?.$select as string[] | undefined) ?? [];
			if (select.includes('supervisor_version')) {
				return { supervisor_version: state.supervisor };
			}
			if (select.includes('status')) {
				return { status: state.status, provisioning_state: 'idle' };
			}
			const expand = options?.$expand as
				| Record<string, { $expand?: unknown }>
				| undefined;
			if (expand?.is_of__device_type?.$expand) {
				return {
					is_of__device_type: [
						{ is_of__cpu_architecture: [{ slug: 'aarch64' }] },
					],
				};
			}
			if (expand?.is_of__device_type) {
				return { is_of__device_type: [{ slug: 'raspberrypi4-64' }] };
			}
			return {};
		},
		startOsUpdate: async (_uuid: string, target: string) => {
			order.push('startOsUpdate');
			osUpdates.push(target);
		},
		pinToSupervisorRelease: async (_uuid: string, target: string) => {
			order.push('pin');
			pin.push(target);
		},
	};

	const sdk = {
		auth: { loginWithToken: async () => undefined },
		models: {
			device,
			os: {
				getSupportedOsUpdateVersions: async () => ({
					versions: state.osVersions,
					recommended: state.recommended,
				}),
				getSupervisorReleasesForCpuArchitecture: async () =>
					state.supervisorReleases.map((raw_version) => ({ raw_version })),
			},
		},
	} as unknown as BalenaSDK;

	return { sdk, order, pin, osUpdates, state };
};

const config = (over: Partial<ServiceConfig> = {}): ServiceConfig => ({
	apiKey: 'k',
	deviceUuid: 'uuid',
	checkInterval: '1d',
	supervisorCheckInterval: '1d',
	userTargetVersion: 'recommended',
	supervisorTargetVersion: '',
	...over,
});

// --- pure selectors ---------------------------------------------------------

test('selectOsTarget: family / recommended / equality / skip', () => {
	const v = { versions: ['17.1.5', '17.1.4', '17.10.0'], recommended: '17.10.0' };
	assert.deepEqual(selectOsTarget('17.1', v, '17.0.0'), {
		action: 'update',
		version: '17.1.5',
	});
	assert.deepEqual(selectOsTarget('recommended', v, '17.0.0'), {
		action: 'update',
		version: '17.10.0',
	});
	assert.equal(selectOsTarget('', v, '17.0.0').action, 'skip');
	assert.equal(selectOsTarget('17.9', v, '17.0.0').action, 'skip');
	const noop = selectOsTarget('17.1', v, '17.1.5');
	assert.equal(noop.action, 'skip');
	assert.match((noop as { reason: string }).reason, /OS up to date/);

	// Real-world repro: device is already on the target, but the supported
	// upgrade list excludes the running version and it carries a `.prod`
	// variant suffix. Must report "up to date", not "no eligible release".
	const onTarget = selectOsTarget(
		'6.12.3+rev4',
		{ versions: [], recommended: null },
		'6.12.3+rev4.prod',
	);
	assert.equal(onTarget.action, 'skip');
	assert.match((onTarget as { reason: string }).reason, /OS up to date/);
});

test('selectSupervisorTarget: unset / latest / family / none', () => {
	const r = ['14.13.7', '14.13.6', '14.2.0'];
	assert.equal(selectSupervisorTarget('', r), null);
	assert.equal(selectSupervisorTarget('latest', r), '14.13.7');
	assert.equal(selectSupervisorTarget('14.13', r), '14.13.7');
	assert.equal(selectSupervisorTarget('14.99', r), null);
});

// --- supervisor-converged gate ---------------------------------------------

test('unmanaged supervisor: converged immediately, OS proceeds, no pin', async () => {
	const h = makeHarness();
	const svc = createService(h.sdk, config(), immediate);
	assert.equal(svc.getState().supervisorManaged, false);
	assert.equal(svc.getState().supervisorConverged, true);
	await svc.runMainCycle();
	assert.deepEqual(h.osUpdates, ['5.1.36']);
	assert.deepEqual(h.pin, []);
});

test('managed: supervisor is pinned BEFORE the OS update (ordering)', async () => {
	const h = makeHarness({ supervisor: '17.0.0' });
	const svc = createService(
		h.sdk,
		config({ supervisorTargetVersion: '17.1', userTargetVersion: '5' }),
		immediate,
	);
	assert.equal(svc.getState().supervisorConverged, false);
	// Supervisor pin makes the device converge to the target.
	h.state.supervisor = '17.0.0';
	const sup = svc.runSupervisorCycle().then(() => {
		h.state.supervisor = '17.1.5';
	});
	await Promise.all([svc.runMainCycle(), sup]);
	assert.deepEqual(h.pin, ['17.1.5']);
	assert.deepEqual(h.osUpdates, ['5.1.36']);
	assert.ok(
		h.order.indexOf('pin') < h.order.indexOf('startOsUpdate'),
		`pin must precede startOsUpdate, got ${h.order.join(',')}`,
	);
});

test('managed but already up to date: no pin, converged, OS proceeds', async () => {
	const h = makeHarness({
		supervisor: '17.1.5',
		supervisorReleases: ['17.1.5'],
	});
	const svc = createService(
		h.sdk,
		config({ supervisorTargetVersion: '17.1', userTargetVersion: '5' }),
		immediate,
	);
	await svc.runSupervisorCycle();
	assert.equal(svc.getState().supervisorConverged, true);
	await svc.runMainCycle();
	assert.deepEqual(h.pin, []);
	assert.deepEqual(h.osUpdates, ['5.1.36']);
});

test('convergence cap forces progress so OS is not blocked forever', async () => {
	const h = makeHarness({
		supervisor: '17.0.0',
		supervisorReleases: ['17.1.5', '17.0.0'],
	});
	// supervisor never reaches target.
	const svc = createService(
		h.sdk,
		config({ supervisorTargetVersion: '17.1', userTargetVersion: '5' }),
		immediate,
	);
	await svc.runSupervisorCycle();
	assert.deepEqual(h.pin, ['17.1.5']);
	assert.equal(svc.getState().supervisorConverged, true);
});
