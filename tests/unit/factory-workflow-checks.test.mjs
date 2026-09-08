import assert from "node:assert/strict"
import { test } from "node:test"
import { readFileSync } from "node:fs"
import { bindWorkflowChecks } from "../../ops/factory/workflow-checks.mjs"
import { factoryPolicy as policy } from "../../scripts/ci/factory-status.mjs"

const HEAD = "a".repeat(40),
  BASE = "b".repeat(40),
  OLD = "c".repeat(40)
const expected = policy.requiredChecks[0]
function fixture() {
  return {
    check: {
      id: 123,
      name: expected.name,
      app: { id: expected.appId },
      head_sha: HEAD,
      check_suite: { id: 456 },
      status: "completed",
      conclusion: "success",
      details_url: `https://github.com/${policy.repository}/actions/runs/789/job/123`,
    },
    run: {
      id: 789,
      repository: { full_name: policy.repository },
      event: "pull_request",
      head_sha: HEAD,
      check_suite_id: 456,
      path: expected.workflowPath,
      display_title: `${expected.workflowName} head:${HEAD} base:${BASE}`,
      pull_requests: [
        { number: 284, head: { sha: HEAD }, base: { sha: BASE } },
      ],
    },
  }
}
function bind({ check, run }) {
  return bindWorkflowChecks([check], {
    policy,
    number: 284,
    headSha: HEAD,
    baseSha: BASE,
    read: () => run,
  })[0]
}
test("head-attached Actions checks bind to fixed event revision evidence", () => {
  const result = bind(fixture())
  assert.equal(result.workflowBound, true)
  assert.equal(result.sha, HEAD)
  assert.equal(result.baseSha, BASE)
})
test("mutable PR associations cannot make an old-base or unstamped run current", () => {
  for (const title of [
    "old run",
    `${expected.workflowName} head:${HEAD} base:${OLD}`,
    `${expected.workflowName} head:${OLD} base:${BASE}`,
  ]) {
    const value = fixture()
    value.run.display_title = title
    assert.equal(bind(value).workflowBound, false)
  }
})
test("wrong workflow, suite, producer, event and revision fail closed", () => {
  for (const delta of [
    { id: 9 },
    { repository: { full_name: "elsewhere/repo" } },
    { path: ".github/workflows/other.yml" },
    { check_suite_id: 9 },
    { event: "workflow_dispatch" },
    { head_sha: OLD },
    { pull_requests: [] },
  ]) {
    const value = fixture()
    Object.assign(value.run, delta)
    assert.equal(bind(value).workflowBound, false)
  }
  for (const delta of [
    { head_sha: OLD },
    { details_url: "https://example.com/actions/runs/789/job/123" },
    {
      details_url: `https://github.com/${policy.repository}/actions/runs/789/job/999`,
    },
  ]) {
    const value = fixture()
    Object.assign(value.check, delta)
    assert.equal(bind(value).workflowBound, false)
  }
  const value = fixture()
  value.check.app.id = 999
  assert.equal(bind(value), undefined)
})
test("every required workflow emits the fixed head and base event stamp", () => {
  for (const entry of policy.requiredChecks) {
    const source = readFileSync(entry.workflowPath, "utf8")
    assert.ok(
      source.includes(
        `run-name: "${entry.workflowName} head:\u0024{{ github.event.pull_request.head.sha || github.sha }} base:\u0024{{ github.event.pull_request.base.sha || github.sha }}"`
      )
    )
  }
})
