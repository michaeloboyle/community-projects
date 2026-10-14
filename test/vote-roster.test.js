'use strict';

// Roster eligibility for committee votes.
//
// Only logins listed in data/committee-config.json `members` may count toward
// a vote tally or toward quorum. Contributors, outside commenters, and the
// issue submitter are ignored. These tests pin that rule for the pure helper
// that escalation-vote.yml, validation-vote.yml and retraction.yml all call.
// Implements the tally side of features/voting.feature scenarios
// "Non-committee-member vote rejected" and "Submitter cannot vote on own
// submission".

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const guards = require('../lib/workflow-guards.js');

const config = {
  members: [
    { login: 'michaeloboyle', role: 'chair' },
    { login: 'nicholas-ruest', role: 'member' },
    { login: 'mrjcleaver', role: 'member' },
    { login: 'shaal', role: 'member' },
  ],
  contributors: [
    { login: 'CraftsMan-Labs', role: 'contributor' },
  ],
};

// Same shape GitHub's listComments returns, trimmed to what the tally reads.
function comment(login, body, type = 'User') {
  return { user: { login, type }, body };
}

// Escalation parser, matching the workflow's accepted vote strings.
function parseEscalation(body) {
  const b = body.trim();
  if (/^\/vote escalate\s*$/.test(b)) return 'escalate';
  if (/^\/vote no-escalate\s*$/.test(b)) return 'no-escalate';
  return null;
}

describe('rosterLogins', () => {
  it('returns lowercased member logins only, not contributors', () => {
    const roster = guards.rosterLogins(config);
    assert.deepEqual([...roster].sort(), ['michaeloboyle', 'mrjcleaver', 'nicholas-ruest', 'shaal']);
    assert.equal(roster.has('craftsman-labs'), false);
  });

  it('returns an empty roster when config or members is missing (fail closed)', () => {
    assert.equal(guards.rosterLogins(undefined).size, 0);
    assert.equal(guards.rosterLogins({}).size, 0);
    assert.equal(guards.rosterLogins({ members: 'nope' }).size, 0);
  });

  it('skips members with a blank or missing login', () => {
    const roster = guards.rosterLogins({ members: [{ login: '   ' }, { name: 'No Login' }, null, ' Shaal '] });
    assert.deepEqual([...roster], ['shaal']);
  });
});

