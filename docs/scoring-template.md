# Scoring Template

Committee members: copy the block below into an issue comment to submit your score.

## Slash Command Format

Post this as a comment on the submission issue:

```
/score mission:_ quality:_ clarity:_ impact:_ risk:_
```

Replace each `_` with a score from 0–5. Example:

```
/score mission:4 quality:3 clarity:5 impact:4 risk:3
```

**Total = sum of all five scores (max 25).**

## Score Scale

| Score | Meaning |
|-------|---------|
| 0 | Does not meet minimum expectations |
| 1 | Very weak alignment or quality |
| 2 | Below average, material gaps |
| 3 | Acceptable / baseline |
| 4 | Strong |
| 5 | Exceptional |

## Criteria

1. **Mission & Values Alignment (mission)** — Relevance to agentic AI ecosystem, open source values, absence of harmful intent
2. **Project Quality & Maturity (quality)** — Repo structure, documentation, license clarity, evidence of working code
3. **Clarity of Request (clarity)** — Specificity of description, feasibility, alignment between category and request
4. **Community Impact (impact)** — Collaboration potential, relevance to members, likelihood of engagement
5. **Risk & Governance (risk)** — IP/licensing clarity, security, dependency risks. **Inverted: lower risk = higher score**

## Score Interpretation

| Total | Suggested Outcome |
|-------|-------------------|
| 21–25 | Strong candidate for approval or escalation |
| 16–20 | Approve or approve with conditions |
| 11–15 | Defer or request clarification |
| 0–10 | Decline |

## Full Score Sheet (for detailed notes)

```
Submission ID: #___
Project Name:
Category:
Reviewer:
Date:

Criterion                        | Score (0–5) | Notes
Mission & Values Alignment       |             |
Project Quality & Maturity       |             |
Clarity of Request               |             |
Community Impact                 |             |
Risk & Governance (inverse)      |             |
                          Total:   ___ / 25

Flags:
[ ] Donation / Stewardship implications
[ ] Legal or licensing concern
[ ] Reputational risk
[ ] Security or safety concern
[ ] Conflict of interest

Recommendation:
[ ] Escalate  [ ] Approve  [ ] Approve with Conditions
[ ] Defer     [ ] Decline
```

## Voting Commands

After scoring, use these commands in issue comments:

- `/vote escalate` — This submission should be escalated to senior leadership
- `/vote no-escalate` — No escalation needed
- `/vote approve` — Approve the submission
- `/vote decline` — Decline the submission
- `/vote defer` — Defer pending more information
- `/retract` — Propose retraction of a previously approved project
- `/vote retract` — Vote to retract approval
