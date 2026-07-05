---
spec_id: MS-governance-skills-suite
status: active
risk_class: docs-tooling
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-07-05
allowed_blast_radius:
  - ai-governance-starter-kit/**
  - .factory/skills/**
  - scripts/advance-spec.mjs
  - scripts/governance-rules.mjs
  - scripts/governance-evidence.mjs
  - scripts/governance-constants.mjs
  - scripts/governance-version.mjs
  - scripts/sync-skill-bundles.mjs
  - tests/micro-specs/**
  - micro-specs/**
  - SKILL.md
  - Instructions_MircroSpecsCreation.md
  - Instructions_tdd.md
  - AGENTS.md
  - package.json
implementation_surfaces:
  - ai-governance-starter-kit/**
  - .factory/skills/**
  - scripts/sync-skill-bundles.mjs
  - scripts/governance-constants.mjs
  - tests/micro-specs/governance-enforcement.test.mjs
  - tests/micro-specs/skill-bundle-sync.test.mjs
  - micro-specs/README.md
related_docs:
  - micro-specs/README.md
  - Instructions_MircroSpecsCreation.md
  - Instructions_tdd.md
  - AGENTS.md
related_tests:
  - tests/micro-specs/advance-spec.test.mjs
  - tests/micro-specs/governance-evidence.test.mjs
  - tests/micro-specs/governance-enforcement.test.mjs
  - tests/micro-specs/skill-bundle-sync.test.mjs
  - tests/micro-specs/ai-governance-starter-kit.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm governance:check
  - pnpm test
  - pnpm test:coverage
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
  - Scratch-repo installer smoke covering the suite skills (install, --no-skills, --upgrade refresh, marker-guard collision refusal).
approved_exceptions: []
---

# MS-governance-skills-suite — Governance Skills Suite + engine closed station

## 1. Exact Goal and User-Visible Outcomes

The governance factory gains its missing final station and a composable skill
layer (design grounding: dzhng/skills, "AI skills for building software
factories"). An operator can take a `verified` Micro-Spec to `closed` with
`pnpm governance:advance <id> --to closed` — but only after rewriting the spec
body from a build plan into a durable rationale record (why it exists,
invariants, code pointers, dead ends); the engine machine-validates that
rewrite. Agents land on a suite of four small skills wired to the engine's
own commands — `write-micro-spec`, `implement-micro-spec`, `close-micro-spec`,
`install-governance` — routed by a thin kit-root SKILL.md, mirrored into
`.factory/skills/` and `~/.claude/skills/`, installable into consumer repos,
and declared by a `.claude-plugin/plugin.json` manifest. The first spec ever
closed is MS-governance-factory-v2 — the spec that built the factory.

## 2. Blast Radius

In scope: the canonical kit under `ai-governance-starter-kit/` (installer,
templates, the new kit-root SKILL.md, `skills/` suite, plugin manifest), its
synced bundles and suite mirrors under `.factory/skills/`, the engine files
named in the metadata (closed-station changes flow kit -> repo via lockstep
sync), governance tests under `tests/micro-specs/`, the `micro-specs/` tree
(this spec, factory-v2's verified/closed ladder, evidence ledgers, README),
the root `SKILL.md`, both instruction guides, `AGENTS.md`, and `package.json`
(script merges only, none expected).

Out of scope: product code (`app/`, `components/`, `lib/`), CI workflow files
(the gate set does not change), other specs' obligations, and the deferred
items decided at intake: no eval-skills golden-case harness, no mass-closing
of the pre-existing implemented-spec backlog, no publishing the kit as its
own repository (a manifest note documents the export requirement instead).

## 3. Strict Constraints and Assumptions

- Zero-dependency engine: closed-station code imports only `node:*` modules.
- `CLOSED_RECORD_HEADINGS` and `validateClosedRecord` live in
  governance-rules.mjs (engine-fixed); constants gain only the `"closed"`
  value inside the existing `STATUS_VALUES` key. A brand-new constants export
  would crash every kit consumer's engine on `--upgrade`, because constants
  files are never overwritten; missing named export = import error.
- Closed-record evidence stays JSON-only (factory-v2 constraint): no visual
  provenance section, deliberately diverging from dzhng's close-spec.
- No `specs/done/` file move on close, deliberately diverging from dzhng:
  Micro-Spec paths are load-bearing (blast-radius globs, related_tests,
  ledger spec_id mapping); `closed` is a status, not a location.
- Stale code pointers in a closed record are failures, not warnings (house
  strictness; precedent: related_tests existence). Directory pointers are the
  sanctioned valve for volatile file names.
- Suite mirrors under `~/.claude/skills/` and `.factory/skills/` are guarded:
  the sync never deletes a target directory whose SKILL.md lacks the
  `managed-by: ai-governance-starter-kit` frontmatter marker.
- Engine files stay byte-identical kit <-> repo <-> bundles; shared test files
  (advance-spec, governance-evidence, new-spec) join that lockstep contract.
- Assumption: gate runs for docs-tooling specs cost ~15s (measured from the
  factory-v2 ledger), so fresh-gates-per-advance stays cheap.

## 4. Decisions Already Made

- `closed` is the terminal happy status: `verified -> closed` and
  `closed -> superseded` are the only new transitions; `closed` runs gates
  fresh like implemented/verified and is enforced by the evidence ledger
  (provenance, covering run, attestations, acks).
- The rewrite itself is agent work guided by the close-micro-spec skill; the
  engine validates the RESULT: required headings (`## Why It Exists`,
  `## Invariants`, `## Code Pointers`, `## Dead Ends` — required even as
  "None."), a negative rule (none of the six activation headings may remain),
  a pointer grammar (dash lines under `## Code Pointers` carrying
  backtick-wrapped repo paths that must exist as files or directories), and a
  ban on the `not-yet-created` related_tests sentinel.
- evaluateLedger additionally enforces, for verified and closed specs, an
  attestation per declared manual-inspection gate and a `gate:"evidence"`
  attestation note per current `evidence_required` item — making the README's
  existing claim true (previously only `governance:advance` enforced this).
- The kit is canonical for ALL skill content: the router SKILL.md moves into
  `ai-governance-starter-kit/SKILL.md`; the `.factory` `syncSkillMd: false`
  special case dies; sync is uniformly kit -> everywhere. Nested vendored
  copies inside whole-kit bundles are inert (skill discovery is one-level).
- The installer copies only the four suite skills into consumer repos' own
  `.claude/skills/` (never the router — targets already hold the kit skill),
  default-on with `--no-skills` opt-out, refreshed on `--upgrade` with `.bak`
  backups via an `owned` flag on the planned actions (not ENGINE_OWNED_PATHS,
  which is the scripts-engine manifest).
- Suite skills follow dzhng's write-skills doctrine: trigger-rich
  descriptions, leading words, procedures not essays, no war stories, no
  implementation index. Design sources read in full: dzhng write-spec,
  implement-spec, close-spec, write-skills.
- KIT_VERSION becomes 0.3.0. The dogfood ladder closes
  MS-governance-factory-v2 (verified with its two exact evidence acks, then
  rewritten to a closed record that drops the sentinel and the spent
  evidence-waiver, then closed).

## 5. Behavioral Requirements (EARS)

- WHEN `governance:advance <id> --to closed` is invoked for a verified spec
  whose body satisfies the closed-record contract on a clean tree, THE system
  SHALL run the spec's gates fresh, record the run and transition in its
  ledger, and rewrite the status line to `closed`.
- IF the spec body lacks a required closed-record heading, still contains an
  activation heading, carries a code pointer that does not resolve to an
  existing file or directory, or lists the `not-yet-created` sentinel, THEN
  `governance:advance --to closed` SHALL refuse before running gates, naming
  the defect.
- THE governance checker SHALL apply the same closed-record validation to
  every spec whose status is `closed`, so a record that rots (renamed pointer
  target, reintroduced plan heading) becomes a named failure.
- THE governance checker SHALL fail a verified or closed spec whose ledger
  lacks an attestation for a declared manual-inspection gate or a
  `gate:"evidence"` note matching each current `evidence_required` item.
- WHEN the skill bundles are synced, THE system SHALL mirror each kit suite
  skill to `.factory/skills/<name>/` (and `~/.claude/skills/<name>/` under
  `--claude-home`) and SHALL refuse to delete any existing target whose
  SKILL.md lacks the managed-by marker.
- THE sync check SHALL fail when a shared test file differs between
  `tests/micro-specs/` and the kit templates, when a suite mirror differs
  from its kit source, or when the plugin manifest's skill list differs from
  the `skills/` directory listing.
- WHEN the installer runs without flags against a target repo, THE system
  SHALL plan the four suite skills into `<target>/.claude/skills/`,
  skip-if-exists on fresh installs, refresh them with backups under
  `--upgrade`, and skip them entirely under `--no-skills`.

## 6. Verification Criteria and Task Breakdown

Acceptance criteria — observable behaviors to verify:

- A verified fixture spec with a conforming closed record advances to closed;
  fixtures missing a heading, retaining a plan heading, pointing at a dead
  path, or carrying the sentinel are each refused by name; closed advances to
  superseded; the usage strings list `closed`.
- A hand-flipped `closed` status without a ledger transition fails the
  checker; a covering run recorded at the closed advance passes; a verified
  spec missing an ack or manual-gate attestation fails.
- The repo self-validation test stays green over the whole corpus after
  MS-governance-factory-v2 is closed — its record's pointers are re-checked
  on every future checker run.
- A scratch-repo install lands the suite under `.claude/skills/`; a doctored
  suite file is refreshed with a `.bak` backup on `--upgrade`; `--no-skills`
  plans no suite actions; an unmarked decoy directory at a mirror target is
  refused, not clobbered.
- `sync-skill-bundles --check` goes red on any drift in bundles, suite
  mirrors, shared tests, or manifest <-> directory listing, and green after a
  sync.

Tasks (implement and verify one at a time): engine closed station
(kit-side + lockstep sync + shared tests); suite authoring + kit-canonical
SKILL.md layout + plugin manifest; distribution wiring (sync mirrors,
marker guard, shared-test lockstep, installer suite actions) + scratch-repo
smoke; docs pass (README lifecycle/evidence sections, instruction guides,
AGENTS.md, root SKILL.md gate-claim fix); dogfood ladder (factory-v2
verified -> closed record -> closed; this spec -> implemented). Prove the
work with `governance:run-gates --spec MS-governance-skills-suite --record`
and advance the lifecycle with `governance:advance`.
