import fs from 'node:fs';

// Preserve each raw run. A focused post-fix rerun supersedes only the exact
// matching project/file/test case; it cannot hide unrelated failing cases.
const sources = ['test-results/motion-regression-results.json', 'test-results/migration-results.json'];
const latest = new Map();
const runs = [];
for (const source of sources) {
    const report = JSON.parse(fs.readFileSync(source, 'utf8'));
    runs.push({ source, stats: report.stats });
    const visit = suite => {
        for (const spec of suite.specs || []) for (const test of spec.tests || []) {
            const result = test.results.at(-1);
            const key = `${spec.file.replaceAll('\\', '/')}:${spec.title}:${test.projectName}`;
            latest.set(key, { file: spec.file, title: spec.title, project: test.projectName,
                status: result?.status || 'not-run', source, duration: result?.duration });
        }
        (suite.suites || []).forEach(visit);
    };
    report.suites.forEach(visit);
}
const cases = [...latest.values()];
const failures = cases.filter(test => test.status !== 'passed');
const summary = { methodology: 'Latest result per exact test case across preserved regression and focused post-fix UI runs; not a single uninterrupted run.',
    runs, total: cases.length, passed: cases.length - failures.length, failedOrNotRun: failures.length, cases };
fs.writeFileSync('test-results/motion-verification-summary.json', JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ total: summary.total, passed: summary.passed, failedOrNotRun: summary.failedOrNotRun }));
if (summary.total !== 104 || failures.length) process.exitCode = 1;
