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
// the gate runner. Any `manual:<kebab>` token is treated as manual.
export const KNOWN_MANUAL_INSPECTION_GATES = Object.freeze([
  "manual:review",
  "manual:security-review",
])

export const MANUAL_INSPECTION_GATE_PATTERN = /^manual:[a-z][a-z0-9-]*$/
