import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { changedFilesSince } from "../../scripts/governance-commands.mjs"
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

test("Given mutually stale specs When one gate run inherits both ids Then nested gates retain both exemptions", () => {
  const runner = readFileSync(
    path.join(projectRoot, "scripts/run-governance-gates.mjs"),
    "utf8"
  )

  assert.match(
    runner,
    /gateReprovingSpecIds[\s\S]*new Set\(\[\.\.\.reprovingSpecIds, \.\.\.inheritedReprovingSpecIds\]\)/
  )
  assert.match(
    runner,
    /GOVERNANCE_REPROVING_SPECS:\s*gateReprovingSpecIds\.join\(","\)/
  )
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

test("Given an active spec with a bare test:e2e gate When validated Then the broad browser gate is rejected", (t) => {
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
      playwrightProjects: ["chromium", "mobile-safari"],
      evidence: ["Playwright report for changed UI"],
    }),
  })

  const result = run(root)

  const broad = result.failures.filter((entry) => entry.includes("broad browser gate"))
  assert.equal(
    broad.length,
    1,
    `only the grep-less test:e2e gate is broad (the tag-scoped test:a11y/test:visual wrappers are not), got ${JSON.stringify(result.failures)}`
  )
  assert.match(broad[0], /broad browser gate "pnpm test:e2e"/)
  assert.match(broad[0], /--grep/)
  assert.match(broad[0], /broad-browser-gate/)
})

test("Given an active spec When its e2e gate carries a spec-owned --grep tag Then the scoped gate passes", (t) => {
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
        'pnpm test:e2e -- --grep "@some-tag"',
        "pnpm test:a11y",
        "pnpm test:visual",
      ],
      tests: ["tests/e2e/example.spec.ts"],
      playwrightProjects: ["chromium", "mobile-safari"],
      evidence: ["Playwright report for changed UI"],
    }),
  })

  assert.deepEqual(run(root).failures, [])
})

test("Given an active spec When its e2e gate uses an anchored spec-owned --grep tag Then the scoped gate passes", (t) => {
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
        'pnpm test:e2e -- --grep "^@some-tag"',
        "pnpm test:a11y",
        "pnpm test:visual",
      ],
      tests: ["tests/e2e/example.spec.ts"],
      playwrightProjects: ["chromium", "mobile-safari"],
      evidence: ["Playwright report for changed UI"],
    }),
  })

  assert.deepEqual(run(root).failures, [])
})

test("Given a broad browser gate When a dated broad-browser-gate exception exists Then only an expired waiver fails", (t) => {
  const gates = [
    "pnpm lint",
    "pnpm typecheck",
    "pnpm build",
    "pnpm test",
    "pnpm test:coverage",
    "pnpm bundle:check",
    "pnpm test:e2e",
    "pnpm test:a11y",
    "pnpm test:visual",
  ]
  const browserSpec = { gates, tests: ["tests/e2e/example.spec.ts"], playwrightProjects: ["chromium"], evidence: ["Playwright report for changed UI"] }
  const root = fixtureRepo(t, {
    spec: specFile({
      riskClass: "ui-only",
      ...browserSpec,
      exceptions: [
        "broad-browser-gate: rewires the global nav shell across every journey (expires: 2026-12-31)",
      ],
    }),
    extraSpecs: {
      "governance/expired-waiver.md": specFile({
        specId: "MS-test-expired-waiver",
        riskClass: "ui-only",
        ...browserSpec,
        exceptions: ["broad-browser-gate: stale justification (expires: 2026-01-01)"],
      }),
    },
  })

  const result = run(root)

  assert.equal(
    result.failures.filter((f) => f.includes("broad browser gate")).length,
    0,
    "the token waives the scoped-gate rule; entry freshness is policed by the expiry rule"
  )
  assert.equal(result.failures.filter((f) => f.includes("MS-test-governance")).length, 0)
  assert.ok(
    result.failures.some((f) => f.includes("expired-waiver.md") && f.includes("expired on 2026-01-01")),
    `an expired waiver must still fail the spec, got ${JSON.stringify(result.failures)}`
  )
})

