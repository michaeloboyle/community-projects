# Agentics Foundation OSS Committee -- Meeting Repo Registry
# Source: Issue #11 (candidate pool for first consideration);
#         AF meeting chats/transcripts + AF-Member-Intelligence (Feb-Jul 2026);
#         OIA-as-attractor plan (2026-07-13) -- the registry is the warm-lead
#         target list of repos to assess against OIA.
# Status: RED (no implementation)
#
# Purpose: turn "repos people mentioned in AF meetings" into a maintained,
# public-safe registry, each entry attributed to who introduced it and when,
# so the committee has a candidate pool it can grade against OIA.

@issue-11 @registry
Feature: Meeting repo registry
  As the OSS committee chair
  I need every repo introduced in an AF meeting captured with its introducer and first-seen date
  So that the committee has an auditable candidate pool to assess against OIA

  # ──────────────────────────────────────────────────────────
  # Definitions (the judgment calls, made explicit)
  #  - A "mention" is one occurrence of a repo in one source.
  #  - The "introducer" is the speaker of the EARLIEST mention
  #    (first to bring it into a meeting), NOT the repo's owner.
  #    Owner is recorded separately when known.
  #  - "first_seen" is the date of the earliest mention.
  #  - A repo is identified by a canonical key: "owner/name" when a
  #    GitHub URL is known, else a slugged project name.
  # ──────────────────────────────────────────────────────────

  # ---- Extraction ----

  @extraction @url
  Scenario: A GitHub URL in a chat line is captured as a mention
    Given a source dated "2026-04-09" with the chat line "Rishub: check out https://github.com/CraftsMan-Labs/SimpleAgents"
    When the registry is built
    Then the registry contains a repo with canonical key "CraftsMan-Labs/SimpleAgents"
    And its introducer is "Rishub"
    And its first_seen date is "2026-04-09"
    And its owner is "CraftsMan-Labs"

  @extraction @lexicon
  Scenario: A known project named without a URL is captured via the lexicon
    Given a source dated "2026-04-10" with the chat line "Stuart: WeftOS is the one to watch"
    And the lexicon maps "WeftOS" to canonical key "weftos"
    When the registry is built
    Then the registry contains a repo with canonical key "weftos"
    And its introducer is "Stuart"

  @extraction @noise
  Scenario: The generic word "repo" alone does not create an entry
    Given a source dated "2026-06-18" with the line "So you got a repo harness, point it at some random repo"
    When the registry is built
    Then the registry contains no repo for that line

  # ---- Attribution ----

  @attribution @earliest-wins
  Scenario: The introducer is the earliest speaker, later mentions do not override
    Given a source dated "2026-03-13" with the chat line "Stuart: pi.ruv.io overview attached"
    And a source dated "2026-04-24" with the chat line "Reuven: pi.ruv.io is my go-to"
    When the registry is built
    Then the repo "pi.ruv.io" has introducer "Stuart"
    And its first_seen date is "2026-03-13"
    And its mention_count is 2

  @attribution @unknown-speaker
  Scenario: A mention with no resolvable speaker is kept but flagged
    Given a source dated "2026-05-20" with the line "https://github.com/ruvnet/ruflo was merged"
    When the registry is built
    Then the repo "ruvnet/ruflo" has introducer "unknown"
    And the repo is flagged "introducer-unverified"

  # ---- Seed merge (Feb-Apr member-intelligence already extracted) ----

  @seed @merge
  Scenario: A curated seed entry merges with a later automated mention
    Given a seed entry for "agenticsorg/OIA-Model" introduced by "nicholas-ruest" on "2026-02-19"
    And a source dated "2026-06-24" mentioning "https://github.com/agenticsorg/OIA-Model"
    When the registry is built
    Then the registry contains exactly one repo "agenticsorg/OIA-Model"
    And its introducer is "nicholas-ruest"
    And its first_seen date is "2026-02-19"
    And its mention_count is at least 2

  # ---- Deduplication ----

  @dedupe
  Scenario: URL and lexicon references to the same repo collapse to one entry
    Given a source dated "2026-04-09" with the chat line "Rishub: https://github.com/CraftsMan-Labs/SimpleAgents"
    And the lexicon maps "SimpleAgents" to canonical key "CraftsMan-Labs/SimpleAgents"
    And a source dated "2026-04-09" with the chat line "Martin: loving SimpleAgents"
    When the registry is built
    Then the registry contains exactly one repo "CraftsMan-Labs/SimpleAgents"
    And its mention_count is 2

  # ---- Output contract (public-safe projection) ----

  @output @public-safe
  Scenario: The published registry carries no personal contact information
    Given any built registry
    When it is written to the public output file
    Then each entry has only the fields: canonical, name, owner, url, introducer, first_seen, mention_count, sources, flags
    And no entry contains an email address or phone number

  @output @deterministic
  Scenario: Rebuilding the same inputs produces the same registry
    Given a fixed set of sources and a fixed seed
    When the registry is built twice
    Then the two registries are byte-identical except for a generated_at timestamp

  # ---- Coverage honesty ----

  @coverage @honesty
  Scenario: Sources that were not parsed are reported, never silently dropped
    Given the May-July Google Meet transcripts are not available as parseable text
    When the registry is built
    Then the build report lists those meetings under "not_yet_parsed"
    And the report states the count of sources actually parsed
