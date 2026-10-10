---
author: Michael O'Boyle
author_github: "@michaeloboyle"
maintainer: Michael O'Boyle
maintainer_github: "@michaeloboyle"
status: draft
target: agenticsorg/community-projects#9
---

# Agentics Foundation Open Source Committee Charter

> This charter is container #5 (Committee Operating Guidelines) in the
> 2026-05-13 five-container scope model. Per issue #9, it lives in the repo as
> version-controlled markdown at `docs/operating-guidelines/committee-charter.md`,
> amended via pull request, not as a Google Doc.
>
> Authority chain: this charter flows from the Agentics Foundation mission and
> vision (agenticsorg/.github profile/README.md) above it, and sits above the
> mechanical OSS Intake Process (the intake state machine) and the day-to-day
> Operating Principles (issue #25) below it. Where this charter and the canonical
> governance document differ, the governance document and the Board govern; this
> charter codifies current rules rather than changing them.

## 1. Establishment and Authority

The Open Source Committee is a standing committee of the Agentics Foundation,
established by and accountable to the Board of Directors. The Board or its
delegate appoints committee members and the Chair, and may modify, delegate, or
revoke the committee's authority (Bylaws Article X, Sections 10.1 and 10.7).

This charter is the durable statement of the committee's mission, scope,
membership, voting model, and Chair responsibilities. It is the committee's
operating constitution; mechanical workflow detail lives in the intake process,
and day-to-day working rules live in the operating principles.

## 2. Mission

The Open Source Committee supports, coordinates, and stewards high-quality open
source projects that advance the agentic AI ecosystem. It operates a controlled,
member-only intake process so the Foundation can review projects for support,
collaboration, endorsement, or long-term stewardship in a way that is
transparent, auditable, and fair to submitters.

This mission flows directly from the Foundation's own mission to "foster
innovation, promote collaboration, and build a dynamic community around
transformative agentic technologies" and its commitment to community-driven
innovation, ethical AI development, accessible technology, and practical
applications (agenticsorg/.github profile/README.md). The committee is the
Foundation's governance and signal-filtering body for the open source surface of
that mission. It is not an execution or development team.

## 3. Scope

### In scope

- Member-only intake of open source projects across the five request categories:
  Project Donation, Website Listing, Co-Founder Search, Problem Support, and
  Contributor Engagement (Bylaws Section 10.3).
- Review and scoring of submissions against the committee's 25-point rubric
  (five criteria, 0 to 5 each; see Section 6).
- Classification of projects under the adoption tiers (see Section 5).
- Retraction review of previously approved projects when grounds exist.
- Maintaining quality, integrity, and mission alignment across supported
  projects.

### Out of scope

- Submissions from non-members or members not in good standing.
- Decisions reserved to the Board or senior Foundation leadership (escalated
  matters).
- Projects with unclear licensing, IP infringement, or code-of-conduct
  violations (declined without scoring).
- Assuming ownership of, or liability for, member projects, except Foundation-Owned
  (T1) repositories the Foundation already holds.
- Binding the Foundation to legal, financial, or IP obligations. The committee
  recommends; the Board commits.

## 4. Membership and the Chair

### Membership

- Members are appointed by the Board or its delegate and must be active Agentics
  Foundation members in good standing.
- The committee may include technical, governance, and community
  representatives.
- Membership and roles are maintained in the committee's records, not inferred
  from repository access. (Repository permissions are an operational reality, not
  a grant of committee membership; see the permissions note in Section 9.)
- The authoritative membership roster is the committee configuration committed to
  the repository (`data/committee-config.json`). Current voting members:
  @michaeloboyle (Chair), @nicholas-ruest, @mrjcleaver, @shaal, @inde5media, and
  @rcraw (Robert Ranson). Roster changes are made by PR with Chair approval.
- Foundation leadership (for example the Treasurer, Secretary, and Board Chair)
  and Legal Counsel (Kenneth Carter, on CLA, DCO, and IP matters) may participate
  in an advisory capacity without being voting committee members.

### The Chair

- The Chair (@michaeloboyle, pending Board ratification of the 2026-05-05
  appointment) facilitates meetings, sets agendas, and maintains the committee's
  records and artifacts.
- The Chair's role is to find, retain, and reactivate volunteers and to make the
  committee's judgment efficient, not to perform all the committee's work
  (Nick Ruest's role-shift framing, 2026-05-06).
- The Chair does not hold a tie-breaking or super vote. The Chair votes as one
  member. Ties resolve as "no decision" and carry to the next meeting unless the
  committee agrees otherwise.

## 5. Adoption Tiers

Every intake decision categorizes a project into one of three adoption tiers
(2026-04-23 Tier Model; tracked in issue #10, names still open for confirmation).

| Tier | Name | Definition | Examples |
|------|------|------------|----------|
| T1 | Foundation-Owned | Repository under `agenticsorg`; Foundation controls merge, CI, and CLA. | `community-projects`, `OIA-Model` |
| T2 | Foundation-Endorsed | Repository stays with its author; Foundation certifies CI, CLA, and a review SLA; listed on the website. | approved-through-intake projects |
| T3 | Community-Associated | Listed in the ecosystem with no guarantees; the default state. | member projects, no formal endorsement |

Tier placement and promotion criteria are maintained in issue #10 and applied at
review. The committee does not choose winners among competing projects; multiple
projects may be approved (governance doc, Edge Case B).

## 6. Scoring Rubric

Submissions are scored against five criteria, each 0 to 5, for a 25-point total.
The rubric is a specification: it is changed only by committee process, never to
make a particular project pass.

1. **Mission and Values Alignment** (0-5): relevance to agentic AI,
   infrastructure, governance, or ecosystem enablement; alignment with open
   source values; absence of harmful, deceptive, or exploitative intent.
2. **Project Quality and Maturity** (0-5): repository structure, documentation,
   license clarity, evidence of working code, issue hygiene.
3. **Clarity of Request** (0-5): specificity and feasibility of the request;
   alignment between the selected category and the description.
4. **Community Impact and Engagement Potential** (0-5): opportunity for
   collaboration or learning; relevance to multiple members; likelihood of
   attracting contributors.
5. **Risk and Governance Considerations** (0-5, inverted): IP or licensing
   ambiguity, security or safety concerns, dependency risks, governance
   complexity. Lower risk scores higher.

Score interpretation (guidance only; the committee may override with rationale):
21-25 strong candidate for approval or escalation; 16-20 approve or approve with
conditions; 11-15 defer or request clarification; 0-10 decline.

## 7. Decision and Voting Model

All submissions are reviewed during scheduled committee meetings, except Website
Listing submissions that qualify for the automated track in Section 7a. Two sequential
votes govern each submission, each decided by a simple majority (50% + 1) of
voting members present (governance doc Sections 6 and 7).

**Step 1: Intake validation.** Is the submitter a registered member in good
standing? Is the repository public and licensed? Is the submission complete?
If no, the submission is declined without scoring.

**Step 2: Scoring.** Eligible members score the submission against the rubric.

**Vote 1: Escalation Determination.** "Does this submission require escalation to
senior leadership of the Foundation?" A simple majority triggers escalation.
Automatic escalation triggers, independent of score: project donations; legal,
licensing, or IP concerns; potential core Foundation assets; reputational risk
despite a high score. If escalated, the matter is referred to senior leadership
and the committee does not hold Vote 2.

**Vote 2: Validation Decision** (only if not escalated). "Should this request be
approved and supported by the Foundation?" Outcomes: Approved, Approved with
Conditions, Declined, or Deferred (more information required).

**Quorum.** A simple majority of active committee members. Meetings may be
conducted virtually.

**Conflict of interest.** A member who is a contributor, maintainer, co-founder,
or financially involved in a submission must declare the conflict and recuse from
discussion and voting. Recusals and abstentions are recorded but do not affect
quorum. Two mechanisms apply: submitter exclusion is mechanical (the intake
system bars the submitter from voting on their own submission and its retraction),
and `/coi` is voluntary (non-submitting members declare their own conflicts; the
committee never auto-recuses a non-submitter).

## 7a. Website Listing: Automated Track

Reviewer participation is not a precondition for a Website Listing. A listing is
a visibility decision, the lowest-stakes category, and it is reversible through
retraction (Section 8). For that category only, the committee exercises its
judgment once, by adopting a published standard, and agents apply it.

- **Scope.** Website Listing submissions only. Donations, co-founder search,
  problem support, and any submission that meets an automatic escalation trigger
  (Section 7) never take this track.
- **Listing Standard.** The checks live in
  `docs/operating-guidelines/listing-standard.md`, versioned by pull request. The
  committee adopts each version by majority vote (Section 7).
- **Automatic listing.** A submission that passes every blocking check in the
  current standard is listed after a 7-day objection window, with no score or
  vote required. Scores and endorsements are optional; when given, they appear
  on the listing.
- **Hold.** During the window, any one committee member may comment `/hold` to
  move the submission to the two-vote path. A hold needs no reason and no
  second.
- **Conflicts.** A submission from a committee member, including the Chair,
  never takes the automated track.
- **Per-release scans.** Each new release of a listed repository is scanned
  under the standard. A regression publishes a quality advisory on the listing.
  It does not delist. Retraction stays a human decision under Section 8.
- **Calibration before blocking.** A check may become blocking only after it
  shows its false-positive rate and coverage on a labelled sample, recorded with
  the pull request that promotes it. Until then it is advisory.

## 8. Retraction Authority

- Any member may propose retraction of a previously approved project.
- Grounds: conduct violations, licensing or IP changes, misrepresentation,
  reputational, legal, or governance risk, or loss of membership standing.
  Inactivity alone is not grounds; inactivity plus community confusion or risk may
  trigger a retraction review.
- The project is re-scored against the rubric (emphasis on Risk and Governance,
  Mission Alignment, and ongoing Quality), and the committee votes (50% + 1).
  High-risk cases may be escalated. The submitter does not vote on the retraction
  of their own project.
- Retraction removes the project from the website and withdraws Foundation support.
  It does not constitute a claim against the project.

## 9. Records, Transparency, and Decision Recording

- Decisions, action items, and working artifacts live as tracked GitHub issues
  with named owners, not as prose in meeting notes (operating principle: issues
  over documents). If it matters, it has an issue number.
- Every status change, score, and vote leaves a durable trail in the issue and
  the attestation log. Substantive proposals are not actioned on Discord alone;
  Discord is the discovery layer, GitHub is the governance layer.
- Scores and deliberations are confidential unless the committee determines
  otherwise. The confidentiality model is itself an open decision (issue #27).
  Submitters are notified of outcomes.
- **Decision-recording convention.** A decision is recorded as: (a) an **AF-GOV
  document** when it is a durable Foundation-level governance rule; (b) an **ADR**
  (in a `docs/ADRs/` directory, to be created when the first ADR is written) when
  it is an architectural decision about the intake system or committee tooling;
  (c) a **tracking issue** for everything else (most decisions,
  per the issues-over-documents principle). When in doubt, open an issue.
- **Permissions note.** Committee membership is recorded in
  `data/committee-config.json`, independent of GitHub repository access. As of
  this draft, most members including the Chair hold pull-only access; obtaining
  maintain or admin access from @ruvnet is a standing operational item and does
  not affect who is a committee member.

## 10. Security and Vulnerability Handling

The committee treats supply-chain risk and malicious-code insertion as
first-order concerns, given how rapidly code is now generated (June 3 2026
framing).

- **Private vulnerability reporting channel.** Security issues in Foundation-Owned
  (T1) or Foundation-Endorsed (T2) projects are reported through a private channel
  (GitHub private vulnerability reporting / security advisories), never as a public
  issue (June 3 2026 decision; tracked as issue #13, Zero Day Protocols).
- **Coordinated disclosure.** The committee acknowledges a report, assesses
  severity, coordinates a fix with the maintainer, and publishes an advisory only
  after a fix or an agreed disclosure window. Zero-day handling is escalated to the
  Chair and, where reputational or legal risk exists, to senior leadership.
- **Pre-review risk screening.** Submissions are screened for package and
  dependency risk (for example via Snyk) as part of the Risk and Governance
  criterion before approval.
- The concrete zero-day protocol (severity tiers, response times, disclosure
  windows) is to be specified in issue #13 with @shaal; this charter establishes
  the posture, not the runbook.

## 11. Contribution, License, CLA, and DCO Posture

- Submitted and supported projects must be open source under a clear, declared
  license (Bylaws Section 10.2).
- **DCO over CLA for ordinary contributions.** Contributions to Foundation-Owned
  repositories use the Developer Certificate of Origin (a `Signed-off-by` trailer),
  which is lightweight and does not assign copyright. This is the committee's
  preferred default; final selection is subject to Legal Counsel (Kenneth Carter).
- **Project donations require a separate instrument.** Accepting a project as a
  donation (transfer of a repository, trademark, or maintainer obligations to the
  Foundation) requires a CLA or IP-transfer agreement that does not yet exist
  (AF-GOV-003 deferred it). Until that instrument is drafted and reviewed by Legal
  Counsel, the committee may accept, score, and route a donation submission but a
  donation cannot complete. This gates the SummaryBot pilot (issue #33) and any
  future donation. This is a known blocker, not a settled policy.

## 12. Meetings and Cadence

- The committee meets weekly on Wednesdays at 13:00 ET (the Agentics Open Source
  Meeting), conducted virtually.
- The Chair publishes an agenda before each meeting and records outcomes as
  GitHub issues and meeting summaries.
- Regular cadence is determined by the committee and may change by committee
  decision.

## 13. Operating Principle

**Humans judge, agents execute** (AF-GOV-002). Automation handles analysis,
logistics, triage, case preparation, and infrastructure. Committee members cast
every vote and make every escalation and retraction decision, and every approval
decision outside the automated listing track. Within that track (Section 7a), the
committee judges by adopting and amending the Listing Standard, and agents apply
it. Agents
never cast votes, decide escalation, or propose retraction. The committee's human
judgment is the point; tooling exists to make that judgment efficient and
well-informed.

## 14. Amendments

This charter is amended by pull request against
`docs/operating-guidelines/committee-charter.md`, reviewed by the committee, and
ratified by merge. Amendments that change Foundation-level governance, or that the
Board has reserved to itself, additionally require Board ratification (Bylaws
Section 10.7).
