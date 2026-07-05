import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { validateGovernance } from "../../scripts/governance-rules.mjs"

const scriptsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../scripts")
const newSpecCli = path.join(scriptsDir, "new-spec.mjs")

function makeRepo(t, { scripts } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "new-spec-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))

  writeFileSync(
    path.join(root, "package.json"),
    `${JSON.stringify(
      {
        name: "fixture",
        type: "module",
        packageManager: "pnpm@10.0.0",
        scripts: scripts ?? {
          "governance:check": "node scripts/check-governance.mjs",
          test: "node --test tests/micro-specs/*.test.mjs",
          "test:coverage": "node --version",
          lint: "node --version",
          typecheck: "node --version",
          build: "node --version",
        },
      },
      null,
      2
    )}\n`
  )
  mkdirSync(path.join(root, "micro-specs"), { recursive: true })
  return root
}

function runCli(root, args) {
  try {
    const stdout = execFileSync("node", [newSpecCli, ...args], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
    return { status: 0, stdout, stderr: "" }
  } catch (error) {
    return {
      status: error.status ?? 1,
      stdout: error.stdout?.toString() ?? "",
      stderr: error.stderr?.toString() ?? "",
    }
  }
}

test("Given valid intake args When scaffolding Then a floor-satisfying draft lands at the derived path", (t) => {
  const root = makeRepo(t)

  const result = runCli(root, ["--id", "MS-billing-refunds", "--risk", "docs-tooling", "--title", "Refund flow"])
  assert.equal(result.status, 0, result.stderr)

  const file = path.join(root, "micro-specs/billing/refunds.md")
  assert.equal(existsSync(file), true, "spec lands at micro-specs/<area>/<slug>.md")

  const source = readFileSync(file, "utf8")
  assert.match(source, /^status: draft$/m)
  assert.match(source, /^spec_id: MS-billing-refunds$/m)
  for (const heading of [
    "## 1. Exact Goal and User-Visible Outcomes",
    "## 2. Blast Radius",
    "## 3. Strict Constraints and Assumptions",
    "## 4. Decisions Already Made",
    "## 5. Behavioral Requirements (EARS)",
    "## 6. Verification Criteria and Task Breakdown",
  ]) {
    assert.ok(source.includes(heading), `missing heading: ${heading}`)
  }
  for (const gate of ["pnpm governance:check", "pnpm test", "pnpm lint", "pnpm typecheck"]) {
    assert.ok(source.includes(`  - ${gate}`), `missing floor gate: ${gate}`)
  }

  // The scaffold must validate under the engine that will police it.
  const validation = validateGovernance(root, { enforceChangedFiles: false })
  assert.deepEqual(validation.failures, [])
})

test("Given a duplicate spec_id When scaffolding Then the CLI refuses and names the owner file", (t) => {
  const root = makeRepo(t)
  runCli(root, ["--id", "MS-billing-refunds", "--risk", "docs-tooling", "--title", "First"])

  const result = runCli(root, [
    "--id",
    "MS-billing-refunds",
    "--risk",
    "docs-tooling",
    "--title",
    "Second",
    "--out",
    "micro-specs/billing/other.md",
  ])

  assert.equal(result.status, 1)
  assert.match(result.stderr, /duplicate spec_id "MS-billing-refunds"/)
  assert.match(result.stderr, /micro-specs\/billing\/refunds\.md/)
})

test("Given bad intake args When scaffolding Then usage errors exit 2", (t) => {
  const root = makeRepo(t)

  const badRisk = runCli(root, ["--id", "MS-a-b", "--risk", "made-up", "--title", "x"])
  assert.equal(badRisk.status, 2)
  assert.match(badRisk.stderr, /--risk must be one of/)

  const badId = runCli(root, ["--id", "MSA", "--risk", "docs-tooling", "--title", "x"])
  assert.equal(badId.status, 2)
  assert.match(badId.stderr, /--id must match/)

  const noTitle = runCli(root, ["--id", "MS-a-b", "--risk", "docs-tooling"])
  assert.equal(noTitle.status, 2)
  assert.match(noTitle.stderr, /--title is required/)

  const badFlag = runCli(root, ["--id", "MS-a-b", "--risk", "docs-tooling", "--title", "x", "--wat"])
  assert.equal(badFlag.status, 2)
  assert.match(badFlag.stderr, /unknown flag/)
})

test("Given --dry-run When scaffolding Then the spec prints to stdout and nothing is written", (t) => {
  const root = makeRepo(t)

  const result = runCli(root, [
    "--id",
    "MS-billing-refunds",
    "--risk",
    "docs-tooling",
    "--title",
    "Refund flow",
    "--dry-run",
  ])

  assert.equal(result.status, 0)
  assert.match(result.stdout, /^---\nspec_id: MS-billing-refunds/m)
  assert.equal(existsSync(path.join(root, "micro-specs/billing/refunds.md")), false)
})

test("Given a durable-proof class When the repo lacks a proof script Then a dated exception placeholder is emitted", (t) => {
  const withProof = makeRepo(t, {
    scripts: {
      "governance:check": "node scripts/check-governance.mjs",
      test: "node --test tests/micro-specs/*.test.mjs",
      "test:coverage": "node --version",
      lint: "node --version",
      typecheck: "node --version",
      build: "node --version",
      "test:db": "node --version",
      "test:e2e": "node --version",
    },
  })
  runCli(withProof, ["--id", "MS-billing-charge", "--risk", "billing", "--title", "Charge"])
  const proofSource = readFileSync(path.join(withProof, "micro-specs/billing/charge.md"), "utf8")
  assert.match(proofSource, /- pnpm test:db/)
  assert.match(proofSource, /^approved_exceptions: \[\]$/m)

  // No durable-proof script at all (neither test:db nor test:e2e), so the
  // placeholder must appear regardless of how a fork tunes DURABLE_PROOF_SCRIPTS.
  const withoutProof = makeRepo(t, {
    scripts: {
      "governance:check": "node scripts/check-governance.mjs",
      test: "node --test tests/micro-specs/*.test.mjs",
      "test:coverage": "node --version",
      lint: "node --version",
      typecheck: "node --version",
      build: "node --version",
    },
  })
  const result = runCli(withoutProof, ["--id", "MS-billing-charge", "--risk", "billing", "--title", "Charge"])
  assert.equal(result.status, 0, result.stderr)
  const source = readFileSync(path.join(withoutProof, "micro-specs/billing/charge.md"), "utf8")
  assert.match(
    source,
    /durable-proof harness not present at scaffold time \(expires: \d{4}-\d{2}-\d{2}\)/
  )
})
