export const REQUIRED_METADATA_FIELDS = Object.freeze([
  "spec_id",
  "status",
  "risk_class",
  "owner",
  "last_reviewed",
  "allowed_blast_radius",
  "implementation_surfaces",
  "related_tests",
  "verification_gates",
  "required_playwright_projects",
  "evidence_required",
  "approved_exceptions",
])

export const STATUS_VALUES = Object.freeze([
  "draft",
  "active",
  "implemented",
  "verified",
  "superseded",
])

// Portable, repo-agnostic risk vocabulary. Keep these generic so the same
// spine drops into any repository. Add domain-specific classes in a fork only
// when a repo genuinely needs them.
export const RISK_CLASSES = Object.freeze([
  "docs-tooling",
  "ui-only",
  "data-model",
  "auth-session",
  "billing",
  "webhooks",
  "migrations",
  "infra",
  "security",
  "ai-agent",
])

// Required gate floor per risk class, expressed as script *names* so it stays
// package-manager and stack agnostic.
//   always      - the spec must declare a gate for each of these scripts.
//   whenPresent - required only if the target repo actually defines that
//                 script (portable repos without e.g. `build` are not forced
//                 to invent one).
//   durableProof - high-risk classes must declare at least one durable-proof
//                 gate (see DURABLE_PROOF_SCRIPTS) when the repo has one, or
//                 carry a non-empty approved_exceptions explaining the gap.
//   manualReview - a manual inspection gate that must be declared.
export const RISK_REQUIRED_SCRIPTS = Object.freeze({
  "docs-tooling": {
    always: ["governance:check", "test"],
    whenPresent: ["lint", "typecheck"],
  },
  "ui-only": {
    always: ["governance:check", "test"],
    whenPresent: ["lint", "typecheck", "build", "test:e2e", "test:a11y", "test:visual", "bundle:check"],
  },
  "data-model": {
    always: ["governance:check", "test"],
    whenPresent: ["lint", "typecheck", "build"],
    durableProof: true,
  },
  "auth-session": {
    always: ["governance:check", "test"],
    whenPresent: ["lint", "typecheck", "build", "test:e2e"],
    durableProof: true,
  },
  billing: {
    always: ["governance:check", "test"],
    whenPresent: ["lint", "typecheck", "build", "test:e2e"],
    durableProof: true,
  },
  webhooks: {
    always: ["governance:check", "test"],
    whenPresent: ["lint", "typecheck", "build"],
    durableProof: true,
  },
  migrations: {
    always: ["governance:check", "test"],
    whenPresent: ["lint", "typecheck", "build"],
    durableProof: true,
  },
  infra: {
    always: ["governance:check", "test"],
    whenPresent: ["lint", "typecheck", "build"],
  },
  security: {
    always: ["governance:check", "test"],
    whenPresent: ["lint", "typecheck", "build"],
    manualReview: "manual:security-review",
  },
  "ai-agent": {
    always: ["governance:check", "test"],
    whenPresent: ["lint", "typecheck", "build"],
  },
})

// Script names that count as durable, non-browser-only proof (DB/integration/
// contract/e2e). High-risk classes must declare one of these when the repo has
// it. Extend this list in a fork to match your repo's proof harness.
export const DURABLE_PROOF_SCRIPTS = Object.freeze([
  "test:db",
  "test:integration",
  "test:contract",
  "test:e2e",
  "db:test",
  "integration",
  "e2e",
])

// Evidence keywords that force a matching gate to be declared when the repo
// exposes the corresponding script.
export const EVIDENCE_GATE_INFERENCE = Object.freeze([
  { keyword: "a11y", script: "test:a11y" },
  { keyword: "accessibility", script: "test:a11y" },
  { keyword: "visual", script: "test:visual" },
  { keyword: "coverage", script: "test:coverage" },
])

// Some floors accept an equivalent alternative script (mirrors the installer's
// test -> test:micro-specs fallback) so repos without a plain `test` script
// still satisfy the floor.
export const SCRIPT_ALIASES = Object.freeze({
  test: ["test", "test:micro-specs"],
})

// Manual inspection gates are recorded for auditability but never executed by
// the gate runner. Any token matching one of these patterns (or the literal
// list) is treated as manual. Forks append repo-specific patterns here.
export const KNOWN_MANUAL_INSPECTION_GATES = Object.freeze([
  "manual:review",
  "manual:security-review",
])

export const KNOWN_MANUAL_INSPECTION_GATE_PATTERNS = Object.freeze([
  /^manual:[a-z][a-z0-9-]*$/,
])

// --- Enforcement tuning -----------------------------------------------------

// ACTIVE specs older than this many days (by last_reviewed) fail the checker;
// reviewing a spec is what earns the date bump. null disables the check.
export const STALE_REVIEW_DAYS = 90

// When true, every approved_exceptions entry must carry an inline expiry in
// the engine-fixed format "<reason> (expires: YYYY-MM-DD)" and expired
// entries fail the checker. The format is single-line on purpose so it stays
// inside the strict frontmatter subset.
export const REQUIRE_EXCEPTION_EXPIRY = true

// Which workflow files feed the docs-drift comparison. null scans every
// *.yml/*.yaml under .github/workflows; a list pins specific file names.
export const CI_WORKFLOW_FILES = null

// Optional extra filter applied (symmetrically) to CI and README gate lines
// during docs-drift comparison. null means only the engine's built-in filter
// (parseable package-script command, not a NON_GATE script) applies.
export const CI_COMMAND_INCLUDE_PATTERN = null

// Script names that never count as verification gates even though they parse
// as package-script commands (setup/lifecycle scripts).
export const NON_GATE_SCRIPT_NAMES = Object.freeze(["install", "start", "dev"])

// The README section (## heading) that must stay in sync with CI.
export const README_GATES_SECTION_TITLE = "Current Verification Gates"

// related_tests entries must be literal, existing paths — except this
// sentinel, and except specs whose status is listed as exempt.
export const RELATED_TESTS_SENTINEL = "not-yet-created"
export const RELATED_TESTS_EXEMPT_STATUSES = Object.freeze(["draft"])

// --- Evidence ledger (factory stations) -------------------------------------

// Tracked, machine-readable gate-run ledgers live here (one JSON per spec).
export const EVIDENCE_DIR = "micro-specs/evidence"

// The rollout switch for ledger enforcement: implemented/verified specs are
// required to carry valid evidence only when this is a YYYY-MM-DD date.
// null disables all ledger validation (pre-adoption).
export const EVIDENCE_ADOPTION_DATE = null
