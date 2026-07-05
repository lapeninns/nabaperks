import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { matchesPattern } from "../../scripts/governance-glob.mjs"
import { parseFrontmatter } from "../../scripts/governance-io.mjs"
import {
  isManualInspectionGate,
  validateGovernance,
} from "../../scripts/governance-rules.mjs"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

// Pinned so freshness/expiry assertions cannot rot with the calendar.
const NOW = new Date("2026-07-05T12:00:00Z")

test("Given the current governance files When validation runs Then the metadata and CI contract pass", () => {
  const result = validateGovernance(projectRoot, { changedFiles: [] })

  assert.deepEqual(result.failures, [])
})

test("Given an active ui-only spec When Playwright gates are omitted Then validation fails", (t) => {
  const root = fixtureRepo(t, {
    spec: specFile({
      riskClass: "ui-only",
      gates: ["pnpm lint", "pnpm typecheck", "pnpm build", "pnpm test"],
      tests: ["tests/micro-specs/example.test.mjs"],
      playwrightProjects: [],
      evidence: ["Playwright report for changed UI"],
    }),
  })

  const result = run(root)

  assert.match(result.failures.join("\n"), /requires a "test:e2e" gate/)
})

test("Given an active billing spec When DB gates are omitted Then validation fails", (t) => {
  const root = fixtureRepo(t, {
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

  const result = run(root)

  assert.match(result.failures.join("\n"), /requires a "test:db" gate/)
  assert.match(result.failures.join("\n"), /durable-proof gate/)
})

test("Given an active docs-tooling spec When coverage is omitted Then validation fails", (t) => {
  const root = fixtureRepo(t, {
    spec: specFile({
      riskClass: "docs-tooling",
      gates: [
        "pnpm lint",
        "pnpm typecheck",
        "pnpm governance:check",
        "pnpm test",
      ],
    }),
  })

  const result = run(root)

  assert.match(result.failures.join("\n"), /requires a "test:coverage" gate/)
})

test("Given an active spec When a changed file is outside the blast radius Then validation fails with attribution", (t) => {
  const root = fixtureRepo(t, {
    spec: specFile({
      riskClass: "docs-tooling",
      blastRadius: ["micro-specs/**"],
      surfaces: ["micro-specs/governance/example.md"],
      gates: [
        "pnpm lint",
        "pnpm typecheck",
        "pnpm governance:check",
        "pnpm test",
        "pnpm test:coverage",
      ],
    }),
  })

  const result = run(root, { changedFiles: ["app/page.tsx"] })

  const failure = result.failures.find((entry) => entry.includes("app/page.tsx"))
  assert.ok(failure, "expected a blast-radius failure for app/page.tsx")
  assert.match(failure, /outside every active Micro-Spec allowed_blast_radius/)
  assert.match(failure, /consulted: MS-test-governance/)
})

test("Given a verification gate with shell metacharacters When validation runs Then the gate is rejected", (t) => {
  const root = fixtureRepo(t, {
    spec: specFile({
      riskClass: "docs-tooling",
      gates: [
        "pnpm lint && echo unsafe",
        "pnpm typecheck",
        "pnpm governance:check",
        "pnpm test",
        "pnpm test:coverage",
        "pnpm lint",
      ],
    }),
  })

  const result = run(root)

  assert.match(result.failures.join("\n"), /declares unknown or unsafe gate/)
})

test("Given a Playwright gate with multiple project flags When validation runs Then the gate is accepted", (t) => {
  const root = fixtureRepo(t, {
    spec: specFile({
      riskClass: "ui-only",
      gates: [
        "pnpm lint",
        "pnpm typecheck",
        "pnpm build",
        "pnpm test",
        "pnpm test:coverage",
        "pnpm bundle:check",
        'pnpm test:e2e -- --project=chromium --project=mobile-safari --grep "@governance|PWA offline fallback"',
        "pnpm test:a11y",
        "pnpm test:visual",
      ],
      tests: ["tests/e2e/example.spec.ts"],
      playwrightProjects: ["chromium", "mobile-safari"],
      evidence: ["Playwright report for changed UI"],
    }),
  })

  const result = run(root)

  assert.deepEqual(result.failures, [])
})

test("Given a spec with an unknown Playwright project When validation runs Then the project drift is rejected", (t) => {
  const root = fixtureRepo(t, {
    spec: specFile({
      riskClass: "ui-only",
      gates: [
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
      tests: ["tests/e2e/example.spec.ts"],
      playwrightProjects: ["mobile-chromium"],
      evidence: ["Playwright report for changed UI"],
    }),
  })

  const result = run(root)

  assert.match(result.failures.join("\n"), /unknown Playwright project/)
})

test("Given the repo's manual inspection gates When checked Then show-trace and manual tokens pass", () => {
  assert.equal(isManualInspectionGate("pnpm exec playwright show-report"), true)
  assert.equal(
    isManualInspectionGate("pnpm exec playwright show-trace test-results/trace.zip"),
    true
  )
  assert.equal(isManualInspectionGate("manual:security-review"), true)
  assert.equal(isManualInspectionGate("pnpm test"), false)
})

test("Given the engine glob dialect When patterns are matched Then semantics hold", () => {
  const table = [
    ["scripts/**", "scripts/check-governance.mjs", true],
    ["scripts/**", "scripts-other/x.mjs", false],
    ["src/**/*.ts", "src/a.ts", true],
    ["src/**/*.ts", "src/x/y/z.ts", true],
    ["tests/e2e/customer-join*.spec.ts", "tests/e2e/customer-join.spec.ts", true],
    ["tests/e2e/customer-join*.spec.ts", "tests/e2e/customer-join-extra.spec.ts", true],
    ["tests/e2e/customer-join*.spec.ts", "tests/e2e/customer-redeem.spec.ts", false],
    ["app/(auth)/**", "app/(auth)/signup/page.tsx", true],
    ["micro-specs/**", "micro-specs/governance/factory-v2.md", true],
    ["package.json", "package.json", true],
    ["package.json", "package.json.bak", false],
  ]

  for (const [pattern, file, expected] of table) {
    assert.equal(
      matchesPattern(file, pattern),
      expected,
      `matchesPattern(${file}, ${pattern}) should be ${expected}`
    )
  }
})

test("Given wrapped frontmatter continuation lines When parsed Then the parser rejects with file line", () => {
  const parsed = parseFrontmatter(
    [
      "---",
      "spec_id: MS-x",
      "evidence_required:",
      "  - a wrapped entry that",
      "    continues on the next line",
      "---",
      "",
    ].join("\n")
  )

  assert.equal(parsed.errors.length, 1)
  assert.equal(parsed.errors[0].line, 5)
  assert.match(parsed.errors[0].message, /continuation lines are not supported/)
})

test("Given inline flow lists and quoted scalars When parsed Then they survive as real values", () => {
  const parsed = parseFrontmatter(
    ["---", "tags: [a, b, \"c d\"]", "empty: []", "title: 'Quoted: scalar'", "---", ""].join("\n")
  )

  assert.deepEqual(parsed.errors, [])
  assert.deepEqual(parsed.metadata.tags, ["a", "b", "c d"])
  assert.deepEqual(parsed.metadata.empty, [])
  assert.equal(parsed.metadata.title, "Quoted: scalar")
})

test("Given a spec with broken frontmatter When validated Then parse errors surface without metadata noise", (t) => {
  const root = fixtureRepo(t, {
    spec: specFile({ riskClass: "docs-tooling" }),
    extraSpecs: {
      "governance/broken.md": [
        "---",
        "spec_id: MS-test-broken",
        "status: active",
        "notes: |",
        "  block scalar",
        "---",
        "# Broken",
        "",
      ].join("\n"),
    },
  })

  const result = run(root)

  assert.ok(
    result.failures.some(
      (f) => f.includes("governance/broken.md:4") && f.includes("block scalars")
    ),
    `expected file:line parse failure, got ${JSON.stringify(result.failures)}`
  )
  assert.equal(
    result.failures.filter((f) => f.includes("broken.md is missing metadata field")).length,
    0,
    "parse failures must suppress cascading metadata noise"
  )
})

test("Given approved_exceptions entries When malformed or expired Then validation fails", (t) => {
  const root = fixtureRepo(t, {
    spec: specFile({
      riskClass: "docs-tooling",
      exceptions: [
        "waiting on harness",
        "still waiting (expires: 2026-01-01)",
        "valid waiver (expires: 2026-12-31)",
      ],
    }),
  })

  const result = run(root)

  assert.match(result.failures.join("\n"), /must end with "\(expires: YYYY-MM-DD\)"/)
  assert.match(result.failures.join("\n"), /expired on 2026-01-01/)
  assert.equal(
    result.failures.filter((f) => f.includes("valid waiver")).length,
    0,
    "unexpired well-formed exceptions must pass"
  )
})

test("Given an active spec When last_reviewed is stale Then validation fails; implemented is exempt", (t) => {
  const root = fixtureRepo(t, {
    spec: specFile({ riskClass: "docs-tooling", lastReviewed: "2026-05-01" }),
    extraSpecs: {
      "governance/old-implemented.md": specFile({
        specId: "MS-test-old-implemented",
        status: "implemented",
        riskClass: "docs-tooling",
        lastReviewed: "2026-01-01",
      }),
    },
  })

  const result = run(root)

  assert.match(result.failures.join("\n"), /MS-test-governance is active but last_reviewed is 65 days old \(limit 30\)/)
  assert.equal(result.failures.filter((f) => f.includes("MS-test-old-implemented")).length, 0)
})

test("Given related_tests entries When missing or glob Then only literal existing paths pass", (t) => {
  const root = fixtureRepo(t, {
    spec: specFile({
      riskClass: "docs-tooling",
      tests: [
        "tests/micro-specs/example.test.mjs",
        "tests/micro-specs/missing.test.mjs",
        "tests/micro-specs/*.test.mjs",
        "not-yet-created",
      ],
    }),
  })

  const result = run(root)

  assert.match(result.failures.join("\n"), /"tests\/micro-specs\/missing\.test\.mjs" does not exist/)
  assert.match(result.failures.join("\n"), /"tests\/micro-specs\/\*\.test\.mjs" is a glob/)
  assert.equal(
    result.failures.filter(
      (f) => f.includes('entry "tests/micro-specs/example.test.mjs"') || f.includes('entry "not-yet-created"')
    ).length,
    0
  )
})

test("Given implementation surfaces outside the spec's own radius Then validation fails", (t) => {
  const root = fixtureRepo(t, {
    spec: specFile({
      riskClass: "docs-tooling",
      blastRadius: ["micro-specs/**", "scripts/**", "tests/**", "package.json"],
      surfaces: ["scripts/check-governance.mjs", "supabase/migrations/001.sql"],
    }),
  })

  const result = run(root)

  assert.match(
    result.failures.join("\n"),
    /surface "supabase\/migrations\/001\.sql" is outside the spec's own allowed_blast_radius/
  )
})

test("Given a radius pattern with prose whitespace Then validation fails", (t) => {
  const root = fixtureRepo(t, {
    spec: specFile({
      riskClass: "docs-tooling",
      blastRadius: ["micro-specs/**", "scripts/** (tooling only)"],
    }),
  })

  const result = run(root)

  assert.match(result.failures.join("\n"), /contains whitespace/)
})

test("Given CI and README gate lists When they drift Then both directions fail", (t) => {
  const root = fixtureRepo(t, {
    spec: specFile({ riskClass: "docs-tooling" }),
    ciLines: [
      "      - run: pnpm lint",
      "      - run: pnpm typecheck",
      "      - run: pnpm governance:check",
      "      - run: |",
      "          pnpm start > /tmp/app.log 2>&1 &",
      "          pnpm test",
      "      - run: pnpm jsonld:check",
    ],
    readmeGates: ["pnpm lint", "pnpm typecheck", "pnpm governance:check", "pnpm test", "pnpm build"],
  })

  const result = run(root)

  // CI runs jsonld:check but the README omits it (pnpm test inside run:| counts).
  assert.match(result.failures.join("\n"), /omits CI command "pnpm jsonld:check"/)
  // The README lists build but CI never runs it.
  assert.match(result.failures.join("\n"), /lists "pnpm build" but no CI workflow runs it/)
  // The backgrounded pnpm start server line is filtered on both sides.
  assert.equal(result.failures.filter((f) => f.includes("pnpm start")).length, 0)
})

function run(root, options = {}) {
  return validateGovernance(root, { changedFiles: [], now: NOW, ...options })
}

function fixtureRepo(t, { spec, extraSpecs = {}, ciLines = null, readmeGates = null }) {
  const root = mkdtempSync(path.join(tmpdir(), "nabaperks-governance-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))

  mkdirSync(path.join(root, ".github/workflows"), { recursive: true })
  mkdirSync(path.join(root, "micro-specs/governance"), { recursive: true })
  mkdirSync(path.join(root, "tests/micro-specs"), { recursive: true })
  mkdirSync(path.join(root, "tests/e2e"), { recursive: true })

  writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify(
      {
        scripts: {
          "bundle:check": "node scripts/check-bundle-size.mjs",
          build: "next build",
          "claims:check": "node scripts/check-banned-claims.mjs",
          "governance:check": "node scripts/check-governance.mjs",
          "governance:run-gates": "node scripts/run-governance-gates.mjs",
          "jsonld:check": "node scripts/check-jsonld.mjs",
          lighthouse: "lhci autorun",
          lint: "eslint",
          test: "node --test tests/micro-specs/*.test.mjs",
          "test:a11y": "playwright test --grep @a11y",
          "test:coverage":
            "node --test --experimental-test-coverage tests/unit/*.test.mjs",
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

  const defaultCi = [
    "      - run: pnpm lint",
    "      - run: pnpm typecheck",
    "      - run: pnpm governance:check",
    "      - run: pnpm test",
    "      - run: pnpm build",
  ]
  writeFileSync(
    path.join(root, ".github/workflows/ci.yml"),
    ["name: CI", "jobs:", "  build:", "    steps:", ...(ciLines ?? defaultCi), ""].join("\n")
  )

  const defaultReadme = ["pnpm lint", "pnpm typecheck", "pnpm governance:check", "pnpm test", "pnpm build"]
  writeFileSync(
    path.join(root, "micro-specs/README.md"),
    [
      "# AI Governance Index",
      "",
      "## Current Verification Gates",
      "",
      ...(readmeGates ?? defaultReadme).map((gate) => `- \`${gate}\``),
      "",
    ].join("\n")
  )

  writeFileSync(
    path.join(root, "playwright.config.ts"),
    [
      "export default {",
      "  projects: [",
      '    { name: "chromium" },',
      '    { name: "mobile-safari" },',
      "  ],",
      "}",
      "",
    ].join("\n")
  )

  // Files the default specs reference must actually exist under the new
  // related_tests existence rule.
  writeFileSync(path.join(root, "tests/micro-specs/example.test.mjs"), "// fixture\n")
  writeFileSync(
    path.join(root, "tests/micro-specs/governance-enforcement.test.mjs"),
    "// fixture\n"
  )
  writeFileSync(path.join(root, "tests/e2e/example.spec.ts"), "// fixture\n")
  writeFileSync(path.join(root, "tests/e2e/billing.spec.ts"), "// fixture\n")

  writeFileSync(path.join(root, "micro-specs/governance/example.md"), spec)
  for (const [file, source] of Object.entries(extraSpecs)) {
    const target = path.join(root, "micro-specs", file)
    mkdirSync(path.dirname(target), { recursive: true })
    writeFileSync(target, source)
  }

  return root
}

function specFile({
  specId = "MS-test-governance",
  status = "active",
  riskClass,
  lastReviewed = "2026-07-01",
  blastRadius = ["micro-specs/**", "scripts/**", "tests/**", "package.json"],
  surfaces = null,
  gates = [
    "pnpm lint",
    "pnpm typecheck",
    "pnpm governance:check",
    "pnpm test",
    "pnpm test:coverage",
  ],
  tests = ["tests/micro-specs/governance-enforcement.test.mjs"],
  playwrightProjects = [],
  evidence = ["CI output"],
  exceptions = [],
}) {
  return [
    "---",
    `spec_id: ${specId}`,
    `status: ${status}`,
    `risk_class: ${riskClass}`,
    "owner: codex",
    `last_reviewed: ${lastReviewed}`,
    field("allowed_blast_radius", blastRadius),
    field("implementation_surfaces", surfaces ?? blastRadius),
    field("related_tests", tests),
    field("verification_gates", gates),
    field("required_playwright_projects", playwrightProjects),
    field("evidence_required", evidence),
    field("approved_exceptions", exceptions),
    "---",
    "",
    "# Test spec",
    "",
  ].join("\n")
}

function field(key, values) {
  if (values.length === 0) return `${key}: []`
  return `${key}:\n${values.map((value) => `  - ${value}`).join("\n")}`
}