describe('filterRosterVotes', () => {
  const roster = () => guards.rosterLogins(config);

  it('counts a roster member vote', () => {
    const r = guards.filterRosterVotes(
      [comment('shaal', '/vote escalate')], roster(), 'someone-else', parseEscalation);
    assert.deepEqual(r.votes, { shaal: 'escalate' });
    assert.equal(r.ignoredNonRoster, 0);
  });

  it('ignores a vote from a commenter who is not on the roster', () => {
    const r = guards.filterRosterVotes(
      [comment('random-passerby', '/vote escalate'), comment('shaal', '/vote no-escalate')],
      roster(), 'someone-else', parseEscalation);
    assert.deepEqual(r.votes, { shaal: 'no-escalate' });
    assert.equal(r.ignoredNonRoster, 1);
  });

  it('ignores a vote from a listed contributor (contributors are non-voting)', () => {
    const r = guards.filterRosterVotes(
      [comment('CraftsMan-Labs', '/vote escalate')], roster(), 'someone-else', parseEscalation);
    assert.deepEqual(r.votes, {});
    assert.equal(r.ignoredNonRoster, 1);
  });

  it('ignores the submitter even when the submitter is on the roster', () => {
    const r = guards.filterRosterVotes(
      [comment('mrjcleaver', '/vote escalate'), comment('shaal', '/vote escalate')],
      roster(), 'mrjcleaver', parseEscalation);
    assert.deepEqual(r.votes, { shaal: 'escalate' });
    // The submitter is excluded by SEC-012, not counted as a non-roster vote.
    assert.equal(r.ignoredNonRoster, 0);
  });

  it('matches the submitter case-insensitively', () => {
    const r = guards.filterRosterVotes(
      [comment('MrJCleaver', '/vote escalate')], roster(), 'mrjcleaver', parseEscalation);
    assert.deepEqual(r.votes, {});
  });

  it('matches roster logins case-insensitively', () => {
    const r = guards.filterRosterVotes(
      [comment('Nicholas-Ruest', '/vote escalate')], roster(), 'someone-else', parseEscalation);
    assert.deepEqual(r.votes, { 'nicholas-ruest': 'escalate' });
    assert.equal(r.ignoredNonRoster, 0);
  });

  it('accepts a roster given as a plain array of logins', () => {
    const r = guards.filterRosterVotes(
      [comment('SHAAL', '/vote escalate')], ['Shaal'], 'someone-else', parseEscalation);
    assert.deepEqual(r.votes, { shaal: 'escalate' });
  });

  it('keeps only the last vote per member', () => {
    const r = guards.filterRosterVotes(
      [
        comment('shaal', '/vote escalate'),
        comment('nicholas-ruest', '/vote escalate'),
        comment('Shaal', '/vote no-escalate'),
      ],
      roster(), 'someone-else', parseEscalation);
    assert.deepEqual(r.votes, { shaal: 'no-escalate', 'nicholas-ruest': 'escalate' });
  });

  it('ignores bot comments and non-vote comments', () => {
    const r = guards.filterRosterVotes(
      [
        comment('github-actions[bot]', '/vote escalate', 'Bot'),
        comment('shaal', 'I think we should /vote escalate later'),
        comment('shaal', 'lgtm'),
      ],
      roster(), 'someone-else', parseEscalation);
    assert.deepEqual(r.votes, {});
    assert.equal(r.ignoredNonRoster, 0);
  });

  it('counts each non-roster voter once however many times they vote', () => {
    const r = guards.filterRosterVotes(
      [
        comment('outsider', '/vote escalate'),
        comment('outsider', '/vote no-escalate'),
        comment('Outsider', '/vote escalate'),
        comment('other-outsider', '/vote escalate'),
      ],
      roster(), 'someone-else', parseEscalation);
    assert.deepEqual(r.votes, {});
    assert.equal(r.ignoredNonRoster, 2);
  });

  it('does not count non-vote chatter from non-roster users as ignored votes', () => {
    const r = guards.filterRosterVotes(
      [comment('outsider', 'nice project')], roster(), 'someone-else', parseEscalation);
    assert.equal(r.ignoredNonRoster, 0);
  });

  it('counts nothing when the roster is empty (fail closed)', () => {
    const r = guards.filterRosterVotes(
      [comment('shaal', '/vote escalate')], new Set(), 'someone-else', parseEscalation);
    assert.deepEqual(r.votes, {});
    assert.equal(r.ignoredNonRoster, 1);
  });

  it('tolerates comments with a null user or body', () => {
    const r = guards.filterRosterVotes(
      [{ user: null, body: '/vote escalate' }, { user: { login: 'shaal', type: 'User' }, body: null }],
      roster(), 'someone-else', parseEscalation);
    assert.deepEqual(r.votes, {});
  });
});

describe('vote parsers used by the workflows', () => {
  it('parseEscalationVote', () => {
    assert.equal(guards.parseEscalationVote('/vote escalate'), 'escalate');
    assert.equal(guards.parseEscalationVote('  /vote no-escalate  '), 'no-escalate');
    assert.equal(guards.parseEscalationVote('/vote escalate please'), null);
  });

  it('parseValidationVote prefers approve-with-conditions over approve', () => {
    assert.equal(guards.parseValidationVote('/vote approve-with-conditions'), 'approve-with-conditions');
    assert.equal(guards.parseValidationVote('/vote approve'), 'approve');
    assert.equal(guards.parseValidationVote('/vote decline'), 'decline');
    assert.equal(guards.parseValidationVote('/vote defer'), 'defer');
    assert.equal(guards.parseValidationVote('/vote approved'), null);
  });

  it('parseRetractionVote requires the exact trimmed string', () => {
    assert.equal(guards.parseRetractionVote('/vote retract'), 'retract');
    assert.equal(guards.parseRetractionVote(' /vote no-retract\n'), 'no-retract');
    assert.equal(guards.parseRetractionVote('/vote retract now'), null);
  });
});