test("Given an implemented spec with a bare test:e2e gate When validated Then the scoped-gate rule does not apply", (t) => {
  const root = fixtureRepo(t, {
    spec: specFile({ riskClass: "docs-tooling" }),
    extraSpecs: {
      "governance/shipped.md": specFile({
        specId: "MS-test-shipped",
        status: "implemented",
        riskClass: "ui-only",
        gates: ["pnpm lint", "pnpm typecheck", "pnpm build", "pnpm test", "pnpm test:e2e"],
        tests: ["tests/e2e/example.spec.ts"],
        playwrightProjects: ["chromium"],
        evidence: ["Playwright report for changed UI"],
      }),
    },
  })

  const result = run(root)

  assert.equal(
    result.failures.filter((f) => f.includes("MS-test-shipped") || f.includes("shipped.md")).length,
    0,
    `implemented specs keep their recorded gates, got ${JSON.stringify(result.failures)}`
  )
})

test("Given non-Playwright gates without --grep When validated Then they are not rejected as broad", (t) => {
  const root = fixtureRepo(t, {
    spec: specFile({
      riskClass: "docs-tooling",
      gates: [
        "pnpm lint",
        "pnpm typecheck",
        "pnpm governance:check",
        "pnpm test",
        "pnpm test:coverage",
        "pnpm test:db",
      ],
    }),
  })

  assert.deepEqual(run(root).failures, [])
})

test("Given an active spec When a high-risk surface rides a weaker risk class Then the risk hint fails", (t) => {
  const root = fixtureRepo(t, {
    spec: specFile({
      riskClass: "docs-tooling",
      blastRadius: ["micro-specs/**", "supabase/migrations/**", "package.json"],
      surfaces: ["supabase/migrations/0001_example.sql"],
    }),
  })

  const result = run(root)

  const hint = result.failures.find((entry) => entry.includes("high-risk path"))
  assert.ok(hint, `expected a risk-radius hint failure, got ${JSON.stringify(result.failures)}`)
  assert.match(hint, /"supabase\/migrations\/0001_example\.sql"/)
  assert.match(hint, /"supabase\/migrations\/\*\*"/)
  assert.match(hint, /migrations or rls-rpc-ledger/)
})

test("Given an active spec When a broad surface glob hides a hinted path Then the risk hint still fails", (t) => {
  const root = fixtureRepo(t, {
    spec: specFile({
      riskClass: "docs-tooling",
      blastRadius: ["micro-specs/**", "supabase/**", "package.json"],
      surfaces: ["supabase/**"],
    }),
  })

  const result = run(root)

  assert.ok(
    result.failures.some((entry) => entry.includes("high-risk path")),
    `a surface glob covering supabase/migrations must trip the hint, got ${JSON.stringify(result.failures)}`
  )
})

test("Given an active migrations spec with a migrations surface Then the risk hint is satisfied", (t) => {
  const root = fixtureRepo(t, {
    spec: specFile({
      riskClass: "migrations",
      blastRadius: ["micro-specs/**", "supabase/migrations/**", "package.json"],
      surfaces: ["supabase/migrations/0001_example.sql"],
      gates: [
        "pnpm lint",
        "pnpm typecheck",
        "pnpm build",
        "pnpm test",
        "pnpm test:coverage",
        "pnpm test:db",
      ],
    }),
  })

  assert.deepEqual(run(root).failures, [])
})

test("Given an active spec When its radius claims too many broad roots Then breadth fails unless waived", (t) => {
  const broadRadius = ["app/**", "lib/**", "components/pwa/**", "micro-specs/governance/**", "package.json"]
  const root = fixtureRepo(t, {
    spec: specFile({
      riskClass: "docs-tooling",
      blastRadius: broadRadius,
      surfaces: ["micro-specs/governance/example.md"],
    }),
    extraSpecs: {
      "governance/waived-broad.md": specFile({
        specId: "MS-test-waived-broad",
        riskClass: "docs-tooling",
        blastRadius: broadRadius,
        surfaces: ["micro-specs/governance/waived-broad.md"],
        exceptions: [
          "broad-blast-radius: repo-wide sweep is the point of this spec (expires: 2026-12-31)",
        ],
      }),
      "governance/shipped-broad.md": specFile({
        specId: "MS-test-shipped-broad",
        status: "implemented",
        riskClass: "docs-tooling",
        blastRadius: broadRadius,
        surfaces: ["micro-specs/governance/shipped-broad.md"],
      }),
    },
  })

  const result = run(root)

  const breadth = result.failures.find(
    (entry) => entry.includes("MS-test-governance") && entry.includes("broad radius roots")
  )
  assert.ok(breadth, `expected a breadth failure, got ${JSON.stringify(result.failures)}`)
  assert.match(breadth, /app\/\*\*, lib\/\*\*/)
  assert.match(breadth, /broad-blast-radius/)
  assert.ok(
    !breadth.includes("components/pwa/**"),
    "scoped subpaths never count as broad roots"
  )
  assert.equal(result.failures.filter((f) => f.includes("MS-test-waived-broad")).length, 0)
  assert.equal(
    result.failures.filter((f) => f.includes("MS-test-shipped-broad") || f.includes("shipped-broad.md")).length,
    0,
    "breadth applies to active specs only"
  )
})

