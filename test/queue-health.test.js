'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  PENDING_LABEL,
  SCORING_LABEL,
  BRIEF_MARKER,
  CHASE_MARKER,
  deriveQuorum,
  ageInDays,
  awaitingScores,
  findStaleSubmissions,
  hasCaseBrief,
  findUnbriefed,
  eligibleScorers,
  scorersWhoResponded,
  recusedMembers,
  missingScorers,
  lastChaseAt,
  shouldChase,
  prioritizeChases,
  capChases,
  buildChaseComment,
  buildQueueReport,
} = require('../lib/queue-health.js');

// Fixed clock. Nothing in this suite reads the real one.
const NOW = new Date('2026-09-28T00:00:00Z').getTime();
const daysAgo = n => new Date(NOW - n * 86400000).toISOString();

// The live roster as of 2026-09-28.
const CONFIG = {
  members: [
    { login: 'michaeloboyle', role: 'chair' },
    { login: 'nicholas-ruest', role: 'member' },
    { login: 'mrjcleaver', role: 'member' },
    { login: 'shaal', role: 'member' },
    { login: 'inde5media', role: 'member' },
    { login: 'rcraw', role: 'member' },
  ],
};

const issue = (number, opts = {}) => ({
  number,
  title: opts.title || `[Project Submission] fixture ${number}`,
  state: opts.state || 'open',
  created_at: opts.created_at || daysAgo(1),
  labels: (opts.labels || [PENDING_LABEL]).map(name => ({ name })),
  ...(opts.pull_request ? { pull_request: {} } : {}),
});

// ===========================================================================
// deriveQuorum
// ===========================================================================

describe('deriveQuorum', () => {
  it('computes simple majority of the roster', () => {
    assert.equal(deriveQuorum(CONFIG, '3'), 4);
  });

  it('matches what the vote workflows enforce, not the QUORUM env default', () => {
    // The regression this guards: governance-agent /status read env QUORUM=3
    // while escalation/validation/retraction all derived 4 from the same
    // 6-member roster. The report disagreed with the enforcer.
    const enforced = Math.floor(CONFIG.members.length / 2) + 1;
    assert.equal(deriveQuorum(CONFIG, '3'), enforced);
    assert.notEqual(deriveQuorum(CONFIG, '3'), 3);
  });

  it('falls back to the env value when config is unreadable', () => {
    assert.equal(deriveQuorum(null, '5'), 5);
    assert.equal(deriveQuorum({}, '5'), 5);
    assert.equal(deriveQuorum({ members: [] }, '5'), 5);
  });

  it('falls back to 3 when neither config nor env is usable', () => {
    assert.equal(deriveQuorum(null, undefined), 3);
    assert.equal(deriveQuorum(null, 'not-a-number'), 3);
    assert.equal(deriveQuorum(null, '0'), 3);
  });

  it('scales with roster size', () => {
    const roster = n => ({ members: Array.from({ length: n }, (_, i) => ({ login: `m${i}` })) });
    assert.equal(deriveQuorum(roster(1), '3'), 1);
    assert.equal(deriveQuorum(roster(2), '3'), 2);
    assert.equal(deriveQuorum(roster(5), '3'), 3);
    assert.equal(deriveQuorum(roster(7), '3'), 4);
  });
});

// ===========================================================================
// ageInDays
// ===========================================================================

describe('ageInDays', () => {
  it('counts whole days', () => {
    assert.equal(ageInDays(daysAgo(49), NOW), 49);
    assert.equal(ageInDays(daysAgo(0), NOW), 0);
  });

  it('never returns negative for a future timestamp', () => {
    assert.equal(ageInDays(new Date(NOW + 86400000).toISOString(), NOW), 0);
  });

  it('returns 0 for an unparseable timestamp rather than NaN', () => {
    assert.equal(ageInDays('not-a-date', NOW), 0);
    assert.equal(ageInDays(undefined, NOW), 0);
  });
});

// ===========================================================================
// awaitingScores
// ===========================================================================

