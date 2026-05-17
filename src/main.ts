import { getSdk, type BalenaSDK } from 'balena-sdk';
// ms is pinned to a 3.x canary: the StringValue type is only exported by 3.x,
// and 3.x has no stable release yet.
import type { StringValue } from 'ms';
import ms from 'ms';
import {
	compareParsed,
	parseVersion,
	resolveFamily,
	satisfiesTarget,
	versionsEqual,
} from './version';

/** Functional state of HUP on device for our purposes. */
enum HupStatus {
	RUNNING,
	FAILED,
	NOT_RUNNING,
	/** Do not anticipate a device in this state; future proofing. */
	DEVICE_BUSY,
	/** For example, can't determine status if can't reach API. */
	UNKNOWN,
}

export interface ServiceConfig {
	apiKey: string;
	deviceUuid: string;
	checkInterval: StringValue;
	supervisorCheckInterval: StringValue;
	userTargetVersion: string;
	supervisorTargetVersion: string;
}

export type DelayFn = (value: StringValue) => Promise<void>;

export interface OsUpdateVersions {
	versions: string[];
	recommended: string | null;
}

export type OsDecision =
	| { action: 'update'; version: string }
	| { action: 'skip'; reason: string };

/**
 * Pure: decide the OS target. `latest`/`recommended` use the API's recommended
 * release; a version family floats to the highest in-family release. Skips
 * (never a forced cross-family jump) when unset, already satisfying the target
 * (compared variant-insensitively against the running version, since the
 * supported-update list excludes the version in use), or no eligible release.
 */
export const selectOsTarget = (
	userTargetVersion: string,
	osUpdateVersions: OsUpdateVersions,
	currentVersion: string,
): OsDecision => {
	if (userTargetVersion === '') {
		return { action: 'skip', reason: 'HUP_TARGET_VERSION not set' };
	}
	const isRecommended =
		userTargetVersion === 'recommended' || userTargetVersion === 'latest';
	const upgradeTarget = isRecommended
		? (osUpdateVersions.recommended ?? null)
		: resolveFamily(userTargetVersion, osUpdateVersions.versions);

	if (upgradeTarget && !versionsEqual(upgradeTarget, currentVersion)) {
		return { action: 'update', version: upgradeTarget };
	}

	const alreadySatisfied = isRecommended
		? osUpdateVersions.recommended != null &&
			versionsEqual(osUpdateVersions.recommended, currentVersion)
		: satisfiesTarget(userTargetVersion, currentVersion);

	if (alreadySatisfied) {
		return {
			action: 'skip',
			reason: `OS up to date at ${currentVersion} (target "${userTargetVersion}")`,
		};
	}
	return {
		action: 'skip',
		reason: `no eligible release for "${userTargetVersion}"`,
	};
};

/**
 * Pure: resolve the supervisor target. `latest`/`recommended` → highest
 * available release (sorted here, not trusting API order); a version family
 * → highest in-family release; null when nothing matches.
 */
export const selectSupervisorTarget = (
	userValue: string,
	releases: readonly string[],
): string | null => {
	if (userValue === '') {
		return null;
	}
	if (userValue === 'recommended' || userValue === 'latest') {
		const sorted = [...releases].sort((a, b) =>
			compareParsed(parseVersion(a), parseVersion(b)),
		);
		return sorted.at(-1) ?? null;
	}
	return resolveFamily(userValue, releases);
};

const getExpandedProp = <T extends object, K extends keyof T>(
	obj: T[] | null | undefined,
	key: K,
): T[K] | undefined => (Array.isArray(obj) ? obj[0]?.[key] : undefined);

const SUPERVISOR_CONVERGE_MAX_POLLS = 30;
const SUPERVISOR_GATE_POLL = '5s' as StringValue;

/**
 * Build the update service. `sdk` and `delayFn` are injected so the loops can
 * be exercised with a fake SDK + fake clock; `shouldContinue` bounds the
 * otherwise-infinite loops/waits in tests (defaults to forever in production).
 */
