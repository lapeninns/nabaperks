import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
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
            spec_id: "GOV-001",
            title: "Deterministic governance fixture",
            status: "draft",
            risk_class: "docs-tooling",
            owner: "factory-droid",
            last_reviewed: "2026-06-15",
            allowed_blast_radius: ["tests/micro-specs/**"],
            implementation_surfaces: ["tests/micro-specs/**"],
            related_docs: ["micro-specs/README.md"],
            related_tests: ["tests/micro-specs/ai-governance.test.ts"],
            verification_gates: [
              "pnpm governance",
              "pnpm lint",
              "pnpm typecheck",
              "pnpm test",
            ],
            approved_exceptions: [],
            change_state: "current",
            requirements: [
              {
                requirement_id: "REQ-001",
                status: "draft",
                risk_class: "docs-tooling",
                required_test_tier: ["unit"],
                gates: ["pnpm test"],
                verification_commands: ["pnpm test"],
                evidence: ["missing.test.ts"],
                related_tests: ["tests/micro-specs/ai-governance.test.ts"],
                implementation_surfaces: ["tests/micro-specs/**"],
                manual_rationale: [],
                change_state: "current",
              },
              {
                requirement_id: "REQ-002",
                status: "draft",
                risk_class: "docs-tooling",
                required_test_tier: ["lint"],
                gates: ["pnpm lint"],
                verification_commands: ["pnpm lint"],
                evidence: ["tests/micro-specs/ai-governance.test.ts"],
                related_tests: ["tests/micro-specs/ai-governance.test.ts"],
                implementation_surfaces: ["tests/micro-specs/**"],
                manual_rationale: [],
                change_state: "current",
              },
            ],
          },
          {
            spec_id: "GOV-002",
            title: "Invalid governance fixture",
            status: "parked",
            risk_class: "unknown-risk",
            owner: "factory-droid",
            last_reviewed: "2026-06-15",
            allowed_blast_radius: ["tests/micro-specs/**"],
            implementation_surfaces: ["tests/micro-specs/**"],
            related_docs: ["micro-specs/README.md"],
            related_tests: ["tests/micro-specs/ai-governance.test.ts"],
            verification_gates: [
              "pnpm governance",
              "pnpm lint",
              "pnpm typecheck",
              "pnpm test",
            ],
            approved_exceptions: [],
            change_state: "current",
            requirements: [],
          },
        ],
      }),
      traceabilityMarkdown:
        "# Traceability\n\n## GOV-001\n\nStatus draft\nRisk docs-tooling\nChange current\ntests/micro-specs/ai-governance.test.ts\npnpm governance\npnpm lint\npnpm typecheck\npnpm test\ntests/micro-specs/**\nREQ-002\nlint\n\n## GOV-002\n\nStatus parked\nRisk unknown-risk\nChange current\ntests/micro-specs/ai-governance.test.ts\npnpm governance\npnpm lint\npnpm typecheck\npnpm test\ntests/micro-specs/**\n",
    })

    const first = formatDiagnostics(validateGovernance({ rootDir: fixture }))
    const second = formatDiagnostics(validateGovernance({ rootDir: fixture }))

    expect(first).toEqual(second)
    expect(first).toEqual([
      "micro-specs/traceability.json [GOV-002] invalid risk_class unknown-risk.",
      "micro-specs/traceability.json [GOV-002] invalid status parked.",
      "micro-specs/traceability.json [REQ-001] references missing evidence path missing.test.ts.",
      "micro-specs/TRACEABILITY.md [REQ-001] Markdown traceability is missing evidence missing.test.ts.",
      "micro-specs/TRACEABILITY.md [REQ-001] Markdown traceability is missing test tier unit.",
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

  it("rejects unnormalized Micro-Spec markdown metadata and EARS requirements", async () => {
    const { validateGovernance } =
      await import("../../scripts/check-governance.mjs")
    const fixture = makeGovernanceFixture()
    mkdirSync(join(fixture, "micro-specs/99-fixture"), { recursive: true })
    writeFileSync(
      join(fixture, "micro-specs/99-fixture/missing-metadata.md"),
      [
        "# Micro-Spec: Missing Metadata",
        "",
        "## Behavioral Requirements",
        "",
        "- WHEN governance reads this spec, THE validator SHALL reject it.",
        "",
      ].join("\n")
    )
    writeFileSync(
      join(fixture, "micro-specs/99-fixture/missing-requirement-id.md"),
      [
        "---",
        "spec_id: MS-FIXTURE-MISSING-REQ-ID",
        "status: active",
        "risk_class: docs-tooling",
        "owner: factory-droid",
        "last_reviewed: 2026-06-15",
        "allowed_blast_radius:",
        "  - tests/micro-specs/**",
        "implementation_surfaces:",
        "  - tests/micro-specs/**",
        "related_docs:",
        "  - micro-specs/README.md",
        "related_tests:",
        "  - tests/micro-specs/ai-governance.test.ts",
        "verification_gates:",
        "  - pnpm governance",
        "  - pnpm lint",
        "  - pnpm typecheck",
        "  - pnpm test",
        "approved_exceptions: []",
        "---",
        "",
        "# Micro-Spec: Missing Requirement ID",
        "",
        "## Behavioral Requirements",
        "",
        "- WHEN governance reads this requirement, THE validator SHALL reject it.",
        "",
      ].join("\n")
    )

    expect(validateGovernance({ rootDir: fixture }).diagnostics).toEqual(
      expect.arrayContaining([
        {
          path: "micro-specs/99-fixture/missing-metadata.md",
          id: "micro-specs/99-fixture/missing-metadata.md",
          message: "Micro-Spec metadata frontmatter is required.",
        },
        {
          path: "micro-specs/99-fixture/missing-requirement-id.md",
          id: "MS-FIXTURE-MISSING-REQ-ID",
          message: "every EARS requirement must start with a stable ID.",
        },
      ])
    )
  })

  it("accepts a compliant Product to Engineering to Reviewer release workflow fixture", async () => {
    const { validateGovernance } =
      await import("../../scripts/check-governance.mjs")
    const scenario = governanceFixtureScenario("compliantWorkflow")
    const fixture = makeGovernanceFixture({
      traceabilityJson: scenario.traceabilityJson,
      traceabilityMarkdown: scenario.traceabilityMarkdown,
    })

    expect(validateGovernance({ rootDir: fixture }).diagnostics).toEqual([])
  })

  it("rejects malformed lifecycle fixtures with clear diagnostics", async () => {
    const { validateGovernance } =
      await import("../../scripts/check-governance.mjs")
    const scenario = governanceFixtureScenario("malformedLifecycle")
    const fixture = makeGovernanceFixture({
      traceabilityJson: scenario.traceabilityJson,
      traceabilityMarkdown: scenario.traceabilityMarkdown,
    })

    expect(validateGovernance({ rootDir: fixture }).diagnostics).toEqual(
      expect.arrayContaining([
        {
          path: "micro-specs/traceability.json",
          id: "unknown-spec",
          message: "owner is required.",
        },
        {
          path: "micro-specs/traceability.json",
          id: "GOV-BAD-STATUS",
          message: "invalid status parked.",
        },
        {
          path: "micro-specs/traceability.json",
          id: "GOV-DUPLICATE",
          message: "duplicate spec_id.",
        },
        {
          path: "micro-specs/traceability.json",
          id: "GOV-DUPLICATE-001",
          message: "duplicate requirement_id.",
        },
        {
          path: "micro-specs/traceability.json",
          id: "GOV-BAD-RISK",
          message: "invalid risk_class unknown-risk.",
        },
        {
          path: "micro-specs/traceability.json",
          id: "GOV-MISSING-SUPERSESSION",
          message:
            "superseded specs require superseded_by or supersession_rationale.",
        },
        {
          path: "micro-specs/traceability.json",
          id: "GOV-STALE-REFERENCES",
          message:
            "last_reviewed is stale for active, implemented, or verified work.",
        },
      ])
    )
  })

  it("rejects malformed handoff fixtures and broken traceability links", async () => {
    const { validateGovernance } =
      await import("../../scripts/check-governance.mjs")
    const scenario = governanceFixtureScenario("malformedWorkflow")
    const fixture = makeGovernanceFixture({
      traceabilityJson: scenario.traceabilityJson,
      traceabilityMarkdown: scenario.traceabilityMarkdown,
    })

    expect(validateGovernance({ rootDir: fixture }).diagnostics).toEqual(
      expect.arrayContaining([
        {
          path: "micro-specs/traceability.json",
          id: "GOV-BROKEN-WORKFLOW:product",
          message: "handoff bounded_intent is required.",
        },
        {
          path: "micro-specs/traceability.json",
          id: "GOV-BROKEN-WORKFLOW:engineering",
          message:
            "engineering handoff requires Red, Green, and Refactor evidence for each in-scope requirement.",
        },
        {
          path: "micro-specs/traceability.json",
          id: "GOV-BROKEN-WORKFLOW:engineering",
          message: "as-built reconciliation must list requirement outcomes.",
        },
        {
          path: "micro-specs/traceability.json",
          id: "GOV-BROKEN-WORKFLOW:engineering",
          message:
            "actual files touched must remain inside the allowed blast radius.",
        },
        {
          path: "micro-specs/traceability.json",
          id: "GOV-BROKEN-WORKFLOW:reviewer",
          message:
            "reviewer decision must cite spec_id, requirement_ids, risk_class, and verification_output.",
        },
        {
          path: "micro-specs/traceability.json",
          id: "GOV-BROKEN-WORKFLOW:release",
          message:
            "release handoff must include release_reconciliation, risks, follow_ups, and verification_output.",
        },
        {
          path: "micro-specs/traceability.json",
          id: "GOV-BROKEN-WORKFLOW:handoff",
          message: "handoff references unknown requirement_id GOV-MISSING-999.",
        },
      ])
    )
  })

  it("rejects traceability drift, missing test tiers, and missing change state", async () => {
    const { validateGovernance } =
      await import("../../scripts/check-governance.mjs")
    const fixture = makeGovernanceFixture({
      traceabilityJson: {
        version: 1,
        scope: "full-micro-spec-corpus",
        specs: [
          {
            spec_id: "GOV-TRACEABILITY-DRIFT",
            title: "Traceability drift fixture",
            status: "implemented",
            risk_class: "docs-tooling",
            owner: "factory-droid",
            last_reviewed: "2026-06-15",
            allowed_blast_radius: ["tests/micro-specs/**"],
            implementation_surfaces: ["tests/micro-specs/**"],
            related_docs: ["micro-specs/README.md"],
            related_tests: ["tests/micro-specs/ai-governance.test.ts"],
            verification_gates: [
              "pnpm governance",
              "pnpm lint",
              "pnpm typecheck",
              "pnpm test",
            ],
            approved_exceptions: [],
            requirements: [
              {
                requirement_id: "GOV-TRACEABILITY-DRIFT-001",
                summary: "Traceability entry missing required tier fields.",
                gates: ["pnpm governance"],
                evidence: ["tests/micro-specs/ai-governance.test.ts"],
              },
            ],
            handoffs: {
              product: {
                spec_id: "GOV-TRACEABILITY-DRIFT",
                requirement_ids: ["GOV-TRACEABILITY-DRIFT-001"],
                status: "implemented",
                risk_class: "docs-tooling",
                owner: "factory-droid",
                date: "2026-06-15",
                bounded_intent: "Validate traceability schema strictness.",
                scope_confirmation:
                  "Fixture remains limited to governance tests.",
              },
              engineering: {
                spec_id: "GOV-TRACEABILITY-DRIFT",
                requirement_ids: ["GOV-TRACEABILITY-DRIFT-001"],
                risk_class: "docs-tooling",
                tdd_evidence: [
                  {
                    requirement_id: "GOV-TRACEABILITY-DRIFT-001",
                    red: "pnpm vitest run tests/micro-specs/ai-governance.test.ts",
                    green:
                      "pnpm vitest run tests/micro-specs/ai-governance.test.ts",
                    refactor: "No refactor needed.",
                  },
                ],
                as_built_reconciliation: {
                  already_satisfied: [],
                  implemented: ["GOV-TRACEABILITY-DRIFT-001"],
                  intentionally_untouched: [],
                },
                actual_files_touched: [
                  "tests/micro-specs/ai-governance.test.ts",
                ],
                blast_radius_confirmation:
                  "Actual files are inside allowed blast radius.",
              },
              reviewer: {
                decision: "approved",
                spec_id: "GOV-TRACEABILITY-DRIFT",
                requirement_ids: ["GOV-TRACEABILITY-DRIFT-001"],
                risk_class: "docs-tooling",
                verification_output: [
                  {
                    command:
                      "pnpm vitest run tests/micro-specs/ai-governance.test.ts",
                    outcome: "passed",
                  },
                ],
              },
              release: {
                spec_id: "GOV-TRACEABILITY-DRIFT",
                requirement_ids: ["GOV-TRACEABILITY-DRIFT-001"],
                risk_class: "docs-tooling",
                release_reconciliation: "Governance fixture is release-ready.",
                verification_output: [
                  {
                    command: "pnpm governance",
                    outcome: "passed",
                  },
                ],
                risks: [],
                follow_ups: [],
              },
            },
          },
        ],
      },
      traceabilityMarkdown:
        "# Traceability\n\n## GOV-TRACEABILITY-DRIFT\n\n- `GOV-TRACEABILITY-DRIFT-001`\n",
    })

    expect(validateGovernance({ rootDir: fixture }).diagnostics).toEqual(
      expect.arrayContaining([
        {
          path: "micro-specs/traceability.json",
          id: "GOV-TRACEABILITY-DRIFT",
          message: "change_state is required.",
        },
        {
          path: "micro-specs/traceability.json",
          id: "GOV-TRACEABILITY-DRIFT-001",
          message: "required_test_tier must be a non-empty array.",
        },
        {
          path: "micro-specs/traceability.json",
          id: "GOV-TRACEABILITY-DRIFT-001",
          message: "verification_commands must be a non-empty array.",
        },
        {
          path: "micro-specs/traceability.json",
          id: "GOV-TRACEABILITY-DRIFT-001",
          message: "change_state is required.",
        },
        {
          path: "micro-specs/TRACEABILITY.md",
          id: "GOV-TRACEABILITY-DRIFT",
          message: "Markdown traceability is missing status implemented.",
        },
        {
          path: "micro-specs/TRACEABILITY.md",
          id: "GOV-TRACEABILITY-DRIFT-001",
          message:
            "Markdown traceability is missing evidence tests/micro-specs/ai-governance.test.ts.",
        },
      ])
    )
  })
})

