#!/usr/bin/env bash
# Creates all labels for the community-projects repo.
# Idempotent — safe to run multiple times (--force overwrites).
# Usage: ./scripts/setup-labels.sh [owner/repo]

set -euo pipefail

REPO="${1:-agenticsorg/community-projects}"

echo "Setting up labels for $REPO..."

# Status labels
gh label create "status:pending-review" --color "FBCA04" --description "Awaiting committee review" --repo "$REPO" --force
gh label create "status:scoring"        --color "E68A00" --description "Committee scoring in progress" --repo "$REPO" --force
gh label create "status:escalation-vote" --color "7B61FF" --description "Escalation vote in progress" --repo "$REPO" --force
gh label create "status:validation-vote" --color "1D76DB" --description "Validation vote in progress" --repo "$REPO" --force
gh label create "status:approved"       --color "0E8A16" --description "Approved by committee" --repo "$REPO" --force
gh label create "status:declined"       --color "D73A49" --description "Declined by committee" --repo "$REPO" --force
gh label create "status:deferred"       --color "959DA5" --description "Deferred — more info needed" --repo "$REPO" --force
gh label create "status:retracted"      --color "86181D" --description "Approval retracted" --repo "$REPO" --force
gh label create "escalated"             --color "5319E7" --description "Escalated to senior leadership" --repo "$REPO" --force

# Category labels
gh label create "category:donation"       --color "BFD4F2" --description "Project Donation" --repo "$REPO" --force
gh label create "category:website-listing" --color "C5DEF5" --description "Website Listing" --repo "$REPO" --force
gh label create "category:cofounder"      --color "D4C5F9" --description "Co-Founder Search" --repo "$REPO" --force
gh label create "category:support"        --color "FEF2C0" --description "Problem Support" --repo "$REPO" --force
gh label create "category:contributors"   --color "BFDADC" --description "Contributor Engagement" --repo "$REPO" --force

echo "All labels created successfully."
