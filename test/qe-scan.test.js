import { test } from 'node:test';
import assert from 'node:assert/strict';
import { needsScan, summarise, mergeRecords, listedRepos, TOOL } from '../scripts/qe-scan.mjs';

const NOW = Date.parse('2026-10-10T00:00:00Z');
const DAY = 86400000;

test('a new release is scanned; the same release is not scanned twice', () => {
  assert.equal(needsScan(undefined, { kind: 'release', ref: 'v1.0.0' }, NOW), true);
  assert.equal(needsScan({ kind: 'release', ref: 'v1.0.0', scanned_at: '2026-10-09T00:00:00Z', tool: TOOL }, { kind: 'release', ref: 'v1.0.0' }, NOW), false);
  assert.equal(needsScan({ kind: 'release', ref: 'v1.0.0', scanned_at: '2026-10-09T00:00:00Z', tool: TOOL }, { kind: 'release', ref: 'v1.1.0' }, NOW), true);
});

test('a repo with no releases is scanned once, then at most every 30 days', () => {
  const latest = { kind: 'branch', ref: 'main' };
  assert.equal(needsScan(undefined, latest, NOW), true);
  assert.equal(needsScan({ kind: 'branch', ref: 'main', scanned_at: new Date(NOW - 29 * DAY).toISOString(), tool: TOOL }, latest, NOW), false);
  assert.equal(needsScan({ kind: 'branch', ref: 'main', scanned_at: new Date(NOW - 31 * DAY).toISOString(), tool: TOOL }, latest, NOW), true);
});

test('a scanner version change forces a rescan', () => {
  assert.equal(needsScan({ kind: 'release', ref: 'v1', scanned_at: '2026-10-09T00:00:00Z', tool: 'agentic-qe@0.0.1' }, { kind: 'release', ref: 'v1' }, NOW), true);
});

test('an unresolvable repo is never scanned', () => {
  assert.equal(needsScan(undefined, null, NOW), false);
});

// Shape taken from the 2026-10-09 probe of RobLe3/IICP@v1.10.17.
const PROBE = {
  vulnerabilities: [{ severity: 'critical', type: 'Potential AWS Secret Key Detected', file: '/home/runner/work/x/target/run.mjs', line: 6, message: 'Potential hardcoded AWS Secret Access Key found [CWE-798]' }],
  status: 'partial',
  coverage: { filesScanned: 5, linesScanned: 746, rulesApplied: 35 },
  evidence: { requestedFiles: 125, completeness: 'partial' },
};

test('the public record carries counts and coverage, never paths, types or severities', () => {
  const r = summarise(PROBE, { repo: 'RobLe3/IICP', ref: 'v1.10.17', kind: 'release', now: NOW });
  assert.deepEqual(r, {
    repo: 'RobLe3/IICP', ref: 'v1.10.17', kind: 'release', tool: TOOL,
    scanned_at: '2026-10-10T00:00:00.000Z', status: 'partial',
    files_scanned: 5, files_requested: 125, findings: 1, advisory: true,
  });
  const s = JSON.stringify(r);
  for (const leak of ['/home/runner', 'AWS', 'critical', 'CWE-798', 'run.mjs']) assert.ok(!s.includes(leak), leak);
});

test('a scan that read nothing says so instead of reporting clean', () => {
  const r = summarise({ vulnerabilities: [], status: 'none', coverage: { filesScanned: 0 }, evidence: { requestedFiles: 139 } }, { repo: 'a/b', ref: 'v0.7', kind: 'release', now: NOW });
  assert.equal(r.status, 'not-analysed');
  assert.equal(r.findings, 0);
});

test('missing or broken scanner output is recorded as an error, not as clean', () => {
  assert.equal(summarise(null, { repo: 'a/b', ref: 'main', kind: 'branch', now: NOW }).status, 'error');
  assert.equal(summarise({}, { repo: 'a/b', ref: 'main', kind: 'branch', now: NOW }).status, 'error');
});

test('merge keeps the latest record per repo and drops repos no longer listed', () => {
  const state = { 'a/b': { repo: 'a/b', ref: 'v1' }, 'gone/x': { repo: 'gone/x', ref: 'v1' } };
  const out = mergeRecords(state, [{ repo: 'a/b', ref: 'v2' }, { repo: 'c/d', ref: 'v1' }], ['a/b', 'c/d']);
  assert.deepEqual(Object.keys(out).sort(), ['a/b', 'c/d']);
  assert.equal(out['a/b'].ref, 'v2');
});

test('listed repos = curated plus pending, de-duplicated, owner/name only', () => {
  const m = { curated: [{ name: 'a/b' }, { name: 'c/d' }], pending: [{ name: 'c/d' }, { name: 'e/f' }, { name: 'not a repo' }] };
  assert.deepEqual(listedRepos(m), ['a/b', 'c/d', 'e/f']);
});

import { qeAdvisoryText } from '../docs/qe-advisory.mjs';

test('the matrix line states coverage before findings, and calls itself advisory', () => {
  const t = qeAdvisoryText({ ref: 'v1.10.17', kind: 'release', status: 'partial', files_scanned: 5, files_requested: 125, findings: 1, scanned_at: '2026-10-10T00:00:00Z' });
  assert.match(t, /^Advisory/);
  assert.match(t, /v1\.10\.17/);
  assert.match(t, /5 of 125 files/);
  assert.match(t, /1 unverified finding\b/);
  assert.ok(t.indexOf('5 of 125') < t.indexOf('finding'));
});

test('a scan that read nothing is shown as not analysed, never as clean', () => {
  const t = qeAdvisoryText({ ref: 'main', kind: 'branch', status: 'not-analysed', files_scanned: 0, files_requested: 139, findings: 0, scanned_at: '2026-10-10T00:00:00Z' });
  assert.match(t, /not analysed/i);
  assert.doesNotMatch(t, /\b(clean|no findings|0 findings|passed)\b/i);
});

test('no record and error records render honestly', () => {
  assert.match(qeAdvisoryText(undefined), /not yet scanned/i);
  assert.match(qeAdvisoryText({ status: 'error', ref: 'main', kind: 'branch', scanned_at: '2026-10-10T00:00:00Z' }), /did not complete/i);
});

test('the advisory text escapes repository-controlled refs', () => {
  const t = qeAdvisoryText({ ref: '<img src=x onerror=alert(1)>', kind: 'release', status: 'partial', files_scanned: 1, files_requested: 1, findings: 0, scanned_at: '2026-10-10T00:00:00Z' });
  assert.ok(!t.includes('<img'));
});