describe('awaitingScores', () => {
  it('selects pending-review and scoring', () => {
    const got = awaitingScores([
      issue(44),
      issue(70, { labels: [SCORING_LABEL] }),
      issue(71, { labels: ['status:approved'] }),
    ]);
    assert.deepEqual(got.map(i => i.number), [44, 70]);
  });

  it('excludes pull requests carrying a status label', () => {
    // The issues endpoint returns PRs too. A PR labelled pending-review would
    // otherwise be chased as if it were a submission.
    const got = awaitingScores([issue(44), issue(63, { pull_request: true })]);
    assert.deepEqual(got.map(i => i.number), [44]);
  });

  it('excludes closed issues', () => {
    const got = awaitingScores([issue(44), issue(45, { state: 'closed' })]);
    assert.deepEqual(got.map(i => i.number), [44]);
  });

  it('accepts labels given as plain strings', () => {
    const got = awaitingScores([{ number: 9, state: 'open', created_at: daysAgo(1), labels: [PENDING_LABEL] }]);
    assert.equal(got.length, 1);
  });

  it('tolerates a missing labels array', () => {
    assert.deepEqual(awaitingScores([{ number: 9, state: 'open' }]), []);
    assert.deepEqual(awaitingScores(null), []);
  });
});

// ===========================================================================
// findStaleSubmissions
// ===========================================================================

describe('findStaleSubmissions', () => {
  it('finds submissions at or past the threshold, oldest first', () => {
    const issues = [
      issue(44, { created_at: daysAgo(49) }),
      issue(51, { created_at: daysAgo(38) }),
      issue(70, { created_at: daysAgo(3) }),
    ];
    const stale = findStaleSubmissions(issues, { thresholdDays: 14, now: NOW });
    assert.deepEqual(stale.map(s => s.issue.number), [44, 51]);
    assert.equal(stale[0].ageDays, 49);
  });

  it('treats the threshold as inclusive', () => {
    const stale = findStaleSubmissions([issue(1, { created_at: daysAgo(14) })], {
      thresholdDays: 14,
      now: NOW,
    });
    assert.equal(stale.length, 1);
  });

  it('would have caught the real backlog at 14d but not at the 90d project threshold', () => {
    // The live queue on 2026-09-28. STALE_THRESHOLD_DAYS=90 governs approved
    // projects; reusing it here would have kept all five invisible.
    const live = [
      issue(44, { created_at: daysAgo(49) }),
      issue(51, { created_at: daysAgo(38) }),
      issue(52, { created_at: daysAgo(38) }),
      issue(53, { created_at: daysAgo(38) }),
      issue(55, { created_at: daysAgo(38) }),
    ];
    assert.equal(findStaleSubmissions(live, { thresholdDays: 14, now: NOW }).length, 5);
    assert.equal(findStaleSubmissions(live, { thresholdDays: 90, now: NOW }).length, 0);
  });

  it('returns empty for an empty queue', () => {
    assert.deepEqual(findStaleSubmissions([], { thresholdDays: 14, now: NOW }), []);
  });
});

// ===========================================================================
// Reach
// ===========================================================================

describe('hasCaseBrief', () => {
  it('detects the brief marker', () => {
    assert.equal(hasCaseBrief([{ body: `${BRIEF_MARKER}\n\nrows` }]), true);
  });

  it('does not mistake the welcome comment for a brief', () => {
    const welcome = [
      { body: 'Thank you for your submission!\n\nYour project is now **pending review**.' },
      { body: '### Added to the OIA Application Matrix (pending review)' },
    ];
    assert.equal(hasCaseBrief(welcome), false);
  });

  it('handles empty and missing bodies', () => {
    assert.equal(hasCaseBrief([{}, { body: '' }]), false);
    assert.equal(hasCaseBrief(null), false);
  });
});

describe('findUnbriefed', () => {
  it('reproduces the observed reach gap', () => {
    // All five live submissions had zero case briefs on 2026-09-28, because
    // the case-brief job lost a label race before #58/#59 landed.
    const issues = [issue(44), issue(51), issue(52), issue(53), issue(55)];
    const comments = {
      44: [{ body: 'Thank you for your submission!' }],
      51: [],
      52: [],
      53: [],
      55: [],
    };
    assert.deepEqual(findUnbriefed(issues, comments).map(i => i.number), [44, 51, 52, 53, 55]);
  });

  it('clears an issue once its brief is posted', () => {
    const issues = [issue(44), issue(51)];
    const comments = { 44: [{ body: BRIEF_MARKER }], 51: [] };
    assert.deepEqual(findUnbriefed(issues, comments).map(i => i.number), [51]);
  });

  it('accepts a Map as well as an object', () => {
    const issues = [issue(44)];
    const map = new Map([[44, [{ body: BRIEF_MARKER }]]]);
    assert.deepEqual(findUnbriefed(issues, map), []);
  });
});

// ===========================================================================
// Scorers
// ===========================================================================

