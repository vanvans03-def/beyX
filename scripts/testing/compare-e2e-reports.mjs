import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function summarize(report) {
    if (!report || !Array.isArray(report.suites)) throw new Error('Expected a Playwright JSON report with suites.');
    const tests = new Map();
    const walk = (suites, ancestors = []) => {
        for (const suite of suites) {
            const trail = [...ancestors, suite.title];
            for (const spec of suite.specs || []) for (const test of spec.tests || []) {
                const key = `${test.projectName} :: ${[...trail, spec.title].filter(Boolean).join(' / ')}`;
                if (tests.has(key)) throw new Error(`Duplicate report identity: ${key}`);
                tests.set(key, test.status || test.results?.at(-1)?.status || 'unknown');
            }
            walk(suite.suites || [], trail);
        }
    };
    walk(report.suites);
    return tests;
}
export function compareReports(beforeReport, afterReport) {
    const before = summarize(beforeReport), after = summarize(afterReport);
    if (!before.size || !after.size) throw new Error('Cannot compare an empty test run.');
    const newFailures = [], existingFailures = [], fixed = [], missing = [], skipped = [], added = [];
    const good = status => ['expected', 'passed'].includes(status);
    for (const [name, status] of after) {
        if (!before.has(name)) added.push(name);
        if (['skipped', 'unknown'].includes(status)) skipped.push(name);
        else if (!good(status)) (before.has(name) && !good(before.get(name)) ? existingFailures : newFailures).push(name);
        else if (before.has(name) && !good(before.get(name))) fixed.push(name);
    }
    for (const name of before.keys()) if (!after.has(name)) missing.push(name);
    const runErrors = (afterReport.errors || []).length;
    const interrupted = afterReport.stats?.interrupted || 0;
    return { before: before.size, after: after.size, newFailures, existingFailures, fixed, missing, skipped, added, runErrors, interrupted, ready: !newFailures.length && !existingFailures.length && !missing.length && !skipped.length && !runErrors && !interrupted };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        if (process.argv.length !== 4) throw new Error('Usage: npm run test:e2e:compare -- before.json after.json');
        const result = compareReports(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), JSON.parse(fs.readFileSync(process.argv[3], 'utf8')));
        fs.mkdirSync('test-results', { recursive: true }); fs.writeFileSync('test-results/migration-comparison.json', JSON.stringify(result, null, 2));
        console.log(JSON.stringify(result, null, 2)); if (!result.ready) process.exitCode = 1;
    } catch (error) { console.error(error.message); process.exitCode = 1; }
}
