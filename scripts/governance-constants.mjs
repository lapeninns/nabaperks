// Repo-specific governance tuning for Nabaperks. This is the ONLY governance
// engine file allowed to differ from the canonical kit at
// ai-governance-starter-kit/templates/scripts/ — every other engine module is
// byte-identical and synced by scripts/sync-skill-bundles.mjs. Keep the export
// surface (names and shapes) equal to the kit's constants file; only VALUES
// may differ (tests/micro-specs/skill-bundle-sync.test.mjs enforces this).

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
  "closed",
  "superseded",
])

// Nabaperks domain risk vocabulary (kept from the original governance spine;
// richer than the kit's generic classes on purpose).
export const RISK_CLASSES = Object.freeze([
  "docs-tooling",
  "ui-only",
  "product-analytics",
  "customer-pii",
  "auth-session",
  "billing",
  "webhooks",
  "rls-rpc-ledger",
  "migrations",
])

// Gate floors migrated from the original exact-command lists: every script the
// old RISK_REQUIRED_GATES demanded unconditionally now sits in `always`, so
// the floor is exactly as strict as before the engine convergence.
export const RISK_REQUIRED_SCRIPTS = Object.freeze({
  "docs-tooling": {
    always: ["lint", "typecheck", "governance:check", "test", "test:coverage"],
  },
  "ui-only": {
    always: [
      "lint",
      "typecheck",
      "build",
      "test",
      "test:coverage",
      "bundle:check",
      "test:e2e",
      "test:a11y",
      "test:visual",
    ],
  },
  "product-analytics": {
    always: ["lint", "typecheck", "build", "test", "test:coverage"],
  },
  "customer-pii": {
    always: ["lint", "typecheck", "build", "test", "test:coverage", "test:e2e"],
  },
  "auth-session": {
    always: ["lint", "typecheck", "build", "test", "test:coverage", "test:e2e"],
  },
  billing: {
    always: ["lint", "typecheck", "build", "test", "test:coverage", "test:db", "test:e2e"],
    durableProof: true,
  },
  webhooks: {
    always: ["lint", "typecheck", "build", "test", "test:coverage", "test:db"],
    durableProof: true,
  },
  "rls-rpc-ledger": {
    always: ["lint", "typecheck", "build", "test", "test:coverage", "test:db", "test:e2e"],
    durableProof: true,
  },
  migrations: {
    always: ["lint", "typecheck", "build", "test", "test:coverage", "test:db"],
    durableProof: true,
  },
})

// Nabaperks doctrine: only real-Postgres proof counts as durable. DB-free
// browser harnesses and mocked flows never satisfy RLS/billing/webhook/ledger
// requirements (see micro-specs/README.md Evidence Model).
export const DURABLE_PROOF_SCRIPTS = Object.freeze(["test:db"])

// Evidence keywords that force a matching gate to be declared when the repo
// exposes the corresponding script.
export const EVIDENCE_GATE_INFERENCE = Object.freeze([
  { keyword: "a11y", script: "test:a11y" },
  { keyword: "accessibility", script: "test:a11y" },
  { keyword: "visual", script: "test:visual" },
  { keyword: "coverage", script: "test:coverage" },
])

export const SCRIPT_ALIASES = Object.freeze({
  test: ["test", "test:micro-specs"],
})

// Manual inspection gates are recorded for auditability but never executed by
// the gate runner.
export const KNOWN_MANUAL_INSPECTION_GATES = Object.freeze([
  "pnpm exec playwright show-report",
])

export const KNOWN_MANUAL_INSPECTION_GATE_PATTERNS = Object.freeze([
  /^manual:[a-z][a-z0-9-]*$/,
  /^pnpm exec playwright show-trace [A-Za-z0-9_./:@-]+\.zip$/,
])

// --- Enforcement tuning -----------------------------------------------------

// ACTIVE specs older than this many days (by last_reviewed) fail the checker;
// reviewing a spec is what earns the date bump. null disables the check.
export const STALE_REVIEW_DAYS = 30

// Every approved_exceptions entry must carry an inline expiry in the
// engine-fixed format "<reason> (expires: YYYY-MM-DD)"; expired entries fail.
export const REQUIRE_EXCEPTION_EXPIRY = true

// Docs-drift compares against ci.yml only: nightly.yml runs the extended
// (non-blocking-baseline) tier and is documented separately in the README.
export const CI_WORKFLOW_FILES = Object.freeze(["ci.yml"])

// No extra filter needed: the engine's built-in candidate filter (parseable
// package-script command, not a NON_GATE script) already reduces ci.yml to
// exactly the README's fenced gate list.
export const CI_COMMAND_INCLUDE_PATTERN = null

// Script names that never count as verification gates even though they parse
// as package-script commands (setup/lifecycle scripts, e.g. the ZAP job's
// `pnpm start > /tmp/... &` background server).
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

// The rollout switch for ledger enforcement: implemented/verified specs must
// carry valid evidence ledgers from this date. Pre-existing implemented specs
// were grandfathered via backfill stubs on the same day (MS-governance-factory-v2);
// a stub stays valid only until its spec's first machine transition.
export const EVIDENCE_ADOPTION_DATE = "2026-07-05"
