import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareReports } from './compare-e2e-reports.mjs';
const report = states => ({ suites: [{ title: 'suite', specs: Object.entries(states).map(([title, status]) => ({ title, tests: [{ projectName: 'desktop', status }] })) }] });
test('identical green reports are ready', () => assert.equal(compareReports(report({ a: 'expected' }), report({ a: 'expected' })).ready, true));
test('a skipped or removed test cannot hide a migration regression', () => {
    const result = compareReports(report({ a: 'expected', b: 'expected' }), report({ a: 'skipped' }));
    assert.equal(result.skipped.length, 1); assert.equal(result.missing.length, 1); assert.equal(result.ready, false);
});
test('separates existing defects, new failures and fixes', () => {
    const result = compareReports(report({ old: 'unexpected', fixed: 'unexpected', broken: 'expected' }), report({ old: 'unexpected', fixed: 'expected', broken: 'unexpected' }));
    assert.equal(result.existingFailures.length, 1); assert.equal(result.newFailures.length, 1); assert.equal(result.fixed.length, 1); assert.equal(result.ready, false);
});
test('flaky tests fail the migration gate and empty reports are rejected', () => {
    assert.equal(compareReports(report({ a: 'expected' }), report({ a: 'flaky' })).ready, false);
    assert.throws(() => compareReports(report({}), report({})), /empty/);
});

test('global runner errors and interrupted runs cannot certify migration', () => {
    const before = report({ a: 'expected' });
    assert.equal(compareReports(before, { ...before, errors: [{ message: 'worker teardown failed' }] }).ready, false);
    assert.equal(compareReports(before, { ...before, stats: { interrupted: 1 } }).ready, false);
});
