'use strict';

/**
 * Queue Health
 *
 * Instruments the middle of the intake pipeline: submissions that have been
 * accepted but not yet scored.
 *
 * Context (2026-09-28). The pipeline had sensors on intake (on-submission,
 * case-brief) and on post-approval health (weekly-monitor, which watches
 * approved projects for commit staleness). It had no sensor on the phase
 * between them. Five submissions (#44, #51, #52, #53, #55) sat in
 * `status:pending-review` for up to 49 days with zero scores and zero
 * automated escalation, because:
 *
 *   1. The case-brief job lost a label race and never fired on real
 *      submissions, so the committee @mention it carries was never posted
 *      (fixed upstream in #58/#59, forward-looking only).
 *   2. Only 2 of 6 committee members watch the repository, so absent that
 *      @mention there was no notification path at all.
 *   3. weekly-monitor returns early when approved-projects.json has no active
 *      entries, which is the steady state before the first approval.
 *
 * Nothing in the system could observe any of that. These functions are the
 * missing instrument. They are pure: no network, no filesystem, no clock.
 * Callers pass data and `now` in, which is what makes them testable.
 */

const PENDING_LABEL = 'status:pending-review';
const SCORING_LABEL = 'status:scoring';
const BRIEF_MARKER = '### Case Brief (Governance Agent)';
const CHASE_MARKER = '### Scoring Reminder (Queue Health)';
const MS_PER_DAY = 86400000;

// ---------------------------------------------------------------------------
// Quorum
// ---------------------------------------------------------------------------

/**
 * Derive quorum from the committee roster.
 *
 * This mirrors escalation-vote.yml, validation-vote.yml and retraction.yml,
 * which all compute `floor(members / 2) + 1` from data/committee-config.json
 * and fall back to the QUORUM env var only when the config is unreadable.
 *
 * governance-agent.yml's `/status` reporter did NOT do this. It read the raw
 * env value (3) while the three enforcing workflows computed 4 from the
 * 6-member roster, so `/status` under-reported how many scores were actually
 * needed. Enforcement was never wrong; the report was. Sharing this function
 * removes the chance of them drifting apart again.
 *
 * @param {{members?: Array<{login: string}>}|null} config
 * @param {string|number|undefined} fallback QUORUM env value
 * @returns {number}
 */
function deriveQuorum(config, fallback) {
  if (config && Array.isArray(config.members) && config.members.length > 0) {
    return Math.floor(config.members.length / 2) + 1;
  }
  const parsed = parseInt(fallback, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
}

// ---------------------------------------------------------------------------
// Age
// ---------------------------------------------------------------------------

/**
 * Whole days between an ISO timestamp and `now`. Never negative.
 *
 * @param {string} iso
 * @param {number} now epoch ms
 * @returns {number}
 */
function ageInDays(iso, now) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 0;
  return Math.max(0, Math.floor((now - then) / MS_PER_DAY));
}

// ---------------------------------------------------------------------------
// Queue selection
// ---------------------------------------------------------------------------

function labelNames(issue) {
  return (issue.labels || []).map(l => (typeof l === 'string' ? l : l.name));
}

/**
 * Open submissions awaiting scores, i.e. in pending-review or scoring.
 *
 * Pull requests are excluded: the issues REST endpoint returns them too, and
 * a PR carrying a status label would otherwise be chased as a submission.
 *
 * @param {Array<object>} issues
 * @returns {Array<object>}
 */
function awaitingScores(issues) {
  return (issues || []).filter(issue => {
    if (issue.pull_request) return false;
    if (issue.state && issue.state !== 'open') return false;
    const labels = labelNames(issue);
    return labels.includes(PENDING_LABEL) || labels.includes(SCORING_LABEL);
  });
}

/**
 * Submissions awaiting scores for longer than the threshold.
 *
 * @param {Array<object>} issues
 * @param {{thresholdDays: number, now: number}} opts
 * @returns {Array<{issue: object, ageDays: number}>}
 */