test("Given a scoped browser gate When its grep tag misses the spec's own tests Then the crosscheck fails", (t) => {
  const browserGates = [
    "pnpm lint",
    "pnpm typecheck",
    "pnpm build",
    "pnpm test",
    "pnpm test:coverage",
    "pnpm bundle:check",
    'pnpm test:e2e -- --grep "@missing-tag"',
    "pnpm test:a11y",
    "pnpm test:visual",
  ]
  const root = fixtureRepo(t, {
    spec: specFile({
      riskClass: "ui-only",
      gates: browserGates,
      tests: ["tests/e2e/example.spec.ts"],
      playwrightProjects: ["chromium"],
      evidence: ["Playwright report for changed UI"],
    }),
  })

  const result = run(root)

  const miss = result.failures.find((entry) => entry.includes("matches none of the spec's related browser tests"))
  assert.ok(miss, `expected a grep crosscheck failure, got ${JSON.stringify(result.failures)}`)
  assert.match(miss, /@missing-tag/)
  assert.match(miss, /tests\/e2e\/example\.spec\.ts/)
})

test("Given a scoped browser gate When its grep pattern is not a valid regex Then the crosscheck fails", (t) => {
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
        'pnpm test:e2e -- --grep "(["',
        "pnpm test:a11y",
        "pnpm test:visual",
      ],
      tests: ["tests/e2e/example.spec.ts"],
      playwrightProjects: ["chromium"],
      evidence: ["Playwright report for changed UI"],
    }),
  })

  const result = run(root)

  assert.ok(
    result.failures.some((entry) => entry.includes("is not a valid regular expression")),
    `expected an invalid-regex failure, got ${JSON.stringify(result.failures)}`
  )
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

test("Given closed specs When their records conform or rot Then the closed-record contract is enforced", (t) => {
  const root = fixtureRepo(t, {
    spec: specFile({ riskClass: "docs-tooling" }),
    extraSpecs: {
      "governance/closed-good.md": specFile({
        specId: "MS-test-closed-good",
        status: "closed",
        riskClass: "docs-tooling",
        body: closedRecordBody(),
      }),
      "governance/closed-plan.md": specFile({
        specId: "MS-test-closed-plan",
        status: "closed",
        riskClass: "docs-tooling",
        body: [...closedRecordBody(), "## 5. Behavioral Requirements (EARS)", ""],
      }),
      "governance/closed-stale.md": specFile({
        specId: "MS-test-closed-stale",
        status: "closed",
        riskClass: "docs-tooling",
        body: closedRecordBody("tests/micro-specs/renamed-away.test.mjs"),
      }),
      "governance/closed-bare.md": specFile({
        specId: "MS-test-closed-bare",
        status: "closed",
        riskClass: "docs-tooling",
        body: ["## Why It Exists", "", "Only one heading survived.", ""],
      }),
      "governance/closed-sentinel.md": specFile({
        specId: "MS-test-closed-sentinel",
        status: "closed",
        riskClass: "docs-tooling",
        tests: ["not-yet-created"],
        body: closedRecordBody(),
      }),
    },
  })

  const { failures } = run(root)

  assert.equal(
    failures.filter((f) => f.includes("closed-good.md")).length,
    0,
    `a conforming record (file + directory pointers) must pass, got ${JSON.stringify(failures)}`
  )
  assert.ok(
    failures.some((f) => f.includes("closed-plan.md") && f.includes("build-plan heading")),
    "a lingering activation heading proves the rewrite never happened"
  )
  assert.ok(
    failures.some(
      (f) =>
        f.includes("closed-stale.md") &&
        f.includes('"tests/micro-specs/renamed-away.test.mjs" does not resolve')
    ),
    "a stale pointer is a failure, not a warning"
  )
  assert.ok(
    failures.some(
      (f) => f.includes("closed-bare.md") && f.includes('missing the required heading "## Invariants"')
    )
  )
  assert.ok(
    failures.some((f) => f.includes("closed-sentinel.md") && f.includes("related_tests sentinel"))
  )
})

