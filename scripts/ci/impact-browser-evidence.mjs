import assert from "node:assert/strict"
import { testIdentity } from "./browser-parity.mjs"

// Keep the original envelope for the immutable bootstrap verifier. Reviewed
// base comparisons also require browserConfiguration, which captures resolved
// use options that Playwright's ordinary JSON project projection omits.
export function browserPolicy(report) {
  const config = report?.config
  assert.equal(config?.workers, 1, "One browser worker is required")
  assert.equal(config.forbidOnly, true)
  assert.equal(config.failOnFlakyTests, true)
  assert.equal(config.webServer?.reuseExistingServer, false)
  assert.ok(typeof config.version === "string" && config.version.length > 0)
  assert.ok(Array.isArray(config.projects) && config.projects.length === 4)
  for (const project of config.projects) {
    assert.equal(project.retries, 1)
    assert.equal(project.repeatEach, 1)
  }
  return {
    version: config.version,
    workers: config.workers,
    forbidOnly: config.forbidOnly,
    failOnFlakyTests: config.failOnFlakyTests,
    webServerCommand: config.webServer.command,
    updateSnapshots: config.updateSnapshots,
    projects: config.projects.map(
      ({ name, retries, repeatEach, timeout, testMatch, testIgnore }) => ({
        name,
        retries,
        repeatEach,
        timeout,
        testMatch,
        testIgnore,
      })
    ),
  }
}

export function compareAffectedOutcomes(full, targeted) {
  const fullById = new Map()
  for (const record of full) {
    const id = testIdentity(record)
    assert.ok(!fullById.has(id), "Full tier contains duplicate test identities")
    fullById.set(id, record)
  }
  const seen = new Set()
  assert.ok(targeted.length > 0, "An empty targeted tier cannot qualify")
  for (const record of targeted) {
    const id = testIdentity(record)
    assert.ok(!seen.has(id), "Targeted tier repeats a test identity")
    seen.add(id)
    const baseline = fullById.get(id)
    assert.ok(baseline, "Targeted test is absent from the full execution")
    for (const actual of [baseline, record]) {
      assert.equal(
        actual.status,
        "passed",
        "Required page checks must execute and pass"
      )
      assert.equal(actual.retries, 0)
      assert.equal(actual.flaky, false)
      assert.equal(actual.skipReason, "")
    }
  }
  return { matched: seen.size, missing: 0, differentOutcomes: 0 }
}