function findStaleSubmissions(issues, opts) {
  const { thresholdDays, now } = opts;
  return awaitingScores(issues)
    .map(issue => ({ issue, ageDays: ageInDays(issue.created_at, now) }))
    .filter(entry => entry.ageDays >= thresholdDays)
    .sort((a, b) => b.ageDays - a.ageDays);
}

// ---------------------------------------------------------------------------
// Reach: was the committee ever actually told?
// ---------------------------------------------------------------------------

/**
 * True when a case brief has been posted on the issue.
 *
 * The case brief is the only artifact that @mentions eligible scorers, so its
 * absence means the committee was never notified through any automated path.
 * This is the specific failure that went unobserved for 49 days.
 *
 * @param {Array<{body?: string}>} comments
 * @returns {boolean}
 */
function hasCaseBrief(comments) {
  return (comments || []).some(c => (c.body || '').includes(BRIEF_MARKER));
}

/**
 * Submissions awaiting scores that carry no case brief.
 *
 * @param {Array<object>} issues
 * @param {Map<number, Array<object>>|object} commentsByIssue
 * @returns {Array<object>}
 */
function findUnbriefed(issues, commentsByIssue) {
  const get = n =>
    commentsByIssue instanceof Map
      ? commentsByIssue.get(n) || []
      : (commentsByIssue || {})[n] || [];
  return awaitingScores(issues).filter(issue => !hasCaseBrief(get(issue.number)));
}

// ---------------------------------------------------------------------------
// Scorers
// ---------------------------------------------------------------------------

/**
 * Roster minus the submitter. Mirrors the case-brief mention list.
 *
 * Submitter exclusion is mechanical per charter section 7. Voluntary recusal
 * is handled separately in `missingScorers`, because the committee never
 * auto-recuses a non-submitter: a member is eligible until they say otherwise.
 *
 * @param {{members?: Array<{login: string}>}|null} config
 * @param {string} submitter
 * @returns {Array<string>}
 */
function eligibleScorers(config, submitter) {
  if (!config || !Array.isArray(config.members)) return [];
  return config.members
    .map(m => m.login)
    .filter(login => login && login !== submitter);
}

/**
 * Logins that have posted a `/score` command.
 *
 * Matches the scoring workflow's trigger (`startsWith('/score ')`) against the
 * trimmed comment body, so a mention of `/score` mid-sentence does not count
 * as a cast score.
 *
 * @param {Array<{body?: string, user?: {login?: string}}>} comments
 * @returns {Array<string>}
 */
function scorersWhoResponded(comments) {
  const seen = new Set();
  for (const c of comments || []) {
    const body = (c.body || '').trim();
    const login = c.user && c.user.login;
    if (login && body.startsWith('/score ')) seen.add(login);
  }
  return [...seen];
}

/**
 * Logins that have recused themselves via `/coi`.
 *
 * Read from the member's own comment rather than the bot's confirmation, so
 * the recusal is attributed to the person who declared it. Charter section 7
 * records recusals without letting them affect quorum, which is why recused
 * members are dropped from the chase list but quorum is left untouched.
 *
 * @param {Array<{body?: string, user?: {login?: string}}>} comments
 * @returns {Array<string>}
 */
function recusedMembers(comments) {
  const seen = new Set();
  for (const c of comments || []) {
    const body = (c.body || '').trim();
    const login = c.user && c.user.login;
    if (login && body.startsWith('/coi ')) seen.add(login);
  }
  return [...seen];
}

/**
 * Eligible scorers who have neither scored nor recused.
 *
 * Chasing a member who has already declared a conflict is the fastest way to
 * make an automated reminder feel careless, so recusals are honored here even
 * though they do not change quorum.
 *
 * @param {object|null} config
 * @param {string} submitter
 * @param {Array<object>} comments
 * @returns {Array<string>}
 */