describe('eligibleScorers', () => {
  it('is the roster minus the submitter', () => {
    assert.deepEqual(eligibleScorers(CONFIG, 'shaal'), [
      'michaeloboyle',
      'nicholas-ruest',
      'mrjcleaver',
      'inde5media',
      'rcraw',
    ]);
  });

  it('returns the whole roster when the submitter is not a member', () => {
    // bar181 submitted #44 and is a repo collaborator but not a committee member.
    assert.equal(eligibleScorers(CONFIG, 'bar181').length, 6);
  });

  it('returns empty when config is unusable', () => {
    assert.deepEqual(eligibleScorers(null, 'x'), []);
    assert.deepEqual(eligibleScorers({}, 'x'), []);
  });
});

describe('scorersWhoResponded', () => {
  it('collects logins that posted a score command', () => {
    const comments = [
      { user: { login: 'shaal' }, body: '/score mission:4 quality:3 clarity:5 impact:4 risk:3' },
      { user: { login: 'mrjcleaver' }, body: 'looks interesting' },
    ];
    assert.deepEqual(scorersWhoResponded(comments), ['shaal']);
  });

  it('deduplicates a member who rescored', () => {
    const comments = [
      { user: { login: 'shaal' }, body: '/score mission:4 quality:3 clarity:5 impact:4 risk:3' },
      { user: { login: 'shaal' }, body: '/score mission:5 quality:3 clarity:5 impact:4 risk:3' },
    ];
    assert.deepEqual(scorersWhoResponded(comments), ['shaal']);
  });

  it('ignores /score mentioned mid-sentence', () => {
    // Matches the scoring workflow, which triggers on startsWith('/score ').
    const comments = [
      { user: { login: 'shaal' }, body: 'remember to use /score mission:4 when you review' },
    ];
    assert.deepEqual(scorersWhoResponded(comments), []);
  });

  it('tolerates leading whitespace, which the workflow trims too', () => {
    const comments = [
      { user: { login: 'shaal' }, body: '  /score mission:4 quality:3 clarity:5 impact:4 risk:3' },
    ];
    assert.deepEqual(scorersWhoResponded(comments), ['shaal']);
  });

  it('ignores comments with no user', () => {
    assert.deepEqual(scorersWhoResponded([{ body: '/score mission:1 quality:1 clarity:1 impact:1 risk:1' }]), []);
  });
});

describe('recusedMembers', () => {
  it('collects logins that declared a conflict', () => {
    const comments = [
      { user: { login: 'shaal' }, body: '/coi I maintain this repository' },
      { user: { login: 'rcraw' }, body: 'no conflict here' },
    ];
    assert.deepEqual(recusedMembers(comments), ['shaal']);
  });

  it('reads the member declaration, not the bot confirmation', () => {
    // The bot posts "### Conflict of Interest Recusal / @shaal has recused...".
    // Attributing off that comment would credit the recusal to the bot.
    const comments = [
      {
        user: { login: 'github-actions[bot]' },
        body: '### Conflict of Interest Recusal\n\n@shaal has recused themselves from this submission.',
      },
    ];
    assert.deepEqual(recusedMembers(comments), []);
  });

  it('ignores /coi mentioned mid-sentence', () => {
    const comments = [{ user: { login: 'shaal' }, body: 'you should probably /coi on this one' }];
    assert.deepEqual(recusedMembers(comments), []);
  });
});

describe('missingScorers', () => {
  it('does not chase a member who has recused', () => {
    const comments = [{ user: { login: 'shaal' }, body: '/coi I maintain this repository' }];
    const missing = missingScorers(CONFIG, 'bar181', comments);
    assert.ok(!missing.includes('shaal'));
    assert.equal(missing.length, 5);
  });

  it('leaves quorum untouched when a member recuses', () => {
    // Charter section 7: recusals are recorded but do not affect quorum.
    // Dropping the member from the chase list must not change the threshold.
    assert.equal(deriveQuorum(CONFIG, '3'), 4);
  });

  it('excludes both the submitter and those who scored', () => {
    const comments = [
      { user: { login: 'shaal' }, body: '/score mission:4 quality:3 clarity:5 impact:4 risk:3' },
    ];
    const missing = missingScorers(CONFIG, 'mrjcleaver', comments);
    assert.deepEqual(missing, ['michaeloboyle', 'nicholas-ruest', 'inde5media', 'rcraw']);
  });

  it('is empty once everyone eligible has scored', () => {
    const comments = eligibleScorers(CONFIG, 'bar181').map(login => ({
      user: { login },
      body: '/score mission:3 quality:3 clarity:3 impact:3 risk:3',
    }));
    assert.deepEqual(missingScorers(CONFIG, 'bar181', comments), []);
  });
});

