# Agentics Foundation — Community Projects

Open source project intake and governance for the [Agentics Foundation](https://agentics.org).

Members of the Agentics Foundation can submit open source projects for review, support, collaboration, or inclusion in Foundation activities.

## Submit a Project

**[Submit your project here](../../issues/new?template=project-submission.yml)**

You must be a registered Foundation member in good standing. Your project must be in a public repository with a declared open source license.

### Submission Categories

| Category | What it means |
|----------|---------------|
| **Project Donation** | Transfer long-term stewardship to the Foundation |
| **Website Listing** | Featured on the Agentics Foundation website |
| **Co-Founder Search** | Connect with potential co-founders from membership |
| **Problem Support** | Help from members on a technical/architectural/organizational challenge |
| **Contributor Engagement** | Attract contributors, reviewers, or collaborators |

## Review Process

1. **Submit** — Fill out the issue template with your project details
2. **Triage** — Automated labeling and acknowledgment
3. **Scoring** — Committee members score using the [scoring rubric](docs/scoring-template.md) (5 criteria, 0–5 each, max 25)
4. **Escalation Vote** — Does this need senior leadership review? (majority vote)
5. **Validation Vote** — Approve, decline, or defer (majority vote)
6. **Registration** — Approved projects are added to `data/approved-projects.json`

Decisions can be revisited. Any committee member may propose retraction of a previously approved project if grounds exist.

## For Committee Members

### Scoring

Post a score comment on any submission issue:

```
/score mission:4 quality:3 clarity:5 impact:4 risk:3
```

See the full [scoring template](docs/scoring-template.md) for criteria details and interpretation.

### Voting

| Command | When to use |
|---------|-------------|
| `/vote escalate` | Escalation vote: requires senior leadership review |
| `/vote no-escalate` | Escalation vote: no escalation needed |
| `/vote approve` | Validation vote: approve the submission |
| `/vote decline` | Validation vote: decline the submission |
| `/vote defer` | Validation vote: defer pending more info |
| `/retract` | Propose retraction of a previously approved project |
| `/vote retract` | Vote to retract approval |

All votes require a quorum of 3 and pass by simple majority.

### Labels

| Label | Meaning |
|-------|---------|
| `status:pending-review` | Awaiting committee review |
| `status:scoring` | Scoring in progress |
| `status:escalation-vote` | Escalation vote underway |
| `status:validation-vote` | Validation vote underway |
| `status:approved` | Approved by committee |
| `status:declined` | Declined |
| `status:deferred` | Deferred, more info needed |
| `status:retracted` | Approval retracted |
| `escalated` | Sent to senior leadership |

## Governance

This intake process is defined by the [Open Source Project Intake: Rules and Processes](https://docs.google.com/document/d/1-WCg3ArxhllUpdyk1tJu3bHkQf92tdUm0u80GDM0Vj4/edit) governance document, maintained by the Open Source Committee.

## Setup (for repo admins)

To create all labels:

```bash
./scripts/setup-labels.sh agenticsorg/community-projects
```
