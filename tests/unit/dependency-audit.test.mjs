import assert from "node:assert/strict"
import { test } from "node:test"
import {
  classifyAudit,
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