function missingScorers(config, submitter, comments) {
  const responded = new Set(scorersWhoResponded(comments));
  const recused = new Set(recusedMembers(comments));
  return eligibleScorers(config, submitter).filter(
    l => !responded.has(l) && !recused.has(l)
  );
}

// ---------------------------------------------------------------------------
// Chase idempotency
// ---------------------------------------------------------------------------

/**
 * Most recent reminder timestamp, or null.
 *
 * @param {Array<object>} comments
 * @returns {string|null}
 */
function lastChaseAt(comments) {
  let latest = null;
  for (const c of comments || []) {
    if (!(c.body || '').includes(CHASE_MARKER)) continue;
    if (!latest || new Date(c.created_at) > new Date(latest)) latest = c.created_at;
  }
  return latest;
}

/**
 * Whether to post a reminder now.
 *
 * Refuses when nobody is missing (nothing to ask for) and when a reminder was
 * posted inside the interval. Without the interval guard the weekly cron would
 * re-nag every Monday forever, which trains people to filter the notification
 * and destroys the value of the channel.
 *
 * @param {Array<object>} comments
 * @param {{missing: Array<string>, intervalDays: number, now: number}} opts
 * @returns {{chase: boolean, reason: string}}
 */
function shouldChase(comments, opts) {
  const { missing, intervalDays, now } = opts;
  if (!missing || missing.length === 0) {
    return { chase: false, reason: 'all eligible scorers have responded' };
  }
  const last = lastChaseAt(comments);
  if (last) {
    const since = ageInDays(last, now);
    if (since < intervalDays) {
      return {
        chase: false,
        reason: `reminded ${since}d ago, interval is ${intervalDays}d`,
      };
    }
  }
  return { chase: true, reason: last ? 'interval elapsed' : 'never reminded' };
}

/**
 * Order due submissions so that the least recently reminded go first.
 *
 * Ordering by submission age instead looks obviously right and starves the
 * queue. Simulated against the live backlog on 2026-09-28 with a cap of 2:
 * #44 and #55 are the two oldest, so they take both slots on every run, and
 * once their reminder interval elapses they take both slots again. #51, #52
 * and #53 are never reached at all. The cap turns into a permanent block on
 * everything below the top two.
 *
 * Priority is therefore: never reminded first, then longest since the last
 * reminder, with submission age only as a tie-break. That rotates through the
 * whole queue instead of pinning the head of it.
 *
 * @param {Array<{issue: object, ageDays: number, comments?: Array<object>}>} due
 * @param {number} now epoch ms
 * @returns {Array<object>}
 */
function prioritizeChases(due, now) {
  return [...(due || [])].sort((a, b) => {
    const aLast = lastChaseAt(a.comments);
    const bLast = lastChaseAt(b.comments);
    if (!aLast && bLast) return -1;
    if (aLast && !bLast) return 1;
    if (aLast && bLast) {
      const diff = ageInDays(bLast, now) - ageInDays(aLast, now);
      if (diff !== 0) return diff;
    }
    return (b.ageDays || 0) - (a.ageDays || 0);
  });
}

/**
 * Cap how many submissions are chased in one run.
 *
 * Without a cap the first run against the live backlog would have posted five
 * reminders at once, each @mentioning six people: thirty notifications in one
 * minute, as the committee's first ever contact with this system. That is how
 * a new notification channel gets muted permanently.
 *
 * Deferred submissions are returned, never silently dropped, so the caller can
 * log what was held back. Pass the list through `prioritizeChases` first, or
 * the cap will starve everything outside the head of the queue.
 *
 * @param {Array<object>} candidates
 * @param {number} maxPerRun
 * @returns {{chase: Array<object>, deferred: Array<object>}}
 */
