// Meeting repo registry parser.
// Implements features/repo-registry.feature.
//
// Core rule: the INTRODUCER is the earliest speaker to bring a repo into a
// meeting (not the repo's owner). Pure functions only (no Date/random) so the
// registry is deterministic; the CLI wrapper stamps generated_at.

// ── Lexicon of known projects (alias -> canonical). Owners left null when
// unverified; the parser records null rather than guessing. Extend as needed.
export const LEXICON = [
  { canonical: 'agenticsorg/OIA-Model', name: 'OIA-Model', aliases: ['OIA-Model'], owner: 'agenticsorg', url: 'https://github.com/agenticsorg/OIA-Model' },
  { canonical: 'CraftsMan-Labs/SimpleAgents', name: 'SimpleAgents', aliases: ['SimpleAgents'], owner: 'CraftsMan-Labs', url: 'https://github.com/CraftsMan-Labs/SimpleAgents' },
  { canonical: 'ruvnet/RuVector', name: 'RuVector', aliases: ['RuVector'], owner: 'ruvnet', url: 'https://github.com/ruvnet/RuVector' },
  { canonical: 'ruvnet/ruflo', name: 'ruflo', aliases: ['ruflo'], owner: 'ruvnet', url: 'https://github.com/ruvnet/ruflo' },
  { canonical: 'proffesor-for-testing/agentic-qe', name: 'agentic-qe', aliases: ['agentic-qe'], owner: 'proffesor-for-testing', url: 'https://github.com/proffesor-for-testing/agentic-qe' },
  { canonical: 'globalbusinessadvisors/Synapse-Graph', name: 'Synapse-Graph', aliases: ['Synapse-Graph'], owner: 'globalbusinessadvisors', url: 'https://github.com/globalbusinessadvisors/Synapse-Graph' },
  { canonical: 'weftos', name: 'WeftOS', aliases: ['WeftOS'], owner: null, url: null },
  { canonical: 'connectome-os', name: 'Connectome-OS', aliases: ['Connectome-OS'], owner: null, url: null },
  { canonical: 'vectorvroom', name: 'VectorVroom', aliases: ['VectorVroom'], owner: null, url: 'https://vectorvroom.shaal.dev' },
];

const PUBLIC_FIELDS = ['canonical', 'name', 'owner', 'url', 'introducer', 'first_seen', 'mention_count', 'sources', 'flags'];

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// "Speaker: message" -> {speaker, text}. Only treats a short leading token
// followed by ": " as a speaker (avoids matching URLs like "https:").
function parseSpeaker(line) {
  const m = line.match(/^\s*([A-Za-z][\w .'-]{0,40}?):\s+(.*)$/);
  if (m && !/^https?$/i.test(m[1])) return { speaker: m[1].trim(), text: m[2] };
  return { speaker: null, text: line };
}

function normalizeRepoName(name) {
  return name.replace(/\.git$/i, '').replace(/[).,;:]+$/, '');
}

// Extract every repo mention from one source. Within a single line, the same
// canonical repo counts once (URL + lexicon of the same repo do not double).
function extractMentions(text, { date, source }, lexicon) {
  const mentions = [];
  const urlRe = /github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/gi;
  for (const rawLine of String(text).split(/\r?\n/)) {
    const { speaker, text: body } = parseSpeaker(rawLine);
    const seenThisLine = new Set();
    const push = (mention) => {
      if (seenThisLine.has(mention.canonical)) return;
      seenThisLine.add(mention.canonical);
      mentions.push(mention);
    };

    // 1. GitHub URLs
    let m;
    urlRe.lastIndex = 0;
    while ((m = urlRe.exec(rawLine)) !== null) {
      const owner = m[1];
      const name = normalizeRepoName(m[2]);
      push({ canonical: `${owner}/${name}`, name, owner, url: `https://github.com/${owner}/${name}`, speaker, date, source });
    }

    // 2. Lexicon aliases (word-ish boundary; excludes matches inside a URL path)
    for (const entry of lexicon) {
      for (const alias of entry.aliases) {
        const re = new RegExp(`(?<![A-Za-z0-9_./-])${escapeRegex(alias)}(?![A-Za-z0-9_-])`, 'i');
        if (re.test(body)) {
          push({ canonical: entry.canonical, name: entry.name, owner: entry.owner ?? null, url: entry.url ?? null, speaker, date, source });
          break;
        }
      }
    }
  }
  return mentions;
}

// Turn a curated seed entry into a mention dated at its first_seen.
function seedToMention(s) {
  return { canonical: s.canonical, name: s.name, owner: s.owner ?? null, url: s.url ?? null, speaker: s.introducer ?? null, date: s.first_seen, source: s.source ?? 'seed', seed: true };
}

/**
 * Build the registry. Pure and deterministic.
 * @param {{sources?: Array, seed?: Array, lexicon?: Array, notYetParsed?: string[]}} opts
 * @returns {{entries: Array, report: {parsed_sources: number, not_yet_parsed: string[]}}}
 */
export function buildRegistry({ sources = [], seed = [], lexicon = LEXICON, notYetParsed = [] } = {}) {
  const mentions = [
    ...seed.map(seedToMention),
    ...sources.flatMap((src) => extractMentions(src.text, { date: src.date, source: src.source }, lexicon)),
  ];

  const groups = new Map();
  for (const men of mentions) {
    if (!groups.has(men.canonical)) groups.set(men.canonical, []);
    groups.get(men.canonical).push(men);
  }

  const entries = [];
  for (const [canonical, list] of groups) {
    // earliest date; among ties, prefer a known speaker (seed or named).
    const sorted = [...list].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      const aKnown = a.speaker ? 0 : 1;
      const bKnown = b.speaker ? 0 : 1;
      return aKnown - bKnown;
    });
    const earliest = sorted[0];
    const introducer = earliest.speaker || 'unknown';

    const pick = (field) => list.map((x) => x[field]).find((v) => v != null) ?? null;
    const flags = [];
    if (introducer === 'unknown') flags.push('introducer-unverified');
    if (pick('owner') == null) flags.push('owner-unverified');

    entries.push({
      canonical,
      name: pick('name') ?? canonical.split('/').pop(),
      owner: pick('owner'),
      url: pick('url'),
      introducer,
      first_seen: earliest.date,
      mention_count: list.length,
      sources: [...new Set(list.map((x) => x.source))].sort(),
      flags,
    });
  }

  entries.sort((a, b) => (a.first_seen !== b.first_seen ? (a.first_seen < b.first_seen ? -1 : 1) : a.canonical < b.canonical ? -1 : 1));

  return { entries, report: { parsed_sources: sources.length, not_yet_parsed: [...notYetParsed] } };
}

/** Project entries to the public-safe shape (whitelisted fields, PII-checked). */
export function toPublicRegistry(entries) {
  const clean = entries.map((e) => {
    const out = {};
    for (const f of PUBLIC_FIELDS) out[f] = e[f];
    return out;
  });
  const blob = JSON.stringify(clean);
  if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(blob)) throw new Error('public registry contains an email address');
  // Phone = a separator-joined run with >= 10 digits (ISO dates have only 8, so they do not trip this).
  for (const run of blob.match(/\+?\d[\d\s().-]{7,}\d/g) || []) {
    if (run.replace(/\D/g, '').length >= 10) throw new Error('public registry contains a phone number');
  }
  return { entries: clean };
}