// ===========================================================================
// Chase idempotency
// ===========================================================================

describe('lastChaseAt', () => {
  it('returns the most recent reminder', () => {
    const comments = [
      { body: CHASE_MARKER, created_at: daysAgo(20) },
      { body: CHASE_MARKER, created_at: daysAgo(3) },
      { body: 'unrelated', created_at: daysAgo(1) },
    ];
    assert.equal(lastChaseAt(comments), daysAgo(3));
  });

  it('returns null when never reminded', () => {
    assert.equal(lastChaseAt([{ body: 'hello' }]), null);
    assert.equal(lastChaseAt([]), null);
  });
});

describe('shouldChase', () => {
  it('chases when nobody has been reminded', () => {
    const got = shouldChase([], { missing: ['shaal'], intervalDays: 7, now: NOW });
    assert.equal(got.chase, true);
    assert.match(got.reason, /never reminded/);
  });

  it('refuses when everyone eligible has already scored', () => {
    const got = shouldChase([], { missing: [], intervalDays: 7, now: NOW });
    assert.equal(got.chase, false);
    assert.match(got.reason, /all eligible/);
  });

  it('refuses inside the interval, so the weekly cron cannot re-nag', () => {
    const comments = [{ body: CHASE_MARKER, created_at: daysAgo(3) }];
    const got = shouldChase(comments, { missing: ['shaal'], intervalDays: 7, now: NOW });
    assert.equal(got.chase, false);
    assert.match(got.reason, /interval/);
  });

  it('chases again once the interval has elapsed', () => {
    const comments = [{ body: CHASE_MARKER, created_at: daysAgo(8) }];
    const got = shouldChase(comments, { missing: ['shaal'], intervalDays: 7, now: NOW });
    assert.equal(got.chase, true);
  });

  it('treats the interval boundary as elapsed', () => {
    const comments = [{ body: CHASE_MARKER, created_at: daysAgo(7) }];
    assert.equal(shouldChase(comments, { missing: ['x'], intervalDays: 7, now: NOW }).chase, true);
  });
});

// ===========================================================================
// capChases
// ===========================================================================

describe('capChases', () => {
  const five = [44, 55, 53, 52, 51].map(n => ({ number: n }));

  it('chases the first N and defers the rest', () => {
    const { chase, deferred } = capChases(five, 2);
    assert.deepEqual(chase.map(c => c.number), [44, 55]);
    assert.deepEqual(deferred.map(c => c.number), [53, 52, 51]);
  });

  it('never silently drops: every candidate lands in one bucket', () => {
    const { chase, deferred } = capChases(five, 2);
    assert.equal(chase.length + deferred.length, five.length);
  });

  it('bounds the first run against the real backlog', () => {
    // Five submissions x six mentions would be 30 notifications at once.
    assert.equal(capChases(five, 2).chase.length, 2);
  });

  it('passes everything through when the cap exceeds the queue', () => {
    assert.equal(capChases(five, 99).chase.length, 5);
    assert.equal(capChases(five, 99).deferred.length, 0);
  });

  it('defers everything when the cap is zero or invalid', () => {
    for (const bad of [0, -1, NaN, undefined]) {
      const { chase, deferred } = capChases(five, bad);
      assert.equal(chase.length, 0);
      assert.equal(deferred.length, 5);
    }
  });

  it('handles an empty queue', () => {
    assert.deepEqual(capChases([], 2), { chase: [], deferred: [] });
    assert.deepEqual(capChases(null, 2), { chase: [], deferred: [] });
  });
});

// ===========================================================================
// prioritizeChases
//
// Regression guard for a starvation bug found by simulating the monitor
// against the live 2026-09-28 backlog. Ordering the chase list by submission
// age let #44 and #55, the two oldest, take both slots on every run forever;
// #51, #52 and #53 were never reminded at all.
// ===========================================================================

