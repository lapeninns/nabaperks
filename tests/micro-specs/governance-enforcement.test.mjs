import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { validateGovernance } from "../../scripts/governance-rules.mjs"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

test("Given the current governance files When validation runs Then the metadata and CI contract pass", () => {
  const result = validateGovernance(projectRoot, { changedFiles: [] })

  assert.deepEqual(result.failures, [])
})

test("Given an active ui-only spec When Playwright gates are omitted Then validation fails", () => {
  const root = fixtureRepo({
    spec: specFile({
      riskClass: "ui-only",
      gates: ["pnpm lint", "pnpm typecheck", "pnpm build", "pnpm test"],
      tests: ["tests/micro-specs/example.test.mjs"],
      playwrightProjects: [],
      evidence: ["Playwright report for changed UI"],
    }),
  })

  const result = validateGovernance(root, { changedFiles: [] })

  assert.match(result.failures.join("\n"), /requires "pnpm test:e2e"/)
})

test("Given an active billing spec When DB gates are omitted Then validation fails", () => {
  const root = fixtureRepo({
    spec: specFile({
      riskClass: "billing",
      gates: [
        "pnpm lint",
        "pnpm typecheck",
        "pnpm build",
        "pnpm test",
        "pnpm test:e2e",
      ],
      tests: ["tests/e2e/billing.spec.ts"],
      playwrightProjects: ["chromium"],
      evidence: ["Stripe checkout UX and DB readback"],
    }),
  })

  const result = validateGovernance(root, { changedFiles: [] })

  assert.match(result.failures.join("\n"), /requires "pnpm test:db"/)
})

test("Given an active spec When a changed file is outside the blast radius Then validation fails", () => {
  const root = fixtureRepo({
    spec: specFile({
      riskClass: "docs-tooling",
      blastRadius: ["micro-specs/**"],
      gates: ["pnpm lint", "pnpm typecheck", "pnpm governance:check", "pnpm test"],
    }),
  })

  const result = validateGovernance(root, { changedFiles: ["app/page.tsx"] })

  assert.match(result.failures.join("\n"), /app\/page\.tsx is outside/)
})

test("Given a verification gate with shell metacharacters When validation runs Then the gate is rejected", () => {
  const root = fixtureRepo({
    spec: specFile({
      riskClass: "docs-tooling",
      gates: [
        "pnpm lint && echo unsafe",
        "pnpm typecheck",
        "pnpm governance:check",
        "pnpm test",
      ],
    }),
  })

  const result = validateGovernance(root, { changedFiles: [] })

  assert.match(result.failures.join("\n"), /declares unknown gate/)
})

function fixtureRepo({ spec }) {
  const root = mkdtempSync(path.join(tmpdir(), "nabaperks-governance-"))
  mkdirSync(path.join(root, ".github/workflows"), { recursive: true })
  mkdirSync(path.join(root, "micro-specs/governance"), { recursive: true })

  writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify(
      {
        scripts: {
          build: "next build",
          "claims:check": "node scripts/check-banned-claims.mjs",
          "governance:check": "node scripts/check-governance.mjs",
          "governance:run-gates": "node scripts/run-governance-gates.mjs",
          "jsonld:check": "node scripts/check-jsonld.mjs",
          lint: "eslint",
          test: "node --test tests/micro-specs/*.test.mjs",
          "test:a11y": "playwright test --grep @a11y",
          "test:db": "node --test tests/db/*.test.mjs",
          "test:e2e": "playwright test",
          "test:visual": "playwright test --grep @visual",
          "tokens:check": "node scripts/check-design-tokens.mjs",
          typecheck: "tsc --noEmit",
        },
      },
      null,
      2
    )
  )
  writeFileSync(
    path.join(root, ".github/workflows/ci.yml"),
    [
      "name: CI",
      "jobs:",
      "  build:",
      "    steps:",
      "      - run: pnpm lint",
      "      - run: pnpm typecheck",
      "      - run: pnpm governance:check",
      "      - run: pnpm test",
      "      - run: pnpm build",
      "",
    ].join("\n")
  )
  writeFileSync(
    path.join(root, "micro-specs/README.md"),
    [
      "# AI Governance Index",
      "",
      "## Current Verification Gates",
      "",
      "- `pnpm lint`",
      "- `pnpm typecheck`",
      "- `pnpm governance:check`",
      "- `pnpm test`",
      "- `pnpm build`",
      "",
    ].join("\n")
  )
  writeFileSync(path.join(root, "micro-specs/governance/example.md"), spec)

  return root
}

function specFile({
  riskClass,
  blastRadius = ["micro-specs/**", "scripts/**", "tests/**", "package.json"],
  gates,
  tests = ["tests/micro-specs/governance-enforcement.test.mjs"],
  playwrightProjects = [],
  evidence = ["CI output"],
}) {
  return `---
spec_id: MS-test-governance
status: active
risk_class: ${riskClass}
owner: codex
last_reviewed: 2026-06-30
allowed_blast_radius:
${list(blastRadius)}
implementation_surfaces:
${list(blastRadius)}
related_tests:
${list(tests)}
verification_gates:
${list(gates)}
required_playwright_projects:
${list(playwrightProjects)}
evidence_required:
${list(evidence)}
approved_exceptions: []
---

# Test spec
`
}

function list(values) {
  if (values.length === 0) return "[]"
  return values.map((value) => `  - ${value}`).join("\n")
}
