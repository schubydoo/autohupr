import test from 'node:test';
import assert from 'node:assert/strict';
import {
	compareParsed,
	parseUserValue,
	parseVersion,
	resolveFamily,
	satisfiesTarget,
	versionsEqual,
} from '../src/version';

const OS = ['17.2.0', '17.1.5', '17.1.5+rev2', '17.10.0', '17.1.4'];

test('resolveFamily: locked prefix floats patch+rev to the highest', () => {
	assert.equal(resolveFamily('17.1', OS), '17.1.5+rev2');
	assert.equal(resolveFamily('17', OS), '17.10.0');
	assert.equal(resolveFamily('17.1.4', OS), '17.1.4');
});

test('resolveFamily: 17.1 must NOT match 17.10.x (substring regression)', () => {
	assert.notEqual(resolveFamily('17.1', OS), '17.10.0');
	assert.equal(resolveFamily('17.1', ['17.10.0', '17.10.9']), null);
});

test('resolveFamily: explicit +rev is an exact pin', () => {
	assert.equal(resolveFamily('17.1.5+rev2', OS), '17.1.5+rev2');
	assert.equal(resolveFamily('17.1.5+rev1', OS), null);
	assert.equal(resolveFamily('17.1.5rev2', OS), '17.1.5+rev2');
});

test('resolveFamily: no eligible release in family returns null', () => {
	assert.equal(resolveFamily('17.3', OS), null);
	assert.equal(resolveFamily('2.17.1', OS), null);
	assert.equal(resolveFamily('17.1', []), null);
});

test('resolveFamily: latest/recommended are not version families', () => {
	assert.equal(resolveFamily('latest', OS), null);
	assert.equal(resolveFamily('recommended', OS), null);
});

test('resolveFamily: supervisor-style plain X.X.X candidates', () => {
	const sup = ['14.13.7', '14.13.6', '14.12.0', '14.2.0'];
	assert.equal(resolveFamily('14.13', sup), '14.13.7');
	assert.equal(resolveFamily('14', sup), '14.13.7');
	assert.equal(resolveFamily('14.13.6', sup), '14.13.6');
	assert.equal(resolveFamily('14.99', sup), null);
});

test('parseVersion: core + rev extraction', () => {
	assert.deepEqual(parseVersion('17.1.5+rev2'), { core: [17, 1, 5], rev: 2 });
	assert.deepEqual(parseVersion('2.29.2+rev1.prod'), {
		core: [2, 29, 2],
		rev: 1,
	});
	assert.deepEqual(parseVersion('14.13.7'), { core: [14, 13, 7], rev: 0 });
	assert.deepEqual(parseVersion('garbage'), { core: [], rev: 0 });
});

test('parseUserValue: prefix length + optional rev pin', () => {
	assert.deepEqual(parseUserValue('17'), { prefix: [17], rev: null });
	assert.deepEqual(parseUserValue('17.1'), { prefix: [17, 1], rev: null });
	assert.deepEqual(parseUserValue('17.1.1+rev3'), {
		prefix: [17, 1, 1],
		rev: 3,
	});
	assert.deepEqual(parseUserValue('latest'), { prefix: [], rev: null });
});

test('versionsEqual: variant suffix is ignored', () => {
	assert.equal(versionsEqual('6.12.3+rev4', '6.12.3+rev4.prod'), true);
	assert.equal(versionsEqual('v6.12.3+rev4', '6.12.3+rev4'), true);
	assert.equal(versionsEqual('6.12.3+rev4', '6.12.3+rev5'), false);
	assert.equal(versionsEqual('6.12.3', '6.12.4'), false);
});

test('satisfiesTarget: running version matched family-aware', () => {
	assert.equal(satisfiesTarget('6.12.3+rev4', '6.12.3+rev4.prod'), true);
	assert.equal(satisfiesTarget('6.12.3', '6.12.3+rev4.prod'), true);
	assert.equal(satisfiesTarget('6.12.3+rev4', '6.12.3+rev5.prod'), false);
	assert.equal(satisfiesTarget('6.13', '6.12.3+rev4.prod'), false);
});

test('compareParsed: core then rev ordering', () => {
	assert.ok(
		compareParsed({ core: [17, 10, 0], rev: 0 }, { core: [17, 2, 0], rev: 0 }) >
			0,
	);
	assert.ok(
		compareParsed({ core: [17, 1, 5], rev: 2 }, { core: [17, 1, 5], rev: 0 }) >
			0,
	);
	assert.equal(
		compareParsed({ core: [5, 1, 36], rev: 0 }, { core: [5, 1, 36], rev: 0 }),
		0,
	);
});