test("Given an implemented spec When surfaces changed after the proving run Then staleness fails with the cure", (t) => {
  const root = fixtureRepo(t, {
    spec: specFile({ riskClass: "docs-tooling" }),
    extraSpecs: {
      "governance/stale.md": specFile({
        specId: "MS-test-stale",
        status: "implemented",
        riskClass: "docs-tooling",
        blastRadius: ["micro-specs/**", "scripts/thing.mjs"],
        surfaces: ["scripts/thing.mjs"],
      }),
    },
    ledgers: {
      "MS-test-stale": { spec_id: "MS-test-stale", runs: [{ git_sha: "a1b2c3d4e5f6a7b8", all_passed: true }] },
    },
  })

  const result = run(root, {
    changedFilesSince: () => ["scripts/thing.mjs", "app/unrelated.tsx"],
    // Hermetic against an ambient re-proving marker (this suite itself runs
    // inside recording gate runs).
    env: {},
  })

  const stale = result.failures.find((entry) => entry.includes("changed after the proving run"))
  assert.ok(stale, `expected a staleness failure, got ${JSON.stringify(result.failures)}`)
  assert.match(stale, /MS-test-stale/)
  assert.match(stale, /a1b2c3d4e5/)
  assert.match(stale, /scripts\/thing\.mjs/)
  assert.ok(!stale.includes("app/unrelated.tsx"), "only surface-matching files are named")
  assert.match(stale, /governance:run-gates --spec MS-test-stale --record/)
})

test("Given staleness edge cases When history is unknowable, non-surface, bookkeeping-only, or status-exempt Then nothing is flagged", (t) => {
  const implementedSpec = (specId, file, overrides = {}) =>
    specFile({
      specId,
      status: "implemented",
      riskClass: "docs-tooling",
      blastRadius: ["micro-specs/**", "scripts/thing.mjs"],
      surfaces: ["scripts/thing.mjs", `micro-specs/governance/${file}`],
      ...overrides,
    })
  const root = fixtureRepo(t, {
    spec: specFile({ riskClass: "docs-tooling" }),
    extraSpecs: {
      "governance/clean.md": implementedSpec("MS-test-clean", "clean.md"),
      "governance/bookkeeping.md": implementedSpec("MS-test-bookkeeping", "bookkeeping.md"),
      "governance/unknowable.md": implementedSpec("MS-test-unknowable", "unknowable.md"),
      "governance/no-runs.md": implementedSpec("MS-test-no-runs", "no-runs.md"),
      "governance/still-active.md": specFile({
        specId: "MS-test-still-active",
        riskClass: "docs-tooling",
        blastRadius: ["micro-specs/**", "scripts/thing.mjs"],
        surfaces: ["scripts/thing.mjs"],
      }),
    },
    ledgers: {
      "MS-test-clean": { spec_id: "MS-test-clean", runs: [{ git_sha: "clean0000000000" }] },
      "MS-test-bookkeeping": { spec_id: "MS-test-bookkeeping", runs: [{ git_sha: "book00000000000" }] },
      "MS-test-unknowable": { spec_id: "MS-test-unknowable", runs: [{ git_sha: "gone00000000000" }] },
      "MS-test-no-runs": { spec_id: "MS-test-no-runs", runs: [] },
      "MS-test-still-active": { spec_id: "MS-test-still-active", runs: [{ git_sha: "act000000000000" }] },
    },
  })

  const result = run(root, {
    changedFilesSince: (rootDir, sha) => {
      if (sha === "clean0000000000") return ["docs/notes.md"]
      if (sha === "book00000000000") {
        return [
          "micro-specs/governance/bookkeeping.md",
          "micro-specs/evidence/MS-test-bookkeeping.json",
        ]
      }
      if (sha === "gone00000000000") return null
      return ["scripts/thing.mjs"]
    },
    env: {},
  })

  assert.deepEqual(
    result.failures.filter((entry) => entry.includes("changed after the proving run")),
    [],
    `no staleness failures expected, got ${JSON.stringify(result.failures)}`
  )
})

