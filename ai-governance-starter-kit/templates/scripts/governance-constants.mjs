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
  "data-model",
  "auth-session",
  "billing",
  "webhooks",
  "migrations",
  "infra",
  "security",
  "ai-agent",
])

export const RISK_REQUIRED_SCRIPTS = Object.freeze({
  "docs-tooling": ["governance:check", "test"],
  "ui-only": ["governance:check", "test", "build"],
  "data-model": ["governance:check", "test", "build"],
  "auth-session": ["governance:check", "test", "build"],
  billing: ["governance:check", "test", "build"],
  webhooks: ["governance:check", "test"],
  migrations: ["governance:check", "test"],
  infra: ["governance:check", "test"],
  security: ["governance:check", "test"],
  "ai-agent": ["governance:check", "test"],
})

export const KNOWN_MANUAL_INSPECTION_GATES = Object.freeze([
  "manual:review",
  "manual:security-review",
])
