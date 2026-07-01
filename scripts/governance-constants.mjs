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

export const RISK_REQUIRED_GATES = Object.freeze({
  "docs-tooling": [
    "pnpm lint",
    "pnpm typecheck",
    "pnpm governance:check",
    "pnpm test",
    "pnpm test:coverage",
  ],
  "ui-only": [
    "pnpm lint",
    "pnpm typecheck",
    "pnpm build",
    "pnpm test",
    "pnpm test:coverage",
    "pnpm bundle:check",
    "pnpm test:e2e",
    "pnpm test:a11y",
    "pnpm test:visual",
  ],
  "product-analytics": [
    "pnpm lint",
    "pnpm typecheck",
    "pnpm build",
    "pnpm test",
    "pnpm test:coverage",
  ],
  "customer-pii": [
    "pnpm lint",
    "pnpm typecheck",
    "pnpm build",
    "pnpm test",
    "pnpm test:coverage",
    "pnpm test:e2e",
  ],
  "auth-session": [
    "pnpm lint",
    "pnpm typecheck",
    "pnpm build",
    "pnpm test",
    "pnpm test:coverage",
    "pnpm test:e2e",
  ],
  billing: [
    "pnpm lint",
    "pnpm typecheck",
    "pnpm build",
    "pnpm test",
    "pnpm test:coverage",
    "pnpm test:db",
    "pnpm test:e2e",
  ],
  webhooks: [
    "pnpm lint",
    "pnpm typecheck",
    "pnpm build",
    "pnpm test",
    "pnpm test:coverage",
    "pnpm test:db",
  ],
  "rls-rpc-ledger": [
    "pnpm lint",
    "pnpm typecheck",
    "pnpm build",
    "pnpm test",
    "pnpm test:coverage",
    "pnpm test:db",
    "pnpm test:e2e",
  ],
  migrations: [
    "pnpm lint",
    "pnpm typecheck",
    "pnpm build",
    "pnpm test",
    "pnpm test:coverage",
    "pnpm test:db",
  ],
})

export const KNOWN_MANUAL_INSPECTION_GATES = Object.freeze([
  "pnpm exec playwright show-report",
])

export const KNOWN_MANUAL_INSPECTION_GATE_PATTERNS = Object.freeze([
  /^pnpm exec playwright show-trace [A-Za-z0-9_./:@-]+\.zip$/,
])