function makeGovernanceFixture(
  overrides: {
    packageJson?: string
    ciWorkflow?: string
    traceabilityJson?: string | object
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
    "tests/fixtures/governance",
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
    "Micro-Spec outcome and scope\nSpec ID\nRisk class\nRequirement IDs\nBlast radius\nRed → Green → Refactor\nAs-built reconciliation\nReviewer decision\nRelease reconciliation\nRisks\nFollow-ups\nBrowser evidence\nVerification\n"
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
    typeof overrides.traceabilityJson === "string"
      ? overrides.traceabilityJson
      : JSON.stringify(
          overrides.traceabilityJson ?? {
            version: 1,
            scope: "foundation",
            specs: [
              {
                spec_id: "GOV-001",
                title: "Governance fixture",
                status: "implemented",
                risk_class: "docs-tooling",
                owner: "factory-droid",
                last_reviewed: "2026-06-15",
                allowed_blast_radius: ["tests/micro-specs/**"],
                implementation_surfaces: ["tests/micro-specs/**"],
                related_docs: ["micro-specs/README.md"],
                related_tests: ["tests/micro-specs/ai-governance.test.ts"],
                verification_gates: [
                  "pnpm governance",
                  "pnpm lint",
                  "pnpm typecheck",
                  "pnpm test",
                ],
                approved_exceptions: [],
                change_state: "current",
                requirements: [
                  {
                    requirement_id: "REQ-001",
                    status: "implemented",
                    risk_class: "docs-tooling",
                    required_test_tier: ["unit"],
                    gates: ["pnpm test"],
                    verification_commands: ["pnpm test"],
                    evidence: ["tests/micro-specs/ai-governance.test.ts"],
                    related_tests: ["tests/micro-specs/ai-governance.test.ts"],
                    implementation_surfaces: ["tests/micro-specs/**"],
                    manual_rationale: [],
                    change_state: "current",
                  },
                ],
                handoffs: {
                  product: {
                    spec_id: "GOV-001",
                    requirement_ids: ["REQ-001"],
                    status: "implemented",
                    risk_class: "docs-tooling",
                    owner: "factory-droid",
                    date: "2026-06-15",
                    bounded_intent: "Validate fixture governance.",
                    scope_confirmation:
                      "Fixture remains limited to governance tests.",
                  },
                  engineering: {
                    spec_id: "GOV-001",
                    requirement_ids: ["REQ-001"],
                    risk_class: "docs-tooling",
                    tdd_evidence: [
                      {
                        requirement_id: "REQ-001",
                        red: "pnpm vitest run tests/micro-specs/ai-governance.test.ts",
                        green:
                          "pnpm vitest run tests/micro-specs/ai-governance.test.ts",
                        refactor: "No refactor needed.",
                      },
                    ],
                    as_built_reconciliation: {
                      already_satisfied: [],
                      implemented: ["REQ-001"],
                      intentionally_untouched: [],
                    },
                    actual_files_touched: [
                      "tests/micro-specs/ai-governance.test.ts",
                    ],
                    blast_radius_confirmation:
                      "Actual files are inside allowed blast radius.",
                  },
                  reviewer: {
                    decision: "approved",
                    spec_id: "GOV-001",
                    requirement_ids: ["REQ-001"],
                    risk_class: "docs-tooling",
                    verification_output: [
                      {
                        command:
                          "pnpm vitest run tests/micro-specs/ai-governance.test.ts",
                        outcome: "passed",
                      },
                    ],
                  },
                  release: {
                    spec_id: "GOV-001",
                    requirement_ids: ["REQ-001"],
                    risk_class: "docs-tooling",
                    release_reconciliation:
                      "Governance fixture is release-ready.",
                    verification_output: [
                      {
                        command: "pnpm governance",
                        outcome: "passed",
                      },
                    ],
                    risks: [],
                    follow_ups: [],
                  },
                },
              },
            ],
          }
        )
  )
  writeFileSync(
    join(root, "micro-specs/TRACEABILITY.md"),
    overrides.traceabilityMarkdown ??
      "# Traceability\n\n## GOV-001\n\nStatus implemented\nRisk docs-tooling\nChange current\ntests/micro-specs/ai-governance.test.ts\npnpm governance\npnpm lint\npnpm typecheck\npnpm test\ntests/micro-specs/**\nREQ-001\nunit\n"
  )
  writeFileSync(join(root, "tests/micro-specs/ai-governance.test.ts"), "")
  writeFileSync(
    join(root, "tests/fixtures/governance/handoff-workflows.json"),
    ""
  )

  return root
}

function governanceFixtureScenario(name: string) {
  const scenarios = JSON.parse(
    readFileSync(
      join(process.cwd(), "tests/fixtures/governance/handoff-workflows.json"),
      "utf8"
    )
  )
  return scenarios[name]
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
    "implementation_surfaces",
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
