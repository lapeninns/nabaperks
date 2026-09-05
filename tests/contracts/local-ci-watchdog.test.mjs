import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

test("watchdog is separately activated with read-only observation and isolated incident writes", () => {
  const read = (path) => readFileSync(path, "utf8")
  const workflow = read(".github/workflows/agent-watchdog.yml")
  const contract = JSON.parse(read("config/local-ci-contract.json"))
  assert.equal(contract.agentLiveness.gating, false)
  assert.ok(
    read("ops/local-ci/host/com.nabaperks.local-ci.plist").includes(
      `<string>${contract.agent.launchdLabel}</string>`
    )
  )
  assert.ok(
    read("ops/local-ci/host/install.sh").includes(
      `LABEL="${contract.agent.launchdLabel}"`
    )
  )
  assert.equal(
    contract.agentLiveness.maxAgeMinutes,
    contract.agent.heartbeatIntervalMinutes + 15
  )
  assert.match(workflow, /vars\.LOCAL_CI_WATCHDOG_ENABLED == 'true'/)
  assert.match(workflow, /checks: read/)
  assert.doesNotMatch(workflow, /checks: write|actions: write|pull_request/)
  const observerJobs = workflow.slice(0, workflow.indexOf("  alerts:"))
  assert.doesNotMatch(observerJobs, /issues: write/)
  assert.match(workflow, /issues: write/)
  assert.equal((workflow.match(/continue-on-error: true/g) ?? []).length, 2)
  assert.match(workflow, /steps\.observe\.outcome == 'success'/)
  assert.match(workflow, /needs\.heartbeat\.result == 'success'/)
  assert.equal(contract.agentLiveness.notificationAssignee, "lapeninns")
  assert.doesNotMatch(
    read(".github/workflows/ci.yml"),
    /agent-watchdog|heartbeat freshness/
  )
  assert.match(workflow, /node scripts\/check-agent-liveness\.mjs/)
  assert.match(
    read("ops/local-ci/host/install.sh"),
    /release_sha}:config\/local-ci-contract\.json/
  )
})
