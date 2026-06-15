import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

describe("AI governance foundation", () => {
  it("exposes a strict pnpm governance script and wires it into quality", async () => {
    const { default: pkg } = await import("../../package.json")

    expect(pkg.packageManager).toBe("pnpm@10.28.0")
    expect(pkg.scripts.governance).toBe("node scripts/check-governance.mjs")
    expect(pkg.scripts.quality).toContain("pnpm governance")
    expect(pkg.scripts.quality).not.toContain("|| true")
  })

  it("validates lifecycle, risk, gate, and traceability policy from committed artifacts", async () => {
    const { validateGovernance } =
      await import("../../scripts/check-governance.mjs")

    const result = validateGovernance({ rootDir: process.cwd() })

    expect(result.diagnostics).toEqual([])
    expect(result.checks).toEqual(
      expect.arrayContaining([
        "source hierarchy",
        "lifecycle vocabulary",
        "risk-to-gate matrix",
        "traceability JSON",
        "traceability Markdown",
        "package and CI wiring",
      ])
    )
  })

  it("emits deterministic diagnostics ordered by stable path and ID", async () => {
    const { formatDiagnostics, validateGovernance } =
      await import("../../scripts/check-governance.mjs")
    const fixture = makeGovernanceFixture({
      traceabilityJson: JSON.stringify({
        version: 1,
        scope: "foundation",
        specs: [
          {
            spec_id: "GOV-002",
            status: "parked",
            risk_class: "unknown-risk",
            requirements: [],
          },
          {
            spec_id: "GOV-001",
            status: "draft",
            risk_class: "docs-tooling",
            verification_gates: [
              "pnpm governance",
              "pnpm lint",
              "pnpm typecheck",
              "pnpm test",
            ],
            requirements: [
              {
                requirement_id: "REQ-002",
                gates: ["pnpm lint"],
                evidence: ["tests/micro-specs/ai-governance.test.ts"],
              },
              {
                requirement_id: "REQ-001",
                gates: ["pnpm test"],
                evidence: ["missing.test.ts"],
              },
            ],
          },
        ],
      }),
      traceabilityMarkdown:
        "# Traceability\n\n- `GOV-001`\n- `GOV-002`\n- `REQ-002`\n",
    })

    const first = formatDiagnostics(validateGovernance({ rootDir: fixture }))
    const second = formatDiagnostics(validateGovernance({ rootDir: fixture }))

    expect(first).toEqual(second)
    expect(first).toEqual([
      "micro-specs/traceability.json [GOV-002] invalid risk_class unknown-risk.",
      "micro-specs/traceability.json [GOV-002] invalid status parked.",
      "micro-specs/traceability.json [REQ-001] references missing evidence path missing.test.ts.",
      "micro-specs/TRACEABILITY.md [REQ-001] missing Markdown traceability entry.",
    ])
  })

  it("rejects soft-failed governance wiring and non-pnpm install paths", async () => {
    const { validateGovernance } =
      await import("../../scripts/check-governance.mjs")
    const fixture = makeGovernanceFixture({
      packageJson: JSON.stringify({
        packageManager: "pnpm@10.28.0",
        scripts: {
          governance: "node scripts/check-governance.mjs || true",
          quality: "pnpm governance || true",
        },
      }),
      ciWorkflow:
        "steps:\n  - run: npm install\n  - run: pnpm governance || true\n",
    })

    expect(validateGovernance({ rootDir: fixture }).diagnostics).toEqual(
      expect.arrayContaining([
        {
          path: "package.json",
          id: "governance",
          message: "governance script must not use soft-fail wrappers.",
        },
        {
          path: "package.json",
          id: "quality",
          message:
            "quality script must run pnpm governance without soft-fail wrappers.",
        },
        {
          path: ".github/workflows/ci.yml",
          id: "package-manager",
          message: "CI must not use npm, yarn, or bun install paths.",
        },
        {
          path: ".github/workflows/ci.yml",
          id: "governance",
          message: "CI governance wiring must not be soft-failed.",
        },
      ])
    )
  })
})

