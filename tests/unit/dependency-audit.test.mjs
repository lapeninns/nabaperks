import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import {
  applyExceptions,
  classifyAudit,
  parseExceptions,
  productionReachability,
  runDependencyAudit,
} from "../../scripts/ci/dependency-audit.mjs"

const zero = { info: 0, low: 0, moderate: 0, high: 0, critical: 0 }
const report = (vulnerabilities, advisories = {}) =>
  JSON.stringify({
    actions: [],
    advisories,
    muted: [],
    metadata: { vulnerabilities, dependencies: 1437 },
  })

test("a clean full-inventory report is clean", () => {
  assert.deepEqual(classifyAudit({ status: 0, stdout: report(zero) }), {
    state: "clean",
    counts: { critical: 0, high: 0, moderate: 0, low: 0, info: 0 },
    dependencies: 1437,
    advisories: [],
  })
})

test("a new advisory with no lockfile change is reported as findings", () => {
  const verdict = classifyAudit({
    status: 1,
    stdout: report(
      { ...zero, high: 1 },
      {
        1: {
          github_advisory_id: "GHSA-xxxx-yyyy-zzzz",
          module_name: "brace-expansion",
          severity: "high",
          title: "ReDoS",
          url: "https://github.com/advisories/GHSA-xxxx-yyyy-zzzz",
        },
      }
    ),
  })
  assert.equal(verdict.state, "findings")
  assert.equal(verdict.counts.high, 1)
  assert.equal(verdict.advisories[0].module, "brace-expansion")
})

test("an unreachable advisory service is unavailable, never clean", () => {
  // Observed with pnpm 10.28.0: `pnpm audit --json` against an unreachable
  // registry prints an error object instead of a report and exits 1. The
  // verdict must not depend on that status alone.
  const unreachable = JSON.stringify({
    error: { code: "ECONNREFUSED", message: "request failed" },
  })
  for (const status of [0, 1])
    assert.equal(
      classifyAudit({ status, stdout: unreachable }).state,
      "unavailable"
    )
  for (const stdout of ["", "not json", "{}", '{"metadata":{}}'])
    assert.equal(classifyAudit({ status: 0, stdout }).state, "unavailable")
  assert.equal(
    classifyAudit({
      status: 0,
      stdout: report({ ...zero, low: -1 }),
    }).state,
    "unavailable"
  )
  // A failing exit with a zero-count report is not evidence of cleanliness.
  assert.equal(
    classifyAudit({ status: 1, stdout: report(zero) }).state,
    "unavailable"
  )
})

test("a spawn failure is unavailable", () => {
  const verdict = runDependencyAudit({
    spawn: () => ({ error: new Error("spawn pnpm ENOENT") }),
  })
  assert.equal(verdict.state, "unavailable")
})

const braces = {
  id: "GHSA-vfj7-8cjw-p6xm",
  module: "braces",
  severity: "high",
  title: "stack exhaustion",
  url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm",
}
const findings = (advisories, counts = undefined) => ({
  state: "findings",
  counts: counts ?? {
    ...zero,
    ...Object.fromEntries(
      ["critical", "high", "moderate", "low", "info"].map((s) => [
        s,
        advisories.filter((a) => a.severity === s).length,
      ])
    ),
  },
  dependencies: 1399,
  advisories,
})
const exception = {
  advisory: braces.id,
  module: "braces",
  scope: "development",
  owner: "lapeninns",
  approved: "2026-10-03",
  reviewBy: "2026-10-31",
  reason: "No patched release; development tooling only.",
}
const devOnly = () => false

