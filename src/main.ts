import { getSdk } from 'balena-sdk';
// ms is pinned to 3.0.0-canary.1: StringValue type is only exported by 3.x,
// and 3.x has no stable release yet.
import type { StringValue } from 'ms';
import ms from 'ms';

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

const apiKey = (process.env.BALENA_API_KEY as unknown as string) ?? undefined;
const apiUrl = (process.env.BALENA_API_URL as unknown as string) ?? undefined;
const deviceUuid =
	(process.env.BALENA_DEVICE_UUID as unknown as string) ?? undefined;

const checkInterval =
	(process.env.HUP_CHECK_INTERVAL as unknown as StringValue) ?? '1d';

const userTargetVersion =
	(process.env.HUP_TARGET_VERSION as unknown as string) ?? '';

const supervisorTargetVersion =
	(process.env.SUPERVISOR_TARGET_VERSION as unknown as string) ?? '';

const supervisorCheckInterval =
	(process.env.SUPERVISOR_CHECK_INTERVAL as unknown as StringValue) ?? '1d';

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

const balena = getSdk({
	apiUrl,
	dataDirectory: '/tmp/work',
});

const delay = (value: StringValue) => {
	const millis = ms(value);
	return new Promise<void>((resolve) => {
		setTimeout(() => {
			resolve();
		}, millis);
	});
};

const getExpandedProp = <T extends object, K extends keyof T>(
	obj: T[] | null | undefined,
	key: K,
): T[K] | undefined => (Array.isArray(obj) ? obj[0]?.[key] : undefined);

const getDeviceType = async (uuid: string): Promise<string> => {
	return await balena.models.device
		.get(uuid, { $expand: { is_of__device_type: { $select: 'slug' } } })
		.then((device) => {
			return getExpandedProp(
				device.is_of__device_type as Array<{ slug: string }>,
				'slug',
			)!;
		});
};

const getDeviceVersion = async (uuid: string): Promise<string> => {
	return await balena.models.device.get(uuid).then((device) => {
		return balena.models.device.getOsVersion(device);
	});
};

const getTargetVersion = async (
	deviceType: string,
	deviceVersion: string,
): Promise<string | null> => {
	return await balena.models.os
		.getSupportedOsUpdateVersions(deviceType, deviceVersion)
		.then((osUpdateVersions) => {
			if (userTargetVersion === '') {
				console.log(
					'HUP_TARGET_VERSION must be set to perform automatic updates.',
				);
				return null;
			} else {
				if (['recommended', 'latest'].includes(userTargetVersion)) {
					return osUpdateVersions.recommended!;
				} else {
					return (
						osUpdateVersions.versions.find((version: string) =>
							version.includes(userTargetVersion),
						) ?? null
					);
				}
			}
		});
};

const getCpuArchSlug = async (uuid: string): Promise<string> => {
	const device = await balena.models.device.get(uuid, {
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
	return getExpandedProp(arch, 'slug')!;
};

const getTargetSupervisorVersion = async (
	uuid: string,
): Promise<string | null> => {
	if (['recommended', 'latest'].includes(supervisorTargetVersion)) {
		const arch = await getCpuArchSlug(uuid);
		if (!arch) {
			return null;
		}
		const releases =
			await balena.models.os.getSupervisorReleasesForCpuArchitecture(arch, {
				$select: ['raw_version'],
			});
		return (releases as Array<{ raw_version: string }>)[0]?.raw_version ?? null;
	}
	return supervisorTargetVersion;
};

/** Retrieve device model for status of HUP properties. */
const getUpdateStatus = async (uuid: string): Promise<HupStatus> => {
	try {
		const hupProps = await balena.models.device.get(uuid, {
			$select: ['status', 'provisioning_state', 'provisioning_progress'],
		});
		console.log(`Device HUP status: ${JSON.stringify(hupProps)}`);

		const status = hupProps.status?.toLowerCase();
		if (status === 'configuring') {
			if (hupProps.provisioning_state === 'OS update failed') {
				return HupStatus.FAILED;
			} else {
				return HupStatus.RUNNING;
			}
		} else if (status === 'idle') {
			return HupStatus.NOT_RUNNING;
		} else {
			return HupStatus.DEVICE_BUSY;
		}
	} catch (e) {
		console.error(`Error getting status: ${e}`);
		return HupStatus.UNKNOWN;
	}
};

const main = async () => {
	const delayStates = [
		HupStatus.UNKNOWN,
		HupStatus.RUNNING,
		HupStatus.DEVICE_BUSY,
	];
	while (true) {
		await balena.auth.loginWithToken(apiKey);

		while (!(await balena.models.device.isOnline(deviceUuid))) {
			console.log('Device is offline...');
			await delay('2m');
		}

		console.log('Checking last update status...');
		while (
			await getUpdateStatus(deviceUuid).then((status) =>
				delayStates.includes(status),
			)
		) {
			console.log('Another update may be in progress...');
			await delay('2m');
		}

		const deviceType = await getDeviceType(deviceUuid);
		const deviceVersion = await getDeviceVersion(deviceUuid);

		console.log(
			`Getting recommended releases for ${deviceType} at ${deviceVersion}...`,
		);

		const targetVersion = await getTargetVersion(deviceType, deviceVersion);

		if (!targetVersion) {
			console.log(`No releases found!`);
		} else {
			console.log(`Starting balenaOS host update to ${targetVersion}...`);
			await balena.models.device
				.startOsUpdate(deviceUuid, targetVersion, { runDetached: true })
				.then(async () => {
					// Allow time for server to start HUP on device, which then
					// sets Configuring status.
					await delay('20s');
					while (
						// Print progress at regular intervals while API indicates
						// HUP still may be running.
						await getUpdateStatus(deviceUuid).then(
							(status) =>
								status === HupStatus.UNKNOWN || status === HupStatus.RUNNING,
						)
					) {
						await delay('20s');
					}
				})
				.catch((e) => {
					console.error(e);
				});
		}

		// both success and failure should wait x before trying/checking again
		console.log(`Will try again in ${checkInterval}...`);
		await delay(checkInterval);
	}
};

const supervisorLoop = async () => {
	if (!supervisorTargetVersion) {
		return;
	}
	while (true) {
		try {
			await balena.auth.loginWithToken(apiKey);

			while (!(await balena.models.device.isOnline(deviceUuid))) {
				console.log('Device is offline (supervisor loop)...');
				await delay('2m');
			}

			const current = (
				await balena.models.device.get(deviceUuid, {
					$select: ['supervisor_version'],
				})
			).supervisor_version;
			const target = await getTargetSupervisorVersion(deviceUuid);

			if (target && target !== current) {
				console.log(`Pinning supervisor: ${current} -> ${target}`);
				await balena.models.device.pinToSupervisorRelease(deviceUuid, target);
			} else {
				console.log(
					`Supervisor up to date at ${current} (target ${target ?? 'unknown'}).`,
				);
			}
		} catch (e) {
			console.error(`Supervisor loop error: ${e}`);
		}

		console.log(`Will check supervisor again in ${supervisorCheckInterval}...`);
		await delay(supervisorCheckInterval);
	}
};

console.log('Starting up...');
main().catch((e) => {
	console.error(e);
});
supervisorLoop().catch((e) => {
	console.error(e);
});
