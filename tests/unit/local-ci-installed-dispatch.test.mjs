import assert from "node:assert/strict"
import { test } from "node:test"
import { assertInstalledExecutionCurrent } from "../../ops/local-ci/agent/installed-revision.mjs"
import { dispatchRun } from "../../ops/local-ci/agent/main.mjs"

const contract = { agent: { installRoot: "/install/current" } }
const request = { contract, logger: { info() {} } }
const dependencies = (report) => ({
  realpath: () => "/install/releases/reviewed",
  inspect: () => report,
})

test("only matching or informational installed source drift permits dispatch preflight", () => {
  for (const status of ["matched", "informational-drift"]) {
    const report = { status, exitCode: 0 }
    assert.equal(
      assertInstalledExecutionCurrent(request, dependencies(report)),
      report
    )
  }
  for (const status of [
    "execution-surface-drift",
    "image-source-drift",
    "unreviewed-install",
    "install-unavailable",
    "unknown",
  ]) {
    // Even an erroneous zero exit cannot override the semantic refusal.
    for (const exitCode of [0, 3]) {
      assert.throws(
        () =>
          assertInstalledExecutionCurrent(
            request,
            dependencies({ status, exitCode, summary: status })
          ),
        { code: "INSTALLED_EXECUTION_DRIFT" }
      )
    }
  }
})

test("a candidate agent cannot borrow a passing installed controller check", () => {
  assert.throws(
    () =>
      assertInstalledExecutionCurrent(request, {
        executingRoot: "/candidate",
        realpath: (path) => path,
        inspect: () =>
          assert.fail("a candidate must be refused before inspection"),
      }),
    { code: "INSTALLED_EXECUTION_UNAVAILABLE" }
  )
})

test("unavailable provider or local reference evidence fails closed", () => {
  assert.throws(
    () =>
      assertInstalledExecutionCurrent(request, {
        ...dependencies(null),
        inspect: () => {
          throw new Error("provider unavailable")
        },
      }),
    /provider unavailable; dispatch and qualification blocked/
  )
})

test("installed drift blocks every shared dispatch before VM work, recovery or evidence creation", async () => {
  for (const profile of ["pr", "main", "nightly"]) {
    const error = new Error("execution-surface-drift")
    await assert.rejects(
      dispatchRun(
        {
          ...request,
          config: {},
          profile: { profile },
          evidence: {
            open: () => assert.fail("drift must not open execution evidence"),
          },
        },
        {
          assertInstalledExecutionCurrent: () => {
            throw error
          },
          assertVmIsolationLive: () => assert.fail("drift must not touch VM"),
          reconcileOwnedResources: () =>
            assert.fail("drift must not remove resources"),
          buildDependencies: () =>
            assert.fail("drift must not prepare candidate code"),
        }
      ),
      (actual) => actual === error
    )
  }
})