test("a reviewed development-only exception clears only its advisory", () => {
  const verdict = applyExceptions(findings([braces]), {
    exceptions: [exception],
    today: "2026-10-31",
    isProductionReachable: devOnly,
  })
  assert.equal(verdict.state, "excepted")
  assert.deepEqual(verdict.advisories, [])
  assert.equal(verdict.counts.high, 0)
  assert.equal(verdict.excepted[0].reviewBy, "2026-10-31")

  const other = { ...braces, id: "GHSA-2222-3333-4444", module: "qs" }
  const mixed = applyExceptions(findings([braces, other]), {
    exceptions: [exception],
    today: "2026-10-03",
    isProductionReachable: devOnly,
  })
  assert.equal(mixed.state, "findings")
  assert.deepEqual(mixed.advisories, [other])
  assert.equal(mixed.counts.high, 1)
})

test("an exception lapses after review, on production reach or unmatched counts", () => {
  const options = {
    exceptions: [exception],
    today: "2026-10-03",
    isProductionReachable: devOnly,
  }
  const expired = applyExceptions(findings([braces]), {
    ...options,
    today: "2026-11-01",
  })
  assert.equal(expired.state, "findings")
  const reachable = applyExceptions(findings([braces]), {
    ...options,
    isProductionReachable: () => true,
  })
  assert.equal(reachable.state, "findings")
  // pnpm counts a finding the advisory list does not account for.
  const unmatched = applyExceptions(
    findings([braces], { ...zero, high: 2 }),
    options
  )
  assert.equal(unmatched.state, "findings")
  assert.match(unmatched.exceptionsNotApplied, /do not match/)
  const otherModule = applyExceptions(
    findings([{ ...braces, module: "micromatch" }]),
    options
  )
  assert.equal(otherModule.state, "findings")
})

test("an exception must be scoped, attributed and reviewed within 90 days", () => {
  assert.equal(parseExceptions({ exceptions: [exception] }).length, 1)
  for (const invalid of [
    { ...exception, scope: "production" },
    { ...exception, reason: " " },
    { ...exception, advisory: "CVE-2026-93687" },
    { ...exception, reviewBy: "2027-01-02" },
    { ...exception, reviewBy: "2026-10-02" },
    { ...exception, reviewBy: undefined },
  ])
    assert.throws(() => parseExceptions({ exceptions: [invalid] }))
  assert.throws(() => parseExceptions({}))
  assert.doesNotThrow(() =>
    parseExceptions(
      JSON.parse(
        readFileSync("config/dependency-audit-exceptions.json", "utf8")
      )
    )
  )
})

test("an invalid exceptions file makes the audit unavailable", () => {
  let audited = false
  const verdict = runDependencyAudit({
    readExceptions: () => ({ exceptions: [{ ...exception, scope: "all" }] }),
    spawn: () => {
      audited = true
      return { status: 0, stdout: report(zero) }
    },
  })
  assert.equal(verdict.state, "unavailable")
  assert.match(verdict.reason, /^exceptions:/)
  assert.equal(audited, false)
})

test("production reachability fails closed", () => {
  const reach = (result) =>
    productionReachability({ spawn: () => result })("braces")
  const root = { name: "nabaperks", version: "0.0.1", private: true }
  assert.equal(reach({ status: 0, stdout: JSON.stringify([root]) }), false)
  assert.equal(
    reach({
      status: 0,
      stdout: JSON.stringify([{ ...root, dependencies: { next: {} } }]),
    }),
    true
  )
  assert.equal(reach({ status: 1, stdout: JSON.stringify([root]) }), true)
  assert.equal(reach({ status: 0, stdout: "not json" }), true)
  assert.equal(reach({ error: new Error("ENOENT") }), true)
})

test("the audit applies committed exceptions to pnpm's report", () => {
  const advisories = {
    1: {
      github_advisory_id: braces.id,
      module_name: "braces",
      severity: "high",
      title: braces.title,
      url: braces.url,
    },
  }
  const verdict = runDependencyAudit({
    readExceptions: () => ({ exceptions: [exception] }),
    today: "2026-10-03",
    spawn: (_command, args) =>
      args[0] === "why"
        ? { status: 0, stdout: "[{}]" }
        : { status: 1, stdout: report({ ...zero, high: 1 }, advisories) },
  })
  assert.equal(verdict.state, "excepted")
})