export const createService = (
	sdk: BalenaSDK,
	config: ServiceConfig,
	delayFn: DelayFn,
	shouldContinue: () => boolean = () => true,
) => {
	const { apiKey, deviceUuid } = config;
	const supervisorManaged = config.supervisorTargetVersion !== '';
	let supervisorConverged = !supervisorManaged;

	const delayStates = [
		HupStatus.UNKNOWN,
		HupStatus.RUNNING,
		HupStatus.DEVICE_BUSY,
	];

	const getDeviceType = async (uuid: string): Promise<string> => {
		const device = await sdk.models.device.get(uuid, {
			$expand: { is_of__device_type: { $select: 'slug' } },
		});
		return getExpandedProp(
			device.is_of__device_type as Array<{ slug: string }>,
			'slug',
		)!;
	};

	const getDeviceVersion = async (uuid: string): Promise<string> => {
		const device = await sdk.models.device.get(uuid);
		return sdk.models.device.getOsVersion(device);
	};

	const getOsUpdateVersions = async (
		deviceType: string,
		deviceVersion: string,
	): Promise<OsUpdateVersions> => {
		const result = await sdk.models.os.getSupportedOsUpdateVersions(
			deviceType,
			deviceVersion,
		);
		return {
			versions: result.versions,
			recommended: result.recommended ?? null,
		};
	};

	const getCpuArchSlug = async (uuid: string): Promise<string | undefined> => {
		const device = await sdk.models.device.get(uuid, {
			$expand: {
				is_of__device_type: {
					$select: 'slug',
					$expand: { is_of__cpu_architecture: { $select: 'slug' } },
				},
			},
		});
		const arch = getExpandedProp(
			device.is_of__device_type as Array<{
				is_of__cpu_architecture: Array<{ slug: string }>;
			}>,
			'is_of__cpu_architecture',
		);
		return getExpandedProp(arch, 'slug');
	};

	const getSupervisorReleases = async (uuid: string): Promise<string[]> => {
		const arch = await getCpuArchSlug(uuid);
		if (!arch) {
			return [];
		}
		const releases =
			await sdk.models.os.getSupervisorReleasesForCpuArchitecture(arch, {
				$select: ['raw_version'],
			});
		return (releases as Array<{ raw_version: string }>).map(
			(r) => r.raw_version,
		);
	};

	const getCurrentSupervisor = async (
		uuid: string,
	): Promise<string | undefined> => {
		const device = await sdk.models.device.get(uuid, {
			$select: ['supervisor_version'],
		});
		return device.supervisor_version ?? undefined;
	};

	const getUpdateStatus = async (uuid: string): Promise<HupStatus> => {
		try {
			const hupProps = await sdk.models.device.get(uuid, {
				$select: ['status', 'provisioning_state', 'provisioning_progress'],
			});
			console.log(`Device HUP status: ${JSON.stringify(hupProps)}`);
			const status = hupProps.status?.toLowerCase();
			if (status === 'configuring') {
				return hupProps.provisioning_state === 'OS update failed'
					? HupStatus.FAILED
					: HupStatus.RUNNING;
			}
			if (status === 'idle') {
				return HupStatus.NOT_RUNNING;
			}
			return HupStatus.DEVICE_BUSY;
		} catch (e) {
			console.error(`Error getting status: ${e}`);
			return HupStatus.UNKNOWN;
		}
	};

	const waitUntilOnline = async (label: string): Promise<void> => {
		while (
			shouldContinue() &&
			!(await sdk.models.device.isOnline(deviceUuid))
		) {
			console.log(`Device is offline${label}...`);
			await delayFn('2m');
		}
	};

	const awaitConvergence = async (target: string): Promise<void> => {
		supervisorConverged = false;
		for (
			let i = 0;
			i < SUPERVISOR_CONVERGE_MAX_POLLS && shouldContinue();
			i++
		) {
			await delayFn('2m');
			if ((await getCurrentSupervisor(deviceUuid)) === target) {
				supervisorConverged = true;
				return;
			}
		}
		console.warn(
			`Supervisor did not reach ${target} after ${SUPERVISOR_CONVERGE_MAX_POLLS} polls; proceeding so OS updates are not blocked.`,
		);
		supervisorConverged = true;
	};

	const runSupervisorCycle = async (): Promise<void> => {
		try {
			await sdk.auth.loginWithToken(apiKey);
			await waitUntilOnline(' (supervisor loop)');

			const current = await getCurrentSupervisor(deviceUuid);
			const releases = await getSupervisorReleases(deviceUuid);
			const target = selectSupervisorTarget(
				config.supervisorTargetVersion,
				releases,
			);

			if (target && target !== current) {
				console.log(`Pinning supervisor: ${current} -> ${target}`);
				await sdk.models.device.pinToSupervisorRelease(deviceUuid, target);
				await awaitConvergence(target);
			} else {
				console.log(
					`Supervisor up to date at ${current} (target ${target ?? 'unknown'}).`,
				);
				supervisorConverged = true;
			}
		} catch (e) {
			console.error(`Supervisor loop error: ${e}`);
		}
		console.log(
			`Will check supervisor again in ${config.supervisorCheckInterval}...`,
		);
		await delayFn(config.supervisorCheckInterval);
	};

	const runMainCycle = async (): Promise<void> => {
		await sdk.auth.loginWithToken(apiKey);
		await waitUntilOnline('');

		console.log('Checking last update status...');
		while (
			shouldContinue() &&
			delayStates.includes(await getUpdateStatus(deviceUuid))
		) {
			console.log('Another update may be in progress...');
			await delayFn('2m');
		}

		// Supervisor updates run first: the supported OS target depends on the
		// settled supervisor version.
		if (supervisorManaged && !supervisorConverged && shouldContinue()) {
			console.log(
				'Waiting for supervisor to converge before checking OS updates...',
			);
			while (supervisorManaged && !supervisorConverged && shouldContinue()) {
				await delayFn(SUPERVISOR_GATE_POLL);
			}
		}

		const deviceType = await getDeviceType(deviceUuid);
		const deviceVersion = await getDeviceVersion(deviceUuid);
		console.log(`Getting releases for ${deviceType} at ${deviceVersion}...`);

		const decision = selectOsTarget(
			config.userTargetVersion,
			await getOsUpdateVersions(deviceType, deviceVersion),
			deviceVersion,
		);

		if (decision.action === 'skip') {
			console.log(`Skipping OS update: ${decision.reason}.`);
		} else {
			console.log(`Starting balenaOS host update to ${decision.version}...`);
			await sdk.models.device
				.startOsUpdate(deviceUuid, decision.version, { runDetached: true })
				.then(async () => {
					// Allow time for server to start HUP on device, which then
					// sets Configuring status.
					await delayFn('20s');
					while (
						shouldContinue() &&
						[HupStatus.UNKNOWN, HupStatus.RUNNING].includes(
							await getUpdateStatus(deviceUuid),
						)
					) {
						await delayFn('20s');
					}
				})
				.catch((e) => {
					console.error(e);
				});
		}

		console.log(`Will try again in ${config.checkInterval}...`);
		await delayFn(config.checkInterval);
	};

	const main = async (): Promise<void> => {
		while (shouldContinue()) {
			await runMainCycle();
		}
	};

	const supervisorLoop = async (): Promise<void> => {
		if (!supervisorManaged) {
			return;
		}
		while (shouldContinue()) {
			await runSupervisorCycle();
		}
	};

	return {
		main,
		supervisorLoop,
		runMainCycle,
		runSupervisorCycle,
		awaitConvergence,
		getState: () => ({ supervisorManaged, supervisorConverged }),
	};
};

