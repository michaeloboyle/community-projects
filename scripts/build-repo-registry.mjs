#!/usr/bin/env node
// Build the meeting repo registry -> data/meeting-repos.json (public-safe).
// Implements features/repo-registry.feature.
//
// Inputs:
//   - data/meeting-repos-seed.json : curated Feb-Apr seed + not_yet_parsed list
//   - optional --sources <dir>     : directory of meeting transcript/chat text
//       files. Each file's date is taken from a leading YYYY-MM-DD in its name.
//       Raw transcripts live in PKM (internal) and are NOT committed here; pass
//       the dir at runtime. Without it, the registry is built from the seed.
//
// generated_at is the only non-deterministic field (buildRegistry itself is
// pure); pass --date YYYY-MM-DD to make the whole output reproducible.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { buildRegistry, toPublicRegistry, LEXICON } from '../lib/repo-registry.js';

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : null;
}

async function loadSources(dir) {
  if (!dir || !existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => /\.(txt|md)$/i.test(f));
  const sources = [];
  for (const f of files) {
    const m = basename(f).match(/(\d{4}-\d{2}-\d{2})/);
    if (!m) continue; // skip files with no date in the name
    sources.push({ date: m[1], source: basename(f), text: await readFile(join(dir, f), 'utf8') });
  }
  return sources;
}

const seedRaw = JSON.parse(await readFile(new URL('../data/meeting-repos-seed.json', import.meta.url)));
const sources = await loadSources(arg('--sources'));
const generatedAt = arg('--date') ? `${arg('--date')}T00:00:00Z` : new Date().toISOString();

const { entries, report } = buildRegistry({
  seed: seedRaw.entries,
  sources,
  lexicon: LEXICON,
  notYetParsed: seedRaw.meta?.not_yet_parsed ?? [],
});

const pub = toPublicRegistry(entries); // throws if any PII leaked into a public field

const out = {
  generated_at: generatedAt,
  provenance: seedRaw.meta?.provenance ?? null,
  report: { ...report, total_repos: entries.length },
  entries: pub.entries,
};

await writeFile(new URL('../data/meeting-repos.json', import.meta.url), `${JSON.stringify(out, null, 2)}\n`);
console.log(
  `meeting-repos.json: ${entries.length} repos (${report.parsed_sources} sources parsed, ${report.not_yet_parsed.length} not yet parsed).`,
);
