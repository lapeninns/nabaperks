import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { compareBrowserComposition } from "../../scripts/ci/check-browser-composition.mjs"
import { browserArguments } from "../../scripts/ci/browser-workload.mjs"
import { snapshotGuardViolations } from "../../ops/local-ci/core/profiles.mjs"

const projects = [
  "chromium",
  "mobile-safari",
  "desktop-firefox",
  "desktop-safari",
]
const entries = projects.map((project) => ({
  project,
  file: "journey.spec.ts",
  title: ["journey @a11y"],
}))
const functional = projects.map((project) => ({
  project,
  file: "function.spec.ts",
  title: ["functional journey"],
}))
const beforeE2e = [...entries, ...functional]
const beforeA11y = entries.slice(0, 2)

test("moving accessibility requires both halves or loses coverage/retains duplicate execution", () => {
  const complete = compareBrowserComposition(
    beforeE2e,
    beforeA11y,
    functional,
    entries
  )
  assert.equal(complete.equivalent, true)
  assert.equal(complete.duplicatesBefore, 2)
  assert.equal(complete.duplicatesAfter, 0)
  const missing = compareBrowserComposition(
    beforeE2e,
    beforeA11y,
    functional,
    beforeA11y
  )
  assert.equal(missing.equivalent, false)
  assert.equal(missing.missing.length, 2)
  const duplicated = compareBrowserComposition(
    beforeE2e,
    beforeA11y,
    beforeE2e,
    entries
  )
  assert.equal(duplicated.equivalent, false)
  assert.equal(duplicated.duplicatesAfter, 4)
})

test("both execution planes preserve all four a11y projects and exclude a11y from the E2E tier", () => {
  for (const plane of ["local", "hosted"])
    for (const project of projects) {
      const e2e = browserArguments({
        plane,
        suite: "test:e2e",
        project,
        shard: "1/32",
      })
      assert.equal(e2e[e2e.indexOf("--grep-invert") + 1], "@visual|@a11y")
      const a11y = browserArguments({
        plane,
        suite: "test:a11y",
        project,
        shard: plane === "local" ? "1/8" : "1/4",
      })
      assert.equal(a11y[a11y.indexOf("--grep") + 1], "@a11y")
    }
  const workflow = readFileSync(
    new URL("../../.github/workflows/ci.yml", import.meta.url),
    "utf8"
  )
  const a11y = workflow.slice(
    workflow.indexOf("  a11y:\n"),
    workflow.indexOf("  a11y-gate:\n")
  )
  assert.match(
    a11y,
    /project: \[chromium, mobile-safari, desktop-firefox, desktop-safari\]/
  )
})

test("quoted composition patterns preserve the visual guard and repeated overrides fail closed", () => {
  const contract = {
    snapshotGuard: { enabled: true, forbiddenCommandSubstrings: [] },
  }
  const check = (flags) =>
    snapshotGuardViolations(
      {
        profile: "pr",
        lanes: [
          {
            id: "e2e-chromium",
            commands: [`pnpm test:e2e ${flags} --ignore-snapshots`],
          },
        ],
      },
      contract
    )
  assert.deepEqual(check('--grep-invert "@visual|@a11y"'), [])
  assert.ok(check('--grep-invert "@a11y"').length)
  assert.ok(check("--grep-invert @visual --grep-invert @a11y").length)
  assert.ok(check('--grep-invert "@visual-only"').length)
})