const delay: DelayFn = (value) =>
	new Promise<void>((resolve) => {
		setTimeout(resolve, ms(value));
	});

const bootstrap = (): void => {
	const apiKey = process.env.BALENA_API_KEY ?? '';
	const apiUrl = process.env.BALENA_API_URL ?? '';
	const deviceUuid = process.env.BALENA_DEVICE_UUID ?? '';

	if (!apiKey) {
		console.error('BALENA_API_KEY required in environment');
		process.exit(1);
	}
	if (!apiUrl) {
		console.error('BALENA_API_URL required in environment');
		process.exit(1);
	}
	if (!deviceUuid) {
		console.error('BALENA_DEVICE_UUID required in environment');
		process.exit(1);
	}

	const sdk = getSdk({ apiUrl, dataDirectory: '/tmp/work' });
	const config: ServiceConfig = {
		apiKey,
		deviceUuid,
		checkInterval: (process.env.HUP_CHECK_INTERVAL as StringValue) ?? '1d',
		supervisorCheckInterval:
			(process.env.SUPERVISOR_CHECK_INTERVAL as StringValue) ?? '1d',
		userTargetVersion: process.env.HUP_TARGET_VERSION ?? '',
		supervisorTargetVersion: process.env.SUPERVISOR_TARGET_VERSION ?? '',
	};

	const service = createService(sdk, config, delay);
	console.log('Starting up...');
	service.main().catch((e) => {
		console.error(e);
	});
	service.supervisorLoop().catch((e) => {
		console.error(e);
	});
};

if (require.main === module) {
	bootstrap();
}