test("Given a stale spec When it is exempted for a re-proving run Then only the exempted id is skipped", (t) => {
  const staleSpec = (specId, file) =>
    specFile({
      specId,
      status: "implemented",
      riskClass: "docs-tooling",
      blastRadius: ["micro-specs/**", "scripts/thing.mjs"],
      surfaces: ["scripts/thing.mjs"],
    })
  const ledger = (specId) => ({ spec_id: specId, runs: [{ git_sha: `${specId}-sha` }] })
  const root = fixtureRepo(t, {
    spec: specFile({ riskClass: "docs-tooling" }),
    extraSpecs: {
      "governance/exempted.md": staleSpec("MS-test-exempted", "exempted.md"),
      "governance/not-exempted.md": staleSpec("MS-test-not-exempted", "not-exempted.md"),
    },
    ledgers: {
      "MS-test-exempted": ledger("MS-test-exempted"),
      "MS-test-not-exempted": ledger("MS-test-not-exempted"),
    },
  })
  const changedFilesSince = () => ["scripts/thing.mjs"]

  const viaEnv = run(root, {
    changedFilesSince,
    env: { GOVERNANCE_REPROVING_SPECS: "MS-test-exempted, MS-other" },
  })
  assert.equal(
    viaEnv.failures.filter((f) => f.includes("MS-test-exempted") && f.includes("changed after the proving run")).length,
    0,
    "the env-exempted spec is skipped"
  )
  assert.equal(
    viaEnv.failures.filter((f) => f.includes("MS-test-not-exempted") && f.includes("changed after the proving run")).length,
    1,
    "non-exempted specs still fail"
  )

  const viaOption = run(root, {
    changedFilesSince,
    reprovingSpecIds: ["MS-test-exempted", "MS-test-not-exempted"],
    env: {},
  })
  assert.equal(
    viaOption.failures.filter((f) => f.includes("changed after the proving run")).length,
    0,
    "the in-process option exempts the listed ids"
  )
})

test("Given a red-ledgered implemented spec When it is being re-proven Then run-freshness is exempt but provenance holds", (t) => {
  const redLedger = {
    spec_id: "MS-test-red",
    runs: [{ git_sha: "red0000000", gates: [{ command: "pnpm lint", exit_code: 1 }], all_passed: false }],
    transitions: [{ from: "active", to: "implemented" }],
  }
  const root = fixtureRepo(t, {
    spec: specFile({ riskClass: "docs-tooling" }),
    extraSpecs: {
      "governance/red.md": specFile({
        specId: "MS-test-red",
        status: "implemented",
        riskClass: "docs-tooling",
      }),
      "governance/hand-flipped.md": specFile({
        specId: "MS-test-hand-flipped",
        status: "implemented",
        riskClass: "docs-tooling",
      }),
    },
    ledgers: {
      "MS-test-red": redLedger,
      "MS-test-hand-flipped": { spec_id: "MS-test-hand-flipped", runs: [], transitions: [] },
    },
  })

  const strict = run(root, { evidenceAdoptionDate: "2026-01-01", env: {} })
  assert.ok(
    strict.failures.some((f) => f.includes("MS-test-red") && f.includes("does not cover")),
    `a red/uncovering latest run fails outside a re-proving context, got ${JSON.stringify(strict.failures)}`
  )

  const reproving = run(root, {
    evidenceAdoptionDate: "2026-01-01",
    env: { GOVERNANCE_REPROVING_SPECS: "MS-test-red" },
  })
  assert.equal(
    reproving.failures.filter((f) => f.includes("MS-test-red")).length,
    0,
    `run-freshness is exempt for the spec being re-proven, got ${JSON.stringify(reproving.failures)}`
  )
  assert.ok(
    reproving.failures.some(
      (f) => f.includes("MS-test-hand-flipped") && f.includes("no transition")
    ),
    "provenance stays enforced even under the re-proving exemption"
  )
})

