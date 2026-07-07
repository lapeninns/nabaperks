import assert from "node:assert/strict"
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { matchesPattern } from "../../scripts/governance-glob.mjs"
import { parseFrontmatter } from "../../scripts/governance-io.mjs"
import {
  isManualInspectionGate,
  parsePackageScriptGate,
  validateGovernance,
} from "../../scripts/governance-rules.mjs"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

// A stable "today" so freshness/expiry tests are deterministic.
const NOW = new Date("2026-07-05T12:00:00Z")

test("Given governance is installed When required files are checked Then the spine exists", () => {
  for (const file of [
    "AGENTS.md",
    "Instructions_MicroSpecsCreation.md",
    "Instructions_tdd.md",
    "micro-specs/README.md",
    "micro-specs/GLOBAL_CONTEXT.md",
    "scripts/check-governance.mjs",
    "scripts/governance-commands.mjs",
    "scripts/governance-frontmatter.mjs",
    "scripts/governance-glob.mjs",
    "scripts/run-governance-gates.mjs",
  ]) {
    assert.equal(existsSync(path.join(projectRoot, file)), true, `${file} exists`)
  }
})

test("Given supported frontmatter When parsed Then lists, flow lists, and quotes survive", () => {
  const parsed = parseFrontmatter(`---
spec_id: MS-example
status: active
# a comment line
allowed_blast_radius:
  - scripts/**
  - "quoted path/with spaces"
required_playwright_projects: []
tags: [a, b, "c d"]
title: "Quoted: scalar"
---
# Example
`)

  assert.deepEqual(parsed.errors, [])
  assert.deepEqual(parsed.metadata.allowed_blast_radius, ["scripts/**", "quoted path/with spaces"])
  assert.deepEqual(parsed.metadata.required_playwright_projects, [])
  assert.deepEqual(parsed.metadata.tags, ["a", "b", "c d"])
  assert.equal(parsed.metadata.title, "Quoted: scalar")
})

test("Given out-of-subset frontmatter When parsed Then each construct fails with its line", () => {
  const cases = [
    {
      source: "---\nspec_id: MS-x\nevidence_required:\n  - a wrapped entry that\n    continues on the next line\n---\n",
      line: 5,
      message: /continuation lines are not supported/,
    },
    {
      source: "---\nitems:\n  - key: value\n---\n",
      line: 3,
      message: /nested maps are not supported/,
    },
    {
      source: "---\nnotes: |\n  block\n---\n",
      line: 2,
      message: /block scalars are not supported/,
    },
    {
      source: "---\nspec_id: MS-x\nspec_id: MS-y\n---\n",
      line: 3,
      message: /duplicate metadata key/,
    },
    {
      source: "---\nitems:\n\t- tabbed\n---\n",
      line: 3,
      message: /tab indentation/,
    },
    {
      source: "---\nspec_id: MS-x\n  - stray item\n---\n",
      line: 3,
      message: /list item has no open list key/,
    },
    {
      source: "---\ntags: [a, b\n---\n",
      line: 2,
      message: /unterminated flow list/,
    },
    {
      source: "---\nconfig: { a: 1 }\n---\n",
      line: 2,
      message: /flow maps are not supported/,
    },
  ]

  for (const { source, line, message } of cases) {
    const parsed = parseFrontmatter(source)
    assert.ok(parsed.errors.length > 0, `expected errors for: ${source}`)
    const hit = parsed.errors.find((error) => message.test(error.message))
    assert.ok(hit, `expected ${message} in ${JSON.stringify(parsed.errors)}`)
    assert.equal(hit.line, line, `expected line ${line} for ${message}`)
  }
})

