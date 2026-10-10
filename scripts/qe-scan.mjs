// Per-release QE scan of every repository listed in the OIA Application Matrix,
// using Dragan Spiridonov's agentic-qe (Serbian Agentics Foundation chapter).
//
// ADVISORY ONLY. A keyless probe on 2026-10-09 scanned 5 of 125 files on one
// repo, 0 files on two Rust repos, and reported a git commit hash as a
// "critical" AWS secret. Until a calibrated configuration shows useful coverage,
// these results never gate a listing and never publish paths, finding types or
// severities. The full scanner output stays in the workflow artifact.
//
// Modes (import-safe; the CLI runs only when executed directly):
//   node scripts/qe-scan.mjs plan [max]            -> JSON array of {repo, ref, kind} to stdout
//   node scripts/qe-scan.mjs summarise <repo> <ref> <kind> <sast.json> <out.json>
//   node scripts/qe-scan.mjs merge <records-dir>   -> updates docs/data/qe-scans.json
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const TOOL = 'agentic-qe@3.15.0';
export const BRANCH_RESCAN_DAYS = 30;
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const MATRIX = 'docs/data/oia-matrix.json';
const STATE = 'docs/data/qe-scans.json';

export function listedRepos(matrix) {
  const names = [...(matrix.curated || []), ...(matrix.pending || [])].map((r) => r && r.name);
  return [...new Set(names.filter((n) => typeof n === 'string' && REPO_RE.test(n)))];
}

// latest: {kind:'release'|'branch', ref} or null when the repo cannot be resolved.
export function needsScan(prev, latest, now = Date.now()) {
  if (!latest) return false;
  if (!prev || prev.tool !== TOOL || prev.kind !== latest.kind) return true;
  if (latest.kind === 'release') return prev.ref !== latest.ref;
  const age = now - Date.parse(prev.scanned_at || 0);
  return !(age < BRANCH_RESCAN_DAYS * 86400000);
}

export function summarise(sast, { repo, ref, kind, now = Date.now() }) {
  const base = { repo, ref, kind, tool: TOOL, scanned_at: new Date(now).toISOString() };
  const cov = sast && sast.coverage;
  if (!sast || !cov || typeof cov.filesScanned !== 'number') {
    return { ...base, status: 'error', files_scanned: 0, files_requested: 0, findings: 0, advisory: true };
  }
  const findings = Array.isArray(sast.vulnerabilities) ? sast.vulnerabilities.length : 0;
  const scanned = cov.filesScanned;
  return {
    ...base,
    status: scanned === 0 ? 'not-analysed' : String(sast.status || 'unknown'),
    files_scanned: scanned,
    files_requested: Number(sast.evidence?.requestedFiles ?? 0),
    findings,
    advisory: true,
  };
}

export function mergeRecords(state, records, listed) {
  const keep = new Set(listed);
  const out = {};
  for (const [k, v] of Object.entries(state || {})) if (keep.has(k)) out[k] = v;
  for (const r of records) if (r && keep.has(r.repo)) out[r.repo] = r;
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

async function gh(path) {
  const res = await fetch(`https://api.github.com/${path}`, {
    headers: { accept: 'application/vnd.github+json', ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) },
  });
  return res.ok ? res.json() : null;
}

async function latestRef(repo) {
  const rel = await gh(`repos/${repo}/releases/latest`);
  if (rel && rel.tag_name) return { kind: 'release', ref: rel.tag_name };
  const meta = await gh(`repos/${repo}`);
  if (meta && !meta.private && meta.default_branch) return { kind: 'branch', ref: meta.default_branch };
  return null;
}

const readJson = async (p, fallback) => { try { return JSON.parse(await readFile(p, 'utf8')); } catch { return fallback; } };

async function main([mode, ...args]) {
  if (mode === 'plan') {
    const max = Number(args[0] || 8);
    const repos = listedRepos(await readJson(MATRIX, {}));
    const state = await readJson(STATE, {});
    const due = [];
    for (const repo of repos) {
      const latest = await latestRef(repo);
      if (needsScan(state[repo], latest)) due.push({ repo, ...latest });
    }
    // No silent truncation: say what was capped.
    if (due.length > max) console.error(`plan: ${due.length} due, scanning ${max} this run; ${due.length - max} deferred to the next run`);
    else console.error(`plan: ${due.length} due of ${repos.length} listed`);
    process.stdout.write(JSON.stringify(due.slice(0, max)));
  } else if (mode === 'summarise') {
    const [repo, ref, kind, sastPath, outPath] = args;
    const sast = await readJson(sastPath, null);
    await writeFile(outPath, JSON.stringify(summarise(sast, { repo, ref, kind }), null, 2) + '\n');
  } else if (mode === 'merge') {
    const dir = args[0];
    const records = [];
    for (const f of await readdir(dir, { recursive: true })) {
      if (f.endsWith('record.json')) records.push(await readJson(`${dir}/${f}`, null));
    }
    const listed = listedRepos(await readJson(MATRIX, {}));
    const merged = mergeRecords(await readJson(STATE, {}), records.filter(Boolean), listed);
    await writeFile(STATE, JSON.stringify(merged, null, 2) + '\n');
    console.error(`merge: ${records.length} new record(s); ${Object.keys(merged).length} repo(s) on file`);
  } else {
    console.error('usage: qe-scan.mjs plan [max] | summarise <repo> <ref> <kind> <sast.json> <out.json> | merge <dir>');
    process.exit(2);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).catch((e) => { console.error(e); process.exit(1); });
