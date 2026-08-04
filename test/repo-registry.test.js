// Tests for the meeting repo registry parser.
// Implements features/repo-registry.feature. Introducer = earliest speaker.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRegistry, toPublicRegistry, LEXICON } from '../lib/repo-registry.js';

const find = (reg, key) => reg.entries.find((e) => e.canonical === key);

test('@extraction @url: a GitHub URL in a chat line is captured with speaker, owner, date', () => {
  const reg = buildRegistry({
    sources: [{ date: '2026-04-09', source: 'chat-0409', text: 'Rishub: check out https://github.com/CraftsMan-Labs/SimpleAgents' }],
  });
  const e = find(reg, 'CraftsMan-Labs/SimpleAgents');
  assert.ok(e, 'entry exists');
  assert.equal(e.introducer, 'Rishub');
  assert.equal(e.first_seen, '2026-04-09');
  assert.equal(e.owner, 'CraftsMan-Labs');
});

test('@extraction @lexicon: a known project named without a URL is captured via the lexicon', () => {
  const lexicon = [...LEXICON, { canonical: 'weftos', name: 'WeftOS', aliases: ['WeftOS'], owner: null, url: null }];
  const reg = buildRegistry({
    sources: [{ date: '2026-04-10', source: 'chat-0410', text: 'Stuart: WeftOS is the one to watch' }],
    lexicon,
  });
  const e = find(reg, 'weftos');
  assert.ok(e, 'lexicon entry exists');
  assert.equal(e.introducer, 'Stuart');
});

test('@extraction @noise: the generic word "repo" alone does not create an entry', () => {
  const reg = buildRegistry({
    sources: [{ date: '2026-06-18', source: 'transcript-0618', text: 'So you got a repo harness, point it at some random repo' }],
  });
  assert.equal(reg.entries.length, 0, 'no entry from generic "repo"');
});

test('@attribution @earliest-wins: introducer is the earliest speaker; later mentions do not override', () => {
  const lexicon = [...LEXICON, { canonical: 'pi.ruv.io', name: 'pi.ruv.io', aliases: ['pi.ruv.io'], owner: null, url: 'https://pi.ruv.io' }];
  const reg = buildRegistry({
    sources: [
      { date: '2026-04-24', source: 'chat-0424', text: 'Reuven: pi.ruv.io is my go-to' },
      { date: '2026-03-13', source: 'chat-0313', text: 'Stuart: pi.ruv.io overview attached' },
    ],
    lexicon,
  });
  const e = find(reg, 'pi.ruv.io');
  assert.equal(e.introducer, 'Stuart');
  assert.equal(e.first_seen, '2026-03-13');
  assert.equal(e.mention_count, 2);
});

test('@attribution @unknown-speaker: a mention with no resolvable speaker is kept but flagged', () => {
  const reg = buildRegistry({
    sources: [{ date: '2026-05-20', source: 'chat-0520', text: 'https://github.com/ruvnet/ruflo was merged' }],
  });
  const e = find(reg, 'ruvnet/ruflo');
  assert.ok(e);
  assert.equal(e.introducer, 'unknown');
  assert.ok(e.flags.includes('introducer-unverified'));
});

test('@seed @merge: a curated seed entry merges with a later automated mention', () => {
  const reg = buildRegistry({
    seed: [{ canonical: 'agenticsorg/OIA-Model', name: 'OIA-Model', owner: 'agenticsorg', url: 'https://github.com/agenticsorg/OIA-Model', introducer: 'nicholas-ruest', first_seen: '2026-02-19', source: 'member-intel' }],
    sources: [{ date: '2026-06-24', source: 'chat-0624', text: 'Nick: https://github.com/agenticsorg/OIA-Model' }],
  });
  const matches = reg.entries.filter((e) => e.canonical === 'agenticsorg/OIA-Model');
  assert.equal(matches.length, 1, 'exactly one merged entry');
  assert.equal(matches[0].introducer, 'nicholas-ruest');
  assert.equal(matches[0].first_seen, '2026-02-19');
  assert.ok(matches[0].mention_count >= 2);
});

test('@dedupe: URL and lexicon references to the same repo collapse to one entry', () => {
  const lexicon = [...LEXICON, { canonical: 'CraftsMan-Labs/SimpleAgents', name: 'SimpleAgents', aliases: ['SimpleAgents'], owner: 'CraftsMan-Labs', url: 'https://github.com/CraftsMan-Labs/SimpleAgents' }];
  const reg = buildRegistry({
    sources: [
      { date: '2026-04-09', source: 'chat-a', text: 'Rishub: https://github.com/CraftsMan-Labs/SimpleAgents' },
      { date: '2026-04-09', source: 'chat-b', text: 'Martin: loving SimpleAgents' },
    ],
    lexicon,
  });
  const matches = reg.entries.filter((e) => e.canonical === 'CraftsMan-Labs/SimpleAgents');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].mention_count, 2);
});

test('@output @public-safe: published registry carries only whitelisted fields, no PII', () => {
  const reg = buildRegistry({
    seed: [{ canonical: 'x/y', name: 'y', owner: 'x', url: 'https://github.com/x/y', introducer: 'someone', first_seen: '2026-01-01', source: 's', contact: 'a@b.com' }],
  });
  const pub = toPublicRegistry(reg.entries);
  const allowed = ['canonical', 'name', 'owner', 'url', 'introducer', 'first_seen', 'mention_count', 'sources', 'flags'];
  for (const e of pub.entries) {
    assert.deepEqual(Object.keys(e).sort(), [...allowed].sort());
  }
  const blob = JSON.stringify(pub);
  assert.ok(!/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(blob), 'no email addresses');
  // Phone = a digit run with >= 10 digits (ISO dates carry 8 and must not count).
  const hasPhone = (blob.match(/\+?\d[\d\s().-]{7,}\d/g) || []).some((r) => r.replace(/\D/g, '').length >= 10);
  assert.ok(!hasPhone, 'no phone numbers');
});

test('@output @public-safe: the PII guard actually fires when a phone leaks into a whitelisted field', () => {
  const entries = [{ canonical: 'x/y', name: '+1 312-953-9668', owner: 'x', url: null, introducer: 'a', first_seen: '2026-01-01', mention_count: 1, sources: ['s'], flags: [] }];
  assert.throws(() => toPublicRegistry(entries), /phone number/);
});

test('@output @deterministic: rebuilding the same inputs produces identical entries', () => {
  const inputs = { sources: [{ date: '2026-04-09', source: 's', text: 'Rishub: https://github.com/CraftsMan-Labs/SimpleAgents' }] };
  const a = buildRegistry(inputs);
  const b = buildRegistry(inputs);
  assert.equal(JSON.stringify(a.entries), JSON.stringify(b.entries));
});

test('@coverage @honesty: unparsed sources are reported, never silently dropped', () => {
  const reg = buildRegistry({
    sources: [{ date: '2026-04-09', source: 's', text: 'Rishub: https://github.com/CraftsMan-Labs/SimpleAgents' }],
    notYetParsed: ['2026-06-10 OSS Meet transcript', '2026-06-24 OSS Meet transcript'],
  });
  assert.equal(reg.report.parsed_sources, 1);
  assert.deepEqual(reg.report.not_yet_parsed, ['2026-06-10 OSS Meet transcript', '2026-06-24 OSS Meet transcript']);
});
