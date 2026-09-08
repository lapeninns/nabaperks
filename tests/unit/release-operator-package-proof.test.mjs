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
import { join } from "node:path"
import { test } from "node:test"
import { isOperatorPackageComparison } from "../../scripts/release/operator-package-proof.mjs"
import {
  sourceIdentity,
  requiresCompatibility,
  qualifyRelease,
  verifyLedger,
  verifySourceComparison,
} from "../../scripts/release/stage-ledger.mjs"
const baseline = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8")
)
const candidate = structuredClone(baseline)
candidate.scripts["test:unit"] =
  "node scripts/ci/node-test-runner.mjs --test tests/unit/*.test.mjs"
candidate.scripts["ops:factory:status"] =
  "node scripts/ci/factory-status.mjs --json"
const comparison = (before = baseline, after = candidate) => ({
  schema: "nabaperks.operator-package-comparison.v1",
  baseline: JSON.stringify(before),
  candidate: JSON.stringify(after),
})

test("only enumerated operator scripts qualify with unchanged audited production entry points", () => {
  const proof = comparison()
  assert.equal(isOperatorPackageComparison(proof), true)
  assert.deepEqual(requiresCompatibility(["package.json"], proof), [])
  assert.deepEqual(requiresCompatibility(["package.json"]), ["package.json"])
  for (const path of [
    "pnpm-lock.yaml",
    "scripts/build.mjs",
    "app/page.tsx",
    "supabase/migrations/new.sql",
    "ops/factory/new-unreviewed.mjs",
  ])
    assert.deepEqual(requiresCompatibility([path], proof), [path])
})

test("dependency, runtime script, hook and package-manager changes remain compatibility gated", () => {
  const changes = [
    (p) => (p.dependencies.next = "0.0.0"),
    (p) => (p.devDependencies.typescript = "0.0.0"),
    (p) => (p.engines.node = ">=99"),
    (p) => (p.scripts.build = "next build"),
    (p) => (p.scripts.start = "node malicious.mjs"),
    (p) => (p.scripts["secrets:check"] = "pnpm test:unit"),
    (p) => (p.scripts.postinstall = "pnpm test:unit"),
    (p) => (p.scripts["test:e2e"] = "true"),
    (p) => (p.pnpm = { overrides: { next: "0.0.0" } }),
    (p) => (p.packageManager = "pnpm@0.0.0"),
    (p) => (p.name = "another-app"),
  ]
  for (const change of changes) {
    const altered = structuredClone(candidate)
    change(altered)
    assert.equal(
      isOperatorPackageComparison(comparison(baseline, altered)),
      false
    )
  }
  // Even an unchanged pre-existing hook cannot make a test script a build input.
  const before = structuredClone(baseline),
    after = structuredClone(candidate)
  before.scripts.prebuild = after.scripts.prebuild = "pnpm test:unit"
  assert.equal(isOperatorPackageComparison(comparison(before, after)), false)
  for (const invalid of [
    null,
    {},
    { ...comparison(), candidate: "{" },
    { ...comparison(), candidate: "[]" },
    { ...comparison(), extra: true },
  ])
    assert.equal(isOperatorPackageComparison(invalid), false)
})

test("exact Git package blobs are carried through qualification and reread at later stages", () => {
  const root = mkdtempSync(join(tmpdir(), "release-operator-proof-"))
  try {
    const git = (...args) =>
      execFileSync("git", args, {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim()
    git("init")
    git("config", "user.name", "Fixture")
    git("config", "user.email", "fixture@example.invalid")
    mkdirSync(join(root, "supabase/migrations"), { recursive: true })
    writeFileSync(
      join(root, "supabase/migrations/20260101000000_fixture.sql"),
      "select 1;\n"
    )
    writeFileSync(join(root, "package.json"), JSON.stringify(baseline))
    git("add", ".")
    git("commit", "-m", "baseline")
    const base = git("rev-parse", "HEAD")
    writeFileSync(join(root, "package.json"), JSON.stringify(candidate))
    git("add", "package.json")
    git("commit", "-m", "operator commands")
    const options = {
      cwd: root,
      revision: git("rev-parse", "HEAD"),
      baselineRevision: base,
      runId: "42",
      attempt: 1,
    }
    const source = sourceIdentity(options)
    assert.deepEqual(source.packageComparison, comparison())
    const { ledger, evidenceBytes } = qualifyRelease(source)
    verifyLedger(ledger, source.identity, "qualified", evidenceBytes)
    verifySourceComparison(ledger, sourceIdentity(options))
    const forgedSource = {
      ...source,
      packageComparison: comparison(baseline, baseline),
    }
    assert.throws(
      () => verifySourceComparison(ledger, forgedSource),
      /exact Git blobs/
    )
    const runtime = structuredClone(candidate)
    runtime.dependencies.next = "0.0.0"
    writeFileSync(join(root, "package.json"), JSON.stringify(runtime))
    git("add", "package.json")
    git("commit", "-m", "runtime dependency")
    const changed = sourceIdentity({
      ...options,
      revision: git("rev-parse", "HEAD"),
    })
    assert.throws(() => qualifyRelease(changed), /full populated/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
