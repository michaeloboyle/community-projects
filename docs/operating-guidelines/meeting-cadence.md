---
author: Michael O'Boyle
author_github: "@michaeloboyle"
maintainer: Michael O'Boyle
maintainer_github: "@michaeloboyle"
status: adopted
---

# OSS Committee Meeting Cadence

> This document is a companion to the [Committee Charter](committee-charter.md).
> The charter sets who decides and how votes work; this document sets when and
> how the committee meets to do that work. Where this cadence and the charter
> differ, the charter governs. Amend via pull request, not by editing a Google
> Doc or a calendar entry alone.
>
> Cadence and meeting logistics are the Chair's call to set (@michaeloboyle),
> confirmed by the committee. Changes to voting, quorum, or scoring live in the
> charter, not here.

## 1. Regular meeting

The committee meets on a fixed weekly slot so members can plan around it and so
the meeting does not depend on ad hoc scheduling each week.

| Field | Value |
|---|---|
| Day | Wednesday, every week |
| Time | 13:00 to 14:00 America/New_York (Eastern) |
| Platform | Google Meet |
| Meet link | https://meet.google.com/ysn-drms-mkj |
| Calendar | Agentics Foundation calendar (agent@agentics.org) |
| Chair | @michaeloboyle |

The slot is fixed in local Eastern time. When the United States observes
Daylight Saving Time the meeting is 13:00 EDT; in standard time it is 13:00 EST.
The wall-clock hour does not move, so members outside the US should expect their
own local time to shift by one hour at the two US DST transitions.

## 2. Calendar hygiene

The recurring event MUST live on the Agentics Foundation calendar
(agent@agentics.org) as a single owned recurring series, not only as a Meet link
passed around informally. A committee whose meeting exists only as a link in
chat has no durable invitation, no attendee list, and no reminder.

Requirements for the series:

1. Owned by the Foundation calendar, with the Chair (@michaeloboyle) and active
   committee members as guests.
2. Google Meet attached, using the standing link above.
3. Gemini meeting notes enabled, so a transcript and summary generate
   automatically (see section 5).
4. Reviewed whenever committee membership changes, so the guest list stays
   current.

Standing action: transfer and own the recurring event on the Agentics calendar.
This closes the long-running gap where the meeting ran on a bare Meet link with
no recurring calendar block. Coordinate with @nicholas-ruest for calendar
ownership if the Chair cannot own the series directly.

## 3. Quorum and decisions

Quorum for a meeting follows the charter: a simple majority of active committee
members must be present for the committee to take binding votes. See
[committee-charter.md](committee-charter.md) section 7 for the authoritative
quorum and voting rules.

If quorum is not met, the meeting still runs as a working session (discovery,
review, agenda-setting) but records no binding votes. Any decision that needs a
vote carries to the next meeting or to an async vote (section 6).

Substantive decisions are recorded in GitHub, not in Discord or in the meeting
chat. A decision reached verbally becomes binding only once it has a
corresponding GitHub artifact: a merged pull request, a closed issue, or a
recorded vote tally. Discord is the discovery layer; GitHub is the governance
layer.

## 4. Meeting structure

The Chair opens every meeting with an honest-accounting status of the prior
week's commitments before moving to new business:

1. Prior-week commitments: each item marked done, not done, or partial, with a
   link to the evidence (PR, issue, or comment).
2. New business: agenda items in priority order.
3. Decisions and votes: taken only with quorum, recorded in GitHub.
4. Action items: assigned to a named owner with an @mention, captured in the
   notes and in the next agenda.

The Chair controls framing, not detail. The Chair introduces the framing for
each item, defers to the relevant member on substance, and re-anchors when
discussion drifts. Tasks are not assigned to a member without prior discussion
with that member.

## 5. Notes and record

Every meeting produces a durable record:

1. Gemini auto-notes generate from the Meet session (requires section 2 to be in
   place).
2. The Chair files a meeting summary in the committee record within 48 hours.
3. Action items and decisions are reflected in GitHub issues and pull requests,
   so the audit trail lives in the repo, not only in a notes document.

If auto-notes fail for a given week, the Chair takes manual notes and files them
on the same 48-hour cadence. The primary artifacts of a meeting are the GitHub
changes it produces, so a notes failure does not erase the meeting's record.

## 6. Async fallback

Not every decision needs a live meeting. When a decision is well-defined and
does not need discussion, the committee may vote asynchronously:

1. The item is posted as a GitHub issue or pull request with the options stated.
2. Members vote by comment within a stated window (default 72 hours).
3. The same quorum and simple-majority rules apply, computed against eligible
   voters after any recusals.
4. The Chair records the tally and the outcome on the issue or pull request.

Async voting keeps momentum between weekly meetings and prevents low-controversy
items from waiting a full week.

## 7. Cancellation and holidays

If the Chair or a quorum of members cannot attend, the Chair announces
cancellation on the committee channel at least 24 hours ahead where possible, and
either moves urgent items to async (section 6) or carries them to the next
meeting. US federal holidays that fall on a Wednesday default to cancellation
unless the committee agrees otherwise in advance.

## 8. Amendment

This document is amended by pull request against
`docs/operating-guidelines/meeting-cadence.md`, reviewed by the committee. The
cadence, slot, and logistics are the Chair's to propose; the committee confirms.
Changes that touch quorum, voting, or scoring belong in the charter, not here.
