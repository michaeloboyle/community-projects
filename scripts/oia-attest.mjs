// OIA eval + attestation — runs the heuristic classifier for a repo, prints a
// legible pass/fail gate summary, and appends ONE JSON line to the committed
// attestation log (data/rvf/attestation.jsonl). It is READ-ONLY on the matrix:
// it never writes docs/data/oia-matrix.json, so it can never overwrite or
// downgrade a human-reviewed curated `code ✓` row. Auto-tier augments the
// audit trail; it never replaces a committee review.
//
// Security: classify-oia does GitHub-API reads only (no checkout, no execution
// of the target repo) and sanitizes untrusted description text. Repo names are
// validated against a strict owner/repo charset before any API call.
//
// Usage:
//   node scripts/oia-attest.mjs owner/name [issueNumber] [trigger]  # one repo
//   node scripts/oia-attest.mjs --backfill-curated                  # all curated[]
//   ISSUE_BODY=... ISSUE_NUMBER=... node scripts/oia-attest.mjs      # issue event
import { appendFileSync, readFileSync } from 'node:fs';
import { classify } from './classify-oia.mjs';

const ATTEST_PATH = process.env.ATTESTATION_PATH || 'data/rvf/attestation.jsonl';
const MATRIX_PATH = 'docs/data/oia-matrix.json';
const GATE_KEYS = ['issues', 'docs', 'ADRs', 'PRD', 'infographic'];

// Same strict owner/repo extraction the intake step uses (charset is the
// sanitizer). Kept local so importing this module has no side effects.
function extractRepo(b) {
  const field = String(b || '').match(/###\s*Repository URL\s*\n+\s*(\S+)/i);
  const raw = field ? field[1] : String(b || '');
  const g = raw.match(/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git|[/#?]|$)/i);
  if (g) return g[1];
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(raw.trim()) ? raw.trim() : null;
}

function summaryLine(name, entry) {
  const gate = deriveGate(entry);
  const pass = GATE_KEYS.filter((k) => gate[k]).length;
  const gateStr = GATE_KEYS.map((k) => `${k} ${gate[k] ? '✓' : '✗'}`).join(', ');
  const cog = entry.layers.map((v, i) => (v === 2 ? 'L' + i : null)).filter(Boolean);
  const pres = entry.layers.map((v, i) => (v === 1 ? 'L' + i : null)).filter(Boolean);
  const spans = entry.spans.map((s) => s.label);
  return `OIA eval for ${name}: gate ${pass}/${GATE_KEYS.length} [${gateStr}] | cog [${cog.join(', ') || 'none'}] | presence [${pres.join(', ') || 'none'}] | spans [${spans.join(', ') || 'none'}] | tier ${entry.evidence.t}`;
}

// classify-oia embeds the qualification gate in the evidence note string; parse
// it back into a structured object so the attestation payload is queryable.
function deriveGate(entry) {
  const note = entry.evidence && entry.evidence.n ? entry.evidence.n : '';
  const gate = {};
  for (const k of GATE_KEYS) {
    const m = note.match(new RegExp(k + '\\s*([✓✗])'));
    gate[k] = m ? m[1] === '✓' : false;
  }
  return gate;
}

async function evalOne(name, issue, trigger) {
  let entry;
  try {
    entry = await classify(name, issue, new Date().toISOString().slice(0, 10));
  } catch (e) {
    // Bad/private/missing repo from untrusted input: log, do not fail the run.
    console.log(`OIA eval for ${name}: ERROR ${String(e.message || e)}`);
    return false;
  }
  console.log(summaryLine(name, entry));

  const gate = deriveGate(entry);
  const record = {
    type: 'oia-eval',
    submission_id: issue
      ? `issue-${issue}`
      : `${trigger}-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    repo: name,
    from_state: '',
    to_state: 'oia-classified',
    actor: 'agent',
    timestamp: new Date().toISOString(),
    gdoc_revision: '',
    payload: {
      trigger,
      gate,
      gate_pass_count: GATE_KEYS.filter((k) => gate[k]).length,
      gate_total: GATE_KEYS.length,
      cog: entry.layers.map((v, i) => (v === 2 ? 'L' + i : null)).filter(Boolean),
      presence: entry.layers.map((v, i) => (v === 1 ? 'L' + i : null)).filter(Boolean),
      spans: entry.spans.map((s) => s.label),
      tier: entry.evidence.t,
    },
  };
  appendFileSync(ATTEST_PATH, '\n' + JSON.stringify(record));
  return true;
}

async function main() {
  const [, , arg1, arg2, arg3] = process.argv;

  if (arg1 === '--backfill-curated') {
    // Attestation-only sweep of the 20 curated repos. Reads the matrix but
    // NEVER writes it, so no curated row can be overwritten or downgraded.
    const matrix = JSON.parse(readFileSync(MATRIX_PATH, 'utf8'));
    const names = (matrix.curated || []).map((c) => c.name).filter(Boolean);
    console.log(`OIA backfill: evaluating ${names.length} curated repos (attestation-only, matrix untouched)`);
    let ok = 0;
    for (const n of names) {
      if (await evalOne(n, null, 'backfill')) ok++;
    }
    console.log(`OIA backfill: ${ok}/${names.length} evaluated and attested`);
    return;
  }

  // Issue-event path: repo comes from the issue body env; else CLI arg.
  const fromBody = process.env.ISSUE_BODY ? extractRepo(process.env.ISSUE_BODY) : null;
  const name = arg1 || fromBody;
  const issue = arg2 || process.env.ISSUE_NUMBER || null;
  const trigger = arg3 || (process.env.ISSUE_BODY ? 'issues' : 'dispatch');

  if (!name) {
    console.log('OIA eval: no repo resolved (empty CLI arg and no Repository URL in issue body); nothing to do');
    return;
  }
  await evalOne(name, issue, trigger);
}

main().catch((e) => {
  console.error('oia-attest fatal:', String(e));
  process.exit(1);
});
