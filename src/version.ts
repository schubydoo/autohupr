/**
 * Pure version-family resolution. No SDK / IO so it is trivially unit-testable.
 *
 * A user-supplied target is a *family selector*: the components they give are
 * locked, anything more specific floats to the highest available release in
 * that family. `17.1` tracks the newest `17.1.x` (never `17.2`); `17` tracks
 * the newest `17.x`; `17.1.1` pins that patch (floating to its highest rev);
 * an explicit `+revN` is an exact pin.
 */

export interface ParsedVersion {
	core: number[];
	rev: number;
}

const REV_RE = /rev-?(\d+)/i;
const CORE_RE = /^(\d+(?:\.\d+)*)/;

const splitCore = (value: string): number[] => {
	const trimmed = value.trim().replace(/^v/i, '');
	const match = CORE_RE.exec(trimmed);
	return match ? match[1].split('.').map((n) => Number(n)) : [];
};

const extractRev = (value: string): number | null => {
	const match = REV_RE.exec(value);
	return match ? Number(match[1]) : null;
};

/** Parse a concrete release string into a comparable `{ core, rev }`. */
export const parseVersion = (value: string): ParsedVersion => ({
	core: splitCore(value),
	rev: extractRev(value) ?? 0,
});

export interface ParsedUserValue {
	/** Locked numeric prefix (1–3 components); empty if not a version. */
	prefix: number[];
	/** Explicit rev pin, or null when the rev should float. */
	rev: number | null;
}

/** Parse a user-supplied target value into a family prefix + optional rev pin. */
export const parseUserValue = (value: string): ParsedUserValue => ({
	prefix: splitCore(value),
	rev: extractRev(value),
});

/** Ascending comparator: core components first, then rev as the tiebreaker. */
export const compareParsed = (a: ParsedVersion, b: ParsedVersion): number => {
	const len = Math.max(a.core.length, b.core.length);
	for (let i = 0; i < len; i++) {
		const diff = (a.core[i] ?? 0) - (b.core[i] ?? 0);
		if (diff !== 0) {
			return diff;
		}
	}
	return a.rev - b.rev;
};

const matchesPrefix = (core: number[], prefix: number[]): boolean =>
	core.length >= prefix.length && prefix.every((p, i) => core[i] === p);

/**
 * Pick the highest release in `candidates` belonging to the family described
 * by `userValue`. Returns the original candidate string, or null when nothing
 * in the supported set matches the family (caller should then skip — never a
 * forced cross-family jump). `latest`/`recommended` are handled by callers.
 */
export const resolveFamily = (
	userValue: string,
	candidates: readonly string[],
): string | null => {
	const { prefix, rev } = parseUserValue(userValue);
	if (prefix.length === 0) {
		return null;
	}

	let best: { raw: string; parsed: ParsedVersion } | null = null;
	for (const raw of candidates) {
		const parsed = parseVersion(raw);
		if (!matchesPrefix(parsed.core, prefix)) {
			continue;
		}
		if (rev !== null) {
			const exactCore =
				parsed.core.length === prefix.length &&
				prefix.every((p, i) => parsed.core[i] === p);
			if (!exactCore || parsed.rev !== rev) {
				continue;
			}
		}
		if (best === null || compareParsed(parsed, best.parsed) > 0) {
			best = { raw, parsed };
		}
	}
	return best ? best.raw : null;
};