test("Given glob patterns When matched Then the engine dialect holds", () => {
  const table = [
    ["src/**/*.ts", "src/a.ts", true],
    ["src/**/*.ts", "src/x/y/z.ts", true],
    ["src/**/*.ts", "src/a.tsx", false],
    ["scripts/**", "scripts/check.mjs", true],
    ["scripts/**", "scripts-other/x", false],
    ["p/**", "p", true],
    ["p/**", "p/a/b", true],
    ["a/*.ts", "a/b.ts", true],
    ["a/*.ts", "a/b/c.ts", false],
    ["a?c", "abc", true],
    ["a?c", "a/c", false],
    ["docs", "docs", true],
    ["docs", "docs/guide.md", true],
    ["docs", "docsy", false],
    ["app/(auth)/**", "app/(auth)/signup/page.tsx", true],
  ]

  for (const [pattern, file, expected] of table) {
    assert.equal(
      matchesPattern(file, pattern),
      expected,
      `matchesPattern(${file}, ${pattern}) should be ${expected}`
    )
  }
})

test("Given a package-script gate When parsed Then manager and script are recovered", () => {
  assert.deepEqual(parsePackageScriptGate("pnpm test"), {
    manager: "pnpm",
    scriptName: "test",
    args: undefined,
  })
  assert.equal(parsePackageScriptGate("npm run build").scriptName, "build")
  assert.equal(parsePackageScriptGate("yarn run lint").manager, "yarn")
  assert.equal(parsePackageScriptGate("bun typecheck").manager, "bun")
  assert.equal(parsePackageScriptGate("rm -rf /"), null)
  assert.equal(parsePackageScriptGate("node scripts/x.mjs"), null)
})

test("Given a manual gate token When checked Then it is recognised", () => {
  assert.equal(isManualInspectionGate("manual:security-review"), true)
  assert.equal(isManualInspectionGate("manual:design-review"), true)
  assert.equal(isManualInspectionGate("pnpm test"), false)
})

test("Given the current repo When governance is validated Then metadata passes", () => {
  const result = validateGovernance(projectRoot, {
    enforceChangedFiles: false,
  })

  assert.deepEqual(result.failures, [])
})

test("Given a changed file outside blast radius When validated Then enforcement fails with attribution", () => {
  const result = validateGovernance(projectRoot, {
    changedFiles: ["src/definitely/not/governed/secret.txt"],
  })

  assert.equal(result.ok, false)
  const failure = result.failures.find((entry) => entry.includes("allowed_blast_radius"))
  assert.ok(failure, "expected a blast-radius failure")
  assert.match(failure, /consulted: MS-/, "failure names the active specs consulted")
})

test("Given a changed file inside blast radius When validated Then blast radius passes", () => {
  const result = validateGovernance(projectRoot, {
    changedFiles: ["micro-specs/README.md"],
  })

  assert.equal(
    result.failures.filter((failure) => failure.includes("allowed_blast_radius")).length,
    0,
    "expected no blast-radius failure for an in-scope file"
  )
})

// ---------------------------------------------------------------------------
// Fixture-based enforcement tests: each writes a tiny throwaway repo and runs
// the real validator against it.
// ---------------------------------------------------------------------------

const DEFAULT_SCRIPTS = {
  "governance:check": "node scripts/check-governance.mjs",
  test: "node --test tests/micro-specs/*.test.mjs",
  lint: "node --version",
  typecheck: "node --version",
}

function makeFixture(t, { scripts = DEFAULT_SCRIPTS, specs = {}, extraFiles = {} } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "governance-fixture-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))

  writeFileSync(
    path.join(root, "package.json"),
    `${JSON.stringify({ name: "fixture", type: "module", scripts }, null, 2)}\n`
  )
  mkdirSync(path.join(root, "micro-specs"), { recursive: true })
  for (const [name, source] of Object.entries(specs)) {
    const file = path.join(root, "micro-specs", name)
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, source)
  }
  for (const [name, source] of Object.entries(extraFiles)) {
    const file = path.join(root, name)
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, source)
  }
  return root
}