test("Given a real git history When changedFilesSince reads it Then ancestors diff and unknowable shas are null", (t) => {
  const root = mkdtempSync(path.join(tmpdir(), "nabaperks-gitreader-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const git = (...args) =>
    execFileSync("git", args, { cwd: root, stdio: ["ignore", "pipe", "ignore"], encoding: "utf8" }).trim()

  git("init", "-q", "-b", "main")
  git("config", "user.email", "fixture@example.com")
  git("config", "user.name", "Fixture")
  git("config", "commit.gpgsign", "false")
  writeFileSync(path.join(root, "a.txt"), "one\n")
  git("add", "a.txt")
  git("commit", "-q", "-m", "first")
  const base = git("rev-parse", "HEAD")

  // A side branch: its tip resolves in the clone but is not an ancestor of
  // main's HEAD — the squash-merge shape the check must treat as unknowable.
  git("checkout", "-q", "-b", "side")
  writeFileSync(path.join(root, "c.txt"), "side\n")
  git("add", "c.txt")
  git("commit", "-q", "-m", "side")
  const side = git("rev-parse", "HEAD")
  git("checkout", "-q", "main")

  writeFileSync(path.join(root, "a.txt"), "two\n")
  writeFileSync(path.join(root, "b.txt"), "new\n")
  git("add", ".")
  git("commit", "-q", "-m", "second")

  assert.deepEqual(changedFilesSince(root, base).sort(), ["a.txt", "b.txt"])
  assert.equal(changedFilesSince(root, side), null, "a non-ancestor sha is unknowable history")
  assert.equal(changedFilesSince(root, "0".repeat(40)), null, "an unresolvable sha is unknowable history")
  assert.equal(changedFilesSince(root, null), null)
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
  return validateGovernance(root, {
    changedFiles: [],
    now: NOW,
    // Fixtures exercise the metadata/drift rules; the ledger contract has its
    // own suites (governance-evidence / advance-spec tests) and is pinned off.
    evidenceAdoptionDate: null,
    ...options,
  })
}

// A conforming closed-record body: every required heading, one file pointer,
// one directory pointer, and a bare symbol that must parse as prose.
function closedRecordBody(pointer = "tests/micro-specs/example.test.mjs") {
  return [
    "## Why It Exists",
    "",
    "Pins the closed-record contract in fixtures.",
    "",
    "## Invariants",
    "",
    "- Status lines are machine-written.",
    "",
    "## Code Pointers",
    "",
    `- \`validateGovernance\` behavior pinned by \`${pointer}\`.`,
    "- Harness directory: `tests/micro-specs` (directory pointers are sanctioned).",
    "",
    "## Dead Ends",
    "",
    "None.",
    "",
  ]
}

function fixtureRepo(t, { spec, extraSpecs = {}, ciLines = null, readmeGates = null, ledgers = {} }) {
  const root = mkdtempSync(path.join(tmpdir(), "nabaperks-governance-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))

  mkdirSync(path.join(root, ".github/workflows"), { recursive: true })
  mkdirSync(path.join(root, "micro-specs/governance"), { recursive: true })
  mkdirSync(path.join(root, "micro-specs/evidence"), { recursive: true })
  mkdirSync(path.join(root, "tests/micro-specs"), { recursive: true })
  mkdirSync(path.join(root, "tests/e2e"), { recursive: true })

  for (const [specId, ledger] of Object.entries(ledgers)) {
    writeFileSync(
      path.join(root, "micro-specs/evidence", `${specId}.json`),
      `${JSON.stringify(ledger, null, 2)}\n`
    )
  }

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
  // related_tests existence rule. The e2e fixture carries the grep tags the
  // scoped-gate fixtures reference, so the grep crosscheck can match content.
  writeFileSync(path.join(root, "tests/micro-specs/example.test.mjs"), "// fixture\n")
  writeFileSync(
    path.join(root, "tests/micro-specs/governance-enforcement.test.mjs"),
    "// fixture\n"
  )
  writeFileSync(
    path.join(root, "tests/e2e/example.spec.ts"),
    'test("@some-tag @governance PWA offline fallback fixture", () => {})\n'
  )
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
  // At most one exact broad root, so default fixtures stay under the
  // radius-breadth limit; breadth cases declare their own radius.
  blastRadius = ["micro-specs/**", "tests/micro-specs/**", "tests/e2e/**", "package.json"],
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
  body = [],
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
    ...body,
  ].join("\n")
}

function field(key, values) {
  if (values.length === 0) return `${key}: []`
  return `${key}:\n${values.map((value) => `  - ${value}`).join("\n")}`
}