function capChases(candidates, maxPerRun) {
  const list = candidates || [];
  if (!Number.isFinite(maxPerRun) || maxPerRun <= 0) {
    return { chase: [], deferred: [...list] };
  }
  return {
    chase: list.slice(0, maxPerRun),
    deferred: list.slice(maxPerRun),
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * Reminder comment body.
 *
 * Carries the exact command, because the most common reason a committee member
 * does not score is not reluctance but not knowing the syntax.
 *
 * @param {{missing: Array<string>, ageDays: number, received: number,
 *          quorum: number, unbriefed: boolean}} opts
 * @returns {string}
 */
function buildChaseComment(opts) {
  const { missing, ageDays, received, quorum, unbriefed } = opts;
  const lines = [
    CHASE_MARKER,
    '',
    `This submission has been awaiting committee scores for **${ageDays} days**.`,
    '',
    `| | |`,
    `|---|---|`,
    `| Scores received | ${received} |`,
    `| Quorum | ${quorum} |`,
    `| Still needed | ${Math.max(0, quorum - received)} |`,
    '',
  ];

  if (unbriefed) {
    lines.push(
      '> No case brief was ever posted on this submission, so the committee',
      '> may not have been notified that it exists. Treat this reminder as the',
      '> first notification rather than a follow-up.',
      ''
    );
  }

  lines.push(
    `${missing.map(l => '@' + l).join(' ')}: a score is outstanding from you.`,
    '',
    'Comment on this issue with your five scores:',
    '',
    '```',
    '/score mission:4 quality:3 clarity:5 impact:4 risk:3',
    '```',
    '',
    'Each criterion is 0 to 5. Criterion 5 (risk) is inverted, so lower risk',
    'scores higher. Definitions are in charter section 6 and',
    '`docs/scoring-template.md`. The workflow parses your comment and posts the',
    'tally automatically.',
    '',
    'Scoring is step 2 of the charter model, not a decision. The escalation and',
    'validation votes happen separately.',
    '',
    '---',
    '*Automated reminder from the queue-health monitor. Posted at most once per',
    'reminder interval.*'
  );

  return lines.join('\n');
}

/**
 * Weekly digest written to the workflow run summary.
 *
 * @param {{stale: Array<{issue: object, ageDays: number}>,
 *          unbriefed: Array<object>, quorum: number,
 *          thresholdDays: number, totalAwaiting: number}} opts
 * @returns {string}
 */
function buildQueueReport(opts) {
  const { stale, unbriefed, quorum, thresholdDays, totalAwaiting } = opts;
  const lines = ['## Intake queue health', ''];

  lines.push(`- Awaiting scores: **${totalAwaiting}**`);
  lines.push(`- Older than ${thresholdDays}d: **${stale.length}**`);
  lines.push(`- Never case-briefed: **${unbriefed.length}**`);
  lines.push(`- Quorum: **${quorum}**`);
  lines.push('');

  if (totalAwaiting === 0) {
    lines.push('Queue is empty. Nothing awaiting committee scores.');
    return lines.join('\n');
  }

  if (stale.length > 0) {
    lines.push(`### Stale (>= ${thresholdDays}d)`, '');
    lines.push('| Issue | Age | Scores | Case brief |', '|---|---|---|---|');
    for (const { issue, ageDays } of stale) {
      const briefed = unbriefed.some(u => u.number === issue.number) ? 'MISSING' : 'yes';
      lines.push(
        `| #${issue.number} | ${ageDays}d | ${issue.__received ?? '?'} | ${briefed} |`
      );
    }
    lines.push('');
  }

  if (unbriefed.length > 0) {
    lines.push(
      '### Reach gap',
      '',
      'These submissions carry no case brief, which is the only artifact that',
      '@mentions eligible scorers. Absent it, members who do not watch the',
      'repository were never notified that the submission exists.',
      '',
      ...unbriefed.map(i => `- #${i.number} ${i.title || ''}`.trim()),
      ''
    );
  }

  return lines.join('\n');
}

module.exports = {
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
};