function specSource(overrides = {}, body = []) {
  const metadata = {
    spec_id: "MS-fixture-example",
    status: "active",
    risk_class: "docs-tooling",
    owner: "fixture",
    last_reviewed: "2026-07-01",
    allowed_blast_radius: ["lib/**"],
    implementation_surfaces: ["lib/x.ts"],
    related_tests: ["not-yet-created"],
    verification_gates: ["pnpm governance:check", "pnpm test", "pnpm lint", "pnpm typecheck"],
    required_playwright_projects: [],
    evidence_required: ["readback"],
    approved_exceptions: [],
    ...overrides,
  }

  const lines = ["---"]
  for (const [key, value] of Object.entries(metadata)) {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`)
      } else {
        lines.push(`${key}:`)
        for (const item of value) lines.push(`  - ${item}`)
      }
    } else {
      lines.push(`${key}: ${value}`)
    }
  }
  lines.push("---", "", "# Fixture spec", "", ...body)
  return lines.join("\n")
}

// A conforming closed-record body: every required heading, one file pointer,
// one directory pointer, and a bare symbol that must parse as prose.
function closedRecordBody(pointer = "tests/unit/real.test.mjs") {
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
    "- Harness directory: `tests/unit` (directory pointers are sanctioned).",
    "",
    "## Dead Ends",
    "",
    "None.",
    "",
  ]
}

function run(root, options = {}) {
  return validateGovernance(root, {
    enforceChangedFiles: false,
    now: NOW,
    // Fixtures exercise the metadata/drift rules; the ledger contract has its
    // own suite (governance-evidence.test.mjs) and is pinned off here.
    evidenceAdoptionDate: null,
    ...options,
  })
}

test("Given a well-formed fixture repo When validated Then it passes", (t) => {
  const root = makeFixture(t, { specs: { "example.md": specSource() } })
  assert.deepEqual(run(root).failures, [])
})

test("Given approved_exceptions entries When malformed or expired Then validation fails", (t) => {
  const root = makeFixture(t, {
    specs: {
      "no-expiry.md": specSource({
        spec_id: "MS-fixture-no-expiry",
        approved_exceptions: ["waiting on harness"],
      }),
      "expired.md": specSource({
        spec_id: "MS-fixture-expired",
        approved_exceptions: ["waiting on harness (expires: 2026-01-01)"],
      }),
      "current.md": specSource({
        spec_id: "MS-fixture-current",
        approved_exceptions: ["waiting on harness (expires: 2026-12-31)"],
      }),
    },
  })

  const { failures } = run(root)
  assert.ok(failures.some((f) => f.includes("no-expiry.md") && f.includes('must end with "(expires: YYYY-MM-DD)"')))
  assert.ok(failures.some((f) => f.includes("expired.md") && f.includes("expired on 2026-01-01")))
  assert.equal(failures.filter((f) => f.includes("current.md")).length, 0)
})

test("Given an active spec When last_reviewed is stale Then validation fails; implemented is exempt", (t) => {
  const root = makeFixture(t, {
    specs: {
      "stale-active.md": specSource({
        spec_id: "MS-fixture-stale-active",
        last_reviewed: "2025-01-01",
      }),
      "old-implemented.md": specSource({
        spec_id: "MS-fixture-old-implemented",
        status: "implemented",
        last_reviewed: "2025-01-01",
      }),
    },
  })

  const { failures } = run(root)
  assert.ok(failures.some((f) => f.includes("MS-fixture-stale-active") && f.includes("last_reviewed is")))
  assert.equal(failures.filter((f) => f.includes("MS-fixture-old-implemented")).length, 0)
})

test("Given related_tests entries When missing, glob, or sentinel Then only real paths pass", (t) => {
  const root = makeFixture(t, {
    specs: {
      "missing-test.md": specSource({
        spec_id: "MS-fixture-missing-test",
        related_tests: ["tests/unit/does-not-exist.test.mjs"],
      }),
      "glob-test.md": specSource({
        spec_id: "MS-fixture-glob-test",
        related_tests: ["tests/unit/*.test.mjs"],
      }),
      "draft-missing.md": specSource({
        spec_id: "MS-fixture-draft-missing",
        status: "draft",
        related_tests: ["tests/unit/does-not-exist.test.mjs"],
      }),
      "real-test.md": specSource({
        spec_id: "MS-fixture-real-test",
        related_tests: ["tests/unit/real.test.mjs"],
      }),
    },
    extraFiles: { "tests/unit/real.test.mjs": "// present\n" },
  })

  const { failures } = run(root)
  assert.ok(failures.some((f) => f.includes("MS-fixture-missing-test".replace("MS-fixture-", "missing-test")) || f.includes("missing-test.md")))
  assert.ok(failures.some((f) => f.includes("glob-test.md") && f.includes("is a glob")))
  assert.equal(failures.filter((f) => f.includes("draft-missing.md")).length, 0)
  assert.equal(failures.filter((f) => f.includes("real-test.md")).length, 0)
})

test("Given implementation surfaces outside the spec's own radius Then validation fails", (t) => {
  const root = makeFixture(t, {
    specs: {
      "escaping.md": specSource({
        spec_id: "MS-fixture-escaping",
        allowed_blast_radius: ["lib/**"],
        implementation_surfaces: ["lib/x.ts", "supabase/migrations/001.sql"],
      }),
    },
  })

  const { failures } = run(root)
  assert.ok(
    failures.some((f) => f.includes('surface "supabase/migrations/001.sql" is outside'))
  )
})

test("Given a radius pattern with whitespace Then validation fails", (t) => {
  const root = makeFixture(t, {
    specs: {
      "junk.md": specSource({
        spec_id: "MS-fixture-junk",
        allowed_blast_radius: ["scripts/** (tooling only)"],
      }),
    },
  })

  const { failures } = run(root)
  assert.ok(failures.some((f) => f.includes("contains whitespace")))
})

test("Given CI and README gate lists When they drift Then both directions fail", (t) => {
  const readme = [
    "# Governance",
    "",
    "## Current Verification Gates",
    "",
    "- pnpm governance:check",
    "- pnpm test",
    "- pnpm lint",
    "",
  ].join("\n")
  const workflow = [
    "name: CI",
    "jobs:",
    "  build:",
    "    steps:",
    "      - run: pnpm install",
    "      - run: |",
    "          pnpm governance:check",
    "          pnpm typecheck",
    "      - run: pnpm test",
    "",
  ].join("\n")

  const root = makeFixture(t, {
    specs: { "example.md": specSource() },
    extraFiles: {
      "micro-specs/README.md": readme,
      ".github/workflows/ci.yml": workflow,
    },
  })

  const { failures } = run(root)
  // CI runs typecheck (inside the run:| block) but the README omits it.
  assert.ok(failures.some((f) => f.includes('omits CI command "pnpm typecheck"')))
  // The README lists lint but CI never runs it.
  assert.ok(failures.some((f) => f.includes('lists "pnpm lint" but no CI workflow runs it')))
  // Setup commands are filtered symmetrically and never counted.
  assert.equal(failures.filter((f) => f.includes("pnpm install")).length, 0)
})

test("Given a declared Playwright project When the config does not define it Then validation fails", (t) => {
  const root = makeFixture(t, {
    specs: {
      "browser.md": specSource({
        spec_id: "MS-fixture-browser",
        required_playwright_projects: ["chromium", "made-up-project"],
      }),
    },
    extraFiles: {
      "playwright.config.ts": 'export default { projects: [{ name: "chromium" }] }\n',
    },
  })

  const { failures } = run(root)
  assert.ok(failures.some((f) => f.includes('unknown Playwright project "made-up-project"')))
  assert.equal(failures.filter((f) => f.includes('"chromium"')).length, 0)
})

test("Given a billing spec without durable proof When the repo has test:db Then validation fails", (t) => {
  const root = makeFixture(t, {
    scripts: { ...DEFAULT_SCRIPTS, build: "node --version", "test:db": "node --version" },
    specs: {
      "billing.md": specSource({
        spec_id: "MS-fixture-billing",
        risk_class: "billing",
        verification_gates: [
          "pnpm governance:check",
          "pnpm test",
          "pnpm lint",
          "pnpm typecheck",
          "pnpm build",
        ],
      }),
    },
  })

  const { failures } = run(root)
  assert.ok(failures.some((f) => f.includes("durable-proof gate")))
})

test("Given active browser gates When broad, scoped, waived, or already shipped Then only the grep-less active gate fails", (t) => {
  const browserSpec = (id, gate, overrides = {}) =>
    specSource({
      spec_id: id,
      verification_gates: ["pnpm governance:check", "pnpm test", "pnpm lint", "pnpm typecheck", gate],
      required_playwright_projects: ["chromium"],
      related_tests: ["tests/e2e/example.spec.ts"],
      ...overrides,
    })
  const root = makeFixture(t, {
    scripts: { ...DEFAULT_SCRIPTS, "test:e2e": "node --version" },
    specs: {
      "broad.md": browserSpec("MS-fixture-broad", "pnpm test:e2e"),
      "scoped.md": browserSpec(
        "MS-fixture-scoped",
        'pnpm test:e2e -- --project=chromium --grep "@some-tag"'
      ),
      "waived.md": browserSpec("MS-fixture-waived", "pnpm test:e2e", {
        approved_exceptions: [
          "broad-browser-gate: this spec changes global browser behavior (expires: 2026-12-31)",
        ],
      }),
      "shipped.md": browserSpec("MS-fixture-shipped", "pnpm test:e2e", { status: "implemented" }),
    },
    extraFiles: {
      "tests/e2e/example.spec.ts": 'test("@some-tag fixture", () => {})\n',
      "playwright.config.ts": 'export default { projects: [{ name: "chromium" }] }\n',
    },
  })

  const { failures } = run(root)
  const broad = failures.find(
    (f) => f.includes("MS-fixture-broad") && f.includes('broad browser gate "pnpm test:e2e"')
  )
  assert.ok(broad, `expected the grep-less active gate to fail, got ${JSON.stringify(failures)}`)
  assert.match(broad, /--grep/)
  assert.match(broad, /broad-browser-gate/)
  assert.equal(failures.filter((f) => f.includes("MS-fixture-scoped")).length, 0)
  assert.equal(failures.filter((f) => f.includes("MS-fixture-waived")).length, 0)
  assert.equal(
    failures.filter((f) => f.includes("MS-fixture-shipped") || f.includes("shipped.md")).length,
    0,
    "the scoped-gate rule applies to active specs only"
  )
})

test("Given non-browser gates without --grep When validated Then they are not rejected as broad", (t) => {
  const root = makeFixture(t, { specs: { "example.md": specSource() } })

  assert.equal(
    run(root).failures.filter((f) => f.includes("broad browser gate")).length,
    0
  )
})

test("Given an active spec When its radius claims too many broad roots Then breadth fails unless waived", (t) => {
  const root = makeFixture(t, {
    specs: {
      "broad.md": specSource({
        spec_id: "MS-fixture-broad-radius",
        allowed_blast_radius: ["app/**", "lib/**", "docs/adr/**"],
        implementation_surfaces: ["lib/x.ts"],
      }),
      "waived.md": specSource({
        spec_id: "MS-fixture-waived-radius",
        allowed_blast_radius: ["app/**", "lib/**"],
        implementation_surfaces: ["lib/x.ts"],
        approved_exceptions: [
          "broad-blast-radius: repo-wide sweep is the point of this spec (expires: 2026-12-31)",
        ],
      }),
      "shipped.md": specSource({
        spec_id: "MS-fixture-shipped-radius",
        status: "implemented",
        allowed_blast_radius: ["app/**", "lib/**"],
        implementation_surfaces: ["lib/x.ts"],
      }),
      "scoped.md": specSource({ spec_id: "MS-fixture-scoped-radius" }),
    },
  })

  const { failures } = run(root)
  const breadth = failures.find(
    (f) => f.includes("MS-fixture-broad-radius") && f.includes("broad radius roots")
  )
  assert.ok(breadth, `expected a radius-breadth failure, got ${JSON.stringify(failures)}`)
  assert.match(breadth, /app\/\*\*, lib\/\*\*/)
  assert.ok(!breadth.includes("docs/adr/**"), "scoped subpaths never count as broad roots")
  assert.match(breadth, /broad-blast-radius/)
  assert.equal(failures.filter((f) => f.includes("MS-fixture-waived-radius")).length, 0)
  assert.equal(
    failures.filter((f) => f.includes("MS-fixture-shipped-radius") || f.includes("shipped.md")).length,
    0,
    "the breadth lint applies to active specs only"
  )
  assert.equal(failures.filter((f) => f.includes("MS-fixture-scoped-radius")).length, 0)
})

test("Given scoped browser gates When the grep tag hits, misses, or cannot compile Then only the bad gates fail", (t) => {
  const gateSpec = (id, gate) =>
    specSource({
      spec_id: id,
      verification_gates: ["pnpm governance:check", "pnpm test", "pnpm lint", "pnpm typecheck", gate],
      required_playwright_projects: ["chromium"],
      related_tests: ["tests/e2e/example.spec.ts"],
    })
  const root = makeFixture(t, {
    scripts: { ...DEFAULT_SCRIPTS, "test:e2e": "node --version" },
    specs: {
      "hit.md": gateSpec("MS-fixture-grep-hit", 'pnpm test:e2e -- --grep "@my-tag"'),
      "miss.md": gateSpec("MS-fixture-grep-miss", 'pnpm test:e2e -- --grep "@other-tag"'),
      "invalid.md": gateSpec("MS-fixture-grep-invalid", 'pnpm test:e2e -- --grep "(["'),
    },
    extraFiles: {
      "tests/e2e/example.spec.ts": 'test("@my-tag fixture", () => {})\n',
      "playwright.config.ts": 'export default { projects: [{ name: "chromium" }] }\n',
    },
  })

  const { failures } = run(root)
  assert.equal(failures.filter((f) => f.includes("MS-fixture-grep-hit")).length, 0)
  assert.ok(
    failures.some(
      (f) => f.includes("MS-fixture-grep-miss") && f.includes("matches none of the spec's related browser tests")
    ),
    `expected a grep-miss failure, got ${JSON.stringify(failures)}`
  )
  assert.ok(
    failures.some(
      (f) => f.includes("MS-fixture-grep-invalid") && f.includes("not a valid regular expression")
    )
  )
})

test("Given gates with shell metacharacters When validated Then they are rejected", (t) => {
  const root = makeFixture(t, {
    specs: {
      "unsafe.md": specSource({
        spec_id: "MS-fixture-unsafe",
        verification_gates: [
          "pnpm governance:check",
          "pnpm test",
          "pnpm lint",
          "pnpm typecheck",
          "pnpm test -- --grep x; rm -rf /",
        ],
      }),
    },
  })

  const { failures } = run(root)
  assert.ok(failures.some((f) => f.includes("unknown or unsafe gate")))
})

test("Given closed specs When their records conform or rot Then the closed-record contract is enforced", (t) => {
  const root = makeFixture(t, {
    specs: {
      "closed-good.md": specSource(
        { spec_id: "MS-fixture-closed-good", status: "closed", related_tests: ["tests/unit/real.test.mjs"] },
        closedRecordBody()
      ),
      "closed-plan.md": specSource(
        { spec_id: "MS-fixture-closed-plan", status: "closed", related_tests: ["tests/unit/real.test.mjs"] },
        [...closedRecordBody(), "## 2. Blast Radius", ""]
      ),
      "closed-stale.md": specSource(
        { spec_id: "MS-fixture-closed-stale", status: "closed", related_tests: ["tests/unit/real.test.mjs"] },
        closedRecordBody("tests/unit/renamed-away.test.mjs")
      ),
      "closed-bare.md": specSource(
        { spec_id: "MS-fixture-closed-bare", status: "closed", related_tests: ["tests/unit/real.test.mjs"] },
        ["## Why It Exists", "", "Only one heading survived.", ""]
      ),
      "closed-sentinel.md": specSource(
        { spec_id: "MS-fixture-closed-sentinel", status: "closed" },
        closedRecordBody()
      ),
    },
    extraFiles: { "tests/unit/real.test.mjs": "// present\n" },
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
        f.includes('"tests/unit/renamed-away.test.mjs" does not resolve')
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

test("Given evidence staleness When surfaces changed after the proving run Then only the stale spec fails and exemption clears it", (t) => {
  const implemented = (id) =>
    specSource({ spec_id: id, status: "implemented", implementation_surfaces: ["lib/x.ts"] })
  const ledger = (id, sha) => `${JSON.stringify({ spec_id: id, runs: [{ git_sha: sha }] })}\n`
  const root = makeFixture(t, {
    specs: {
      "stale.md": implemented("MS-fixture-stale"),
      "clean.md": implemented("MS-fixture-clean"),
      "unknowable.md": implemented("MS-fixture-unknowable"),
    },
    extraFiles: {
      "micro-specs/evidence/MS-fixture-stale.json": ledger("MS-fixture-stale", "sha-stale"),
      "micro-specs/evidence/MS-fixture-clean.json": ledger("MS-fixture-clean", "sha-clean"),
      "micro-specs/evidence/MS-fixture-unknowable.json": ledger("MS-fixture-unknowable", "sha-gone"),
    },
  })
  const changedFilesSince = (dir, sha) => {
    if (sha === "sha-stale") return ["lib/x.ts", "docs/unrelated.md"]
    if (sha === "sha-clean") return ["docs/unrelated.md"]
    return null
  }

  const { failures } = run(root, { changedFilesSince })
  const stale = failures.find(
    (f) => f.includes("MS-fixture-stale") && f.includes("changed after the proving run")
  )
  assert.ok(stale, `expected a staleness failure, got ${JSON.stringify(failures)}`)
  assert.match(stale, /lib\/x\.ts/)
  assert.match(stale, /governance:run-gates --spec MS-fixture-stale --record/)
  assert.equal(failures.filter((f) => f.includes("MS-fixture-clean")).length, 0)
  assert.equal(failures.filter((f) => f.includes("MS-fixture-unknowable")).length, 0)

  // A re-proving run (runner/lifecycle CLI) exempts staleness wholesale so
  // the cure is never blocked by the disease.
  const exempted = run(root, { changedFilesSince, env: { GOVERNANCE_STALENESS_EXEMPT: "*" } })
  assert.equal(
    exempted.failures.filter((f) => f.includes("changed after the proving run")).length,
    0
  )
})

test("Given a spec with broken frontmatter When validated Then parse errors surface once", (t) => {
  const root = makeFixture(t, {
    specs: {
      "broken.md": [
        "---",
        "spec_id: MS-fixture-broken",
        "status: active",
        "evidence_required:",
        "  - a wrapped entry that",
        "    continues on the next line",
        "---",
        "# Broken",
        "",
      ].join("\n"),
      "example.md": specSource(),
    },
  })

  const { failures } = run(root)
  assert.ok(
    failures.some((f) => f.includes("broken.md:6") && f.includes("continuation lines")),
    `expected file:line parse failure, got ${JSON.stringify(failures)}`
  )
  // Parse failures suppress cascading metadata noise for that spec.
  assert.equal(failures.filter((f) => f.includes("broken.md is missing metadata field")).length, 0)
})
