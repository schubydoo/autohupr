#!/bin/sh
set -eu

# Park the container: ask the balena supervisor to stop this service so it does
# not crash-loop, then idle until the supervisor tears it down. The curl may
# fail if the supervisor-api label is absent; we still idle (parked, not
# crash-looping) in that case.
park() {
	echo "autohupr: $1"
	echo "autohupr: requesting supervisor to stop this service..."
	curl --fail --silent --show-error \
		--retry 86400 --retry-delay 1 --retry-all-errors \
		--header "Content-Type: application/json" \
		"${BALENA_SUPERVISOR_ADDRESS:-}/v2/applications/${BALENA_APP_ID:-}/stop-service?apikey=${BALENA_SUPERVISOR_API_KEY:-}" \
		--data "{\"serviceName\": \"${BALENA_SERVICE_NAME:-}\"}" || true
	exec tail -f /dev/null
}

# Reject anything that does not resolve to a single unit >= 30m (ms/s rejected
# on purpose: too easy to hammer the balena API).
validate_interval() {
	name=$1
	val=$2
	if ! printf '%s' "$val" | grep -Eq '^[0-9]+(m|h|d|w|y)$'; then
		park "$name='$val' is invalid. Use <number><m|h|d|w|y>, minimum 30m."
	fi
	unit=${val#"${val%?}"}
	num=${val%?}
	num=$(printf '%s' "$num" | sed 's/^0*//')
	[ -z "$num" ] && num=0
	case "$unit" in
	m) factor=1 ;;
	h) factor=60 ;;
	d) factor=1440 ;;
	w) factor=10080 ;;
	y) factor=525600 ;;
	esac
	minutes=$((num * factor))
	if [ "$minutes" -lt 30 ]; then
		park "$name='$val' is below the 30m minimum."
	fi
}

validate_version() {
	name=$1
	val=$2
	pattern=$3
	if ! printf '%s' "$val" | grep -Eq "$pattern"; then
		park "$name='$val' is not a valid target (latest, recommended, or X[.X[.X]])."
	fi
}

# 1. Disabled via ENABLED_SERVICES (standard balena block behavior).
if [ -n "${ENABLED_SERVICES:-}" ]; then
	cleaned=$(printf '%s' "$ENABLED_SERVICES" | tr -d '[:space:]')
	case ",$cleaned," in
	*",${BALENA_SERVICE_NAME:-}",*) : ;;
	*) park "${BALENA_SERVICE_NAME:-service} is not in ENABLED_SERVICES." ;;
	esac
fi

# 2. Nothing to do if neither target version is set.
if [ -z "${HUP_TARGET_VERSION:-}" ] && [ -z "${SUPERVISOR_TARGET_VERSION:-}" ]; then
	park "neither HUP_TARGET_VERSION nor SUPERVISOR_TARGET_VERSION is set."
fi

# 3. Sanitize any values that are set.
if [ -n "${HUP_TARGET_VERSION:-}" ]; then
	validate_version HUP_TARGET_VERSION "$HUP_TARGET_VERSION" \
		'^(latest|recommended|[0-9]+(\.[0-9]+){0,2}([+.]?rev-?[0-9]+)?)$'
fi
if [ -n "${SUPERVISOR_TARGET_VERSION:-}" ]; then
	validate_version SUPERVISOR_TARGET_VERSION "$SUPERVISOR_TARGET_VERSION" \
		'^(latest|recommended|[0-9]+(\.[0-9]+){0,2})$'
fi
if [ -n "${HUP_CHECK_INTERVAL:-}" ]; then
	validate_interval HUP_CHECK_INTERVAL "$HUP_CHECK_INTERVAL"
fi
if [ -n "${SUPERVISOR_CHECK_INTERVAL:-}" ]; then
	validate_interval SUPERVISOR_CHECK_INTERVAL "$SUPERVISOR_CHECK_INTERVAL"
fi

exec node ./build/main.js