describe('prioritizeChases', () => {
  const due = (number, ageDays, lastChaseDaysAgo) => ({
    issue: { number },
    ageDays,
    comments:
      lastChaseDaysAgo === null
        ? []
        : [{ body: CHASE_MARKER, created_at: daysAgo(lastChaseDaysAgo) }],
  });

  it('puts never-reminded submissions ahead of recently reminded older ones', () => {
    const order = prioritizeChases(
      [due(44, 49, 7), due(51, 38, null)],
      NOW
    ).map(d => d.issue.number);
    assert.deepEqual(order, [51, 44]);
  });

  it('orders by longest since the last reminder', () => {
    const order = prioritizeChases(
      [due(44, 49, 8), due(55, 37, 30), due(52, 37, 14)],
      NOW
    ).map(d => d.issue.number);
    assert.deepEqual(order, [55, 52, 44]);
  });

  it('falls back to submission age only as a tie-break', () => {
    const order = prioritizeChases(
      [due(51, 37, null), due(44, 49, null)],
      NOW
    ).map(d => d.issue.number);
    assert.deepEqual(order, [44, 51]);
  });

  it('rotates through the whole backlog instead of pinning the head', () => {
    // Replays the real failure. Five due, cap 2, weekly runs. Without
    // prioritization this asserted [44,55] on every single run.
    let queue = [
      due(44, 49, null),
      due(55, 37, null),
      due(53, 37, null),
      due(52, 37, null),
      due(51, 37, null),
    ];
    const reminded = new Set();
    for (let week = 0; week < 3; week++) {
      const now = NOW + week * 7 * 86400000;
      const { chase } = capChases(prioritizeChases(queue, now), 2);
      for (const c of chase) {
        reminded.add(c.issue.number);
        c.comments = [{ body: CHASE_MARKER, created_at: new Date(now).toISOString() }];
      }
    }
    assert.deepEqual([...reminded].sort((a, b) => a - b), [44, 51, 52, 53, 55]);
  });

  it('does not mutate the input array', () => {
    const input = [due(44, 49, 7), due(51, 38, null)];
    const before = input.map(d => d.issue.number);
    prioritizeChases(input, NOW);
    assert.deepEqual(input.map(d => d.issue.number), before);
  });

  it('handles empty and missing input', () => {
    assert.deepEqual(prioritizeChases([], NOW), []);
    assert.deepEqual(prioritizeChases(null, NOW), []);
  });
});

// ===========================================================================
// Rendering
// ===========================================================================

describe('buildChaseComment', () => {
  const base = { missing: ['shaal', 'rcraw'], ageDays: 49, received: 0, quorum: 4, unbriefed: false };

  it('carries the marker so it is idempotent on the next run', () => {
    assert.ok(buildChaseComment(base).includes(CHASE_MARKER));
  });

  it('mentions exactly the missing scorers', () => {
    const body = buildChaseComment(base);
    assert.ok(body.includes('@shaal'));
    assert.ok(body.includes('@rcraw'));
    assert.ok(!body.includes('@michaeloboyle'));
  });

  it('includes the exact command, not just a pointer to the rubric', () => {
    assert.ok(buildChaseComment(base).includes('/score mission:4 quality:3 clarity:5 impact:4 risk:3'));
  });

  it('says risk is inverted, which is the criterion people get backwards', () => {
    assert.match(buildChaseComment(base), /inverted/);
  });

  it('flags a never-briefed submission as a first notification', () => {
    const body = buildChaseComment({ ...base, unbriefed: true });
    assert.match(body, /first notification/);
  });

  it('omits the first-notification note when a brief exists', () => {
    assert.ok(!buildChaseComment(base).includes('first notification'));
  });

  it('reports how many scores are still needed', () => {
    assert.ok(buildChaseComment({ ...base, received: 1, quorum: 4 }).includes('| Still needed | 3 |'));
  });

  it('never reports a negative shortfall when scores exceed quorum', () => {
    const body = buildChaseComment({ ...base, received: 6, quorum: 4 });
    assert.ok(body.includes('| Still needed | 0 |'));
  });
});

describe('buildQueueReport', () => {
  it('reports an empty queue plainly', () => {
    const report = buildQueueReport({
      stale: [], unbriefed: [], quorum: 4, thresholdDays: 14, totalAwaiting: 0,
    });
    assert.match(report, /Queue is empty/);
  });

  it('lists stale submissions and the reach gap', () => {
    const report = buildQueueReport({
      stale: [{ issue: issue(44), ageDays: 49 }],
      unbriefed: [issue(44)],
      quorum: 4,
      thresholdDays: 14,
      totalAwaiting: 5,
    });
    assert.match(report, /Awaiting scores: \*\*5\*\*/);
    assert.match(report, /#44/);
    assert.match(report, /Reach gap/);
    assert.match(report, /MISSING/);
  });

  it('omits the reach-gap section when every submission was briefed', () => {
    const report = buildQueueReport({
      stale: [{ issue: issue(44), ageDays: 20 }],
      unbriefed: [],
      quorum: 4,
      thresholdDays: 14,
      totalAwaiting: 1,
    });
    assert.ok(!report.includes('Reach gap'));
  });
});
