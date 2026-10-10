# Website Listing Standard, v0 (proposed)

Applies the automated track in Section 7a of the committee charter. Each check is
**blocking** (a failure sends the submission to the two-vote path) or
**advisory** (published on the listing, never blocks). A check is promoted from
advisory to blocking only by a pull request that records its calibration:
coverage and false-positive rate on a labelled sample.

| # | Check | Mode | Source |
|---|---|---|---|
| 1 | Intake validation passed: member in good standing, complete submission | blocking | intake workflow (charter S7 Step 1) |
| 2 | Repository is public | blocking | GitHub API |
| 3 | License detected as OSI-approved by GitHub (`NOASSERTION` fails) | blocking | GitHub API |
| 4 | OIA classification recorded in the matrix | blocking | OIA Classification workflow |
| 5 | No automatic escalation trigger flagged in the case brief | blocking | Governance Agent |
| 6 | Submitter is not a committee member | blocking | `data/committee-config.json` |
| 7 | Agentic QE security scan (Dragan Spiridonov, `agentic-qe`, pinned version) on the latest release | advisory | per-release scan |
| 8 | Agentic QE quality assessment on the latest release | advisory | per-release scan |

## Why checks 7 and 8 start as advisory

A keyless probe of `agentic-qe@3.15.0` on the five pending submissions
(2026-10-09) found:

| Repository | Files scanned | Findings |
|---|---|---|
| RobLe3/IICP @ v1.10.17 | 5 of 125 | 1 "critical" AWS secret, which is a git commit hash: false positive |
| RobLe3/iicp-client-rust @ v0.7.109 | 0 of 139 | none (Rust not analysed) |
| RobLe3/iicp-directory-rust @ v0.1.15 | 0 of 82 | none (Rust not analysed) |
| bar181/aisp-open-core @ main | not run | no analysable input |
| michaeloboyle/iicp-node-monitor @ main | 0 of 3 | unsupported |

The quality assessment exited on every repository with "No measured quality
evidence found for coverage". Blocking on these results would have refused a
listing over a false positive while scanning almost nothing else. They become
blocking when a calibrated configuration shows useful coverage.
