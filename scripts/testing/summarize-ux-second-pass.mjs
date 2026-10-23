import fs from 'node:fs';

const sources = ['test-results/ux-second-pass-initial.json', 'test-results/ux-second-pass-focused.json', 'test-results/ux-second-pass-final.json', 'test-results/ux-second-pass-auth-final.json'];
const latest = new Map();
const runs = [];
for (const source of sources) {
    const report = JSON.parse(fs.readFileSync(source, 'utf8'));
    runs.push({ source, stats: report.stats });
    const visit = suite => {
        for (const spec of suite.specs || []) for (const test of spec.tests || []) {
            const result = test.results.at(-1);
            const key = `${spec.file.replaceAll('\\', '/')}:${spec.title}:${test.projectName}`;
            latest.set(key, { file: spec.file, title: spec.title, project: test.projectName, source, status: result?.status || 'not-run' });
        }
        (suite.suites || []).forEach(visit);
    };
    report.suites.forEach(visit);
}
const cases = [...latest.values()];
const failures = cases.filter(test => test.status !== 'passed');
const summary = { methodology: 'Latest result per exact case across preserved broad/focused/post-loading-fix runs; not one uninterrupted run.', runs, total: cases.length, passed: cases.length - failures.length, failed: failures.length, cases };
fs.writeFileSync('test-results/ux-second-pass-summary.json', JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ total: summary.total, passed: summary.passed, failed: summary.failed }));
if (summary.total !== 33 || failures.length) process.exitCode = 1;
