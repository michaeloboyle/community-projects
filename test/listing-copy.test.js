// Chair decision 2026-10-09: committee review is optional for listings.
// A submission in the matrix is LISTED; review adds a mark, it is not a gate.
// These tests pin the reader-facing wording so the waiting-room framing
// ("awaiting committee promotion") cannot creep back in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const SURFACES = [
  'docs/oia-matrix.html',
  'docs/data/oia-matrix.json',
  'scripts/extract-oia-matrix.mjs',
  'scripts/oia-intake-step.mjs',
  'scripts/classify-oia.mjs',
  '.github/ISSUE_TEMPLATE/project-submission.yml',
];

test('no reader-facing surface frames a listing as waiting for promotion', () => {
  for (const p of SURFACES) {
    assert.doesNotMatch(read(p), /awaiting (committee )?promotion|before (it is )?promot|under <b>pending review/i, p);
  }
});

test('the matrix page names the band "Listed, not yet reviewed"', () => {
  assert.match(read('docs/oia-matrix.html'), /Listed, not yet reviewed/);
});

test('the intake comment still starts with the idempotency marker', async () => {
  const { PENDING_MARKER } = await import('../scripts/oia-intake-step.mjs');
  assert.match(read('scripts/oia-intake-step.mjs'), /'### Added to the OIA Application Matrix \(listed, not yet reviewed\)'/);
  assert.ok('### Added to the OIA Application Matrix (listed, not yet reviewed)'.startsWith(PENDING_MARKER));
});

test('the submission template says review is optional', () => {
  assert.match(read('.github/ISSUE_TEMPLATE/project-submission.yml'), /review is optional/i);
});