function makeGovernanceFixture(
  overrides: {
    packageJson?: string
    ciWorkflow?: string
    traceabilityJson?: string
    traceabilityMarkdown?: string
  } = {}
) {
  const root = mkdtempSync(join(tmpdir(), "nabaperks-governance-"))
  const requiredDirs = [
    ".github/actions/setup",
    ".github/ISSUE_TEMPLATE",
    ".github/workflows",
    "docs",
    "micro-specs",
    "scripts",
    "tests/micro-specs",
  ]

  for (const dir of requiredDirs)
    mkdirSync(join(root, dir), { recursive: true })

  writeFileSync(
    join(root, "package.json"),
    overrides.packageJson ??
      JSON.stringify({
        packageManager: "pnpm@10.28.0",
        scripts: {
          governance: "node scripts/check-governance.mjs",
          quality: "pnpm governance && pnpm lint",
        },
      })
  )
  writeFileSync(
    join(root, ".github/workflows/ci.yml"),
    overrides.ciWorkflow ??
      "steps:\n  - run: pnpm install --frozen-lockfile\n  - run: pnpm governance\n"
  )
  writeFileSync(
    join(root, ".github/actions/setup/action.yml"),
    "steps:\n  - run: pnpm install --frozen-lockfile\n"
  )
  writeFileSync(
    join(root, ".github/pull_request_template.md"),
    "Micro-Spec outcome and scope\nSpec ID\nRisk class\nRequirement IDs\nBlast radius\nRed → Green → Refactor\nBrowser evidence\nVerification\n"
  )
  writeFileSync(
    join(root, ".github/ISSUE_TEMPLATE/feature_request.yml"),
    "Micro-Spec\nrisk class\noutcome\nscope\nverification\n"
  )
  writeFileSync(
    join(root, ".github/ISSUE_TEMPLATE/bug_report.yml"),
    "Micro-Spec\nrisk class\noutcome\nscope\nverification\n"
  )
  writeGovernanceDocs(root)
  writeFileSync(
    join(root, "micro-specs/traceability.json"),
    overrides.traceabilityJson ??
      JSON.stringify({
        version: 1,
        scope: "foundation",
        specs: [
          {
            spec_id: "GOV-001",
            status: "draft",
            risk_class: "docs-tooling",
            requirements: [
              {
                requirement_id: "REQ-001",
                gates: ["pnpm lint"],
                evidence: ["tests/micro-specs/ai-governance.test.ts"],
              },
            ],
          },
        ],
      })
  )
  writeFileSync(
    join(root, "micro-specs/TRACEABILITY.md"),
    overrides.traceabilityMarkdown ??
      "# Traceability\n\n- `GOV-001`\n- `REQ-001`\n"
  )
  writeFileSync(join(root, "tests/micro-specs/ai-governance.test.ts"), "")

  return root
}

function writeGovernanceDocs(root: string) {
  const common = [
    "Governance Source-of-Truth Hierarchy",
    "micro-specs/README.md",
    "docs/PROJECT_SPEC.md",
    "docs/ARCHITECTURE.md",
    "micro-specs/GLOBAL_CONTEXT.md",
    "Instructions_MircroSpecsCreation.md",
    "Instructions_tdd.md",
    "AGENTS.md",
    "CLAUDE.md",
    "SKILL.md",
    "Lifecycle Status Vocabulary",
    "draft",
    "active",
    "implemented",
    "verified",
    "superseded",
    "Lifecycle Transition Policy",
    "approved_exceptions",
    "Risk Rubric",
    "docs-tooling",
    "ui-only",
    "product-analytics",
    "customer-pii",
    "auth-session",
    "billing",
    "webhooks",
    "rls-rpc-ledger",
    "migrations",
    "Risk-to-Gate Mapping",
    "pnpm lint",
    "pnpm typecheck",
    "pnpm test",
    "pnpm db:verify",
    "pnpm security:verify",
    "npx playwright test",
    "pnpm test:coverage",
    "pnpm build",
    "CLI-first Validation Policy",
    "browser evidence",
    "Micro-Spec Metadata Schema",
    "spec_id",
    "status",
    "risk_class",
    "owner",
    "last_reviewed",
    "verification_gates",
    "allowed_blast_radius",
    "related_docs",
    "related_tests",
    "Red → Green → Refactor",
  ].join("\n")

  for (const file of [
    "AGENTS.md",
    "CLAUDE.md",
    "SKILL.md",
    "Instructions_MircroSpecsCreation.md",
    "Instructions_tdd.md",
    "micro-specs/GLOBAL_CONTEXT.md",
    "micro-specs/README.md",
  ]) {
    writeFileSync(join(root, file), common)
  }
  writeFileSync(join(root, "docs/PROJECT_SPEC.md"), "Project spec")
  writeFileSync(join(root, "docs/ARCHITECTURE.md"), "Architecture")
}
