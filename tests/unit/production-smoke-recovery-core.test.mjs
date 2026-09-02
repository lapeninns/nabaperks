import assert from "node:assert/strict"
import test from "node:test"

import { previousScheduledRunSucceeded } from "../../scripts/production-smoke-recovery-core.mjs"

const repository = "lapeninns/nabaperks"
const currentRun = {
  id: 20,
  workflow_id: 7,
  run_number: 200,
  run_attempt: 1,
  event: "schedule",
  status: "in_progress",
  conclusion: null,
  repository: { full_name: repository },
}

function prior(overrides = {}) {
  return {
    id: 19,
    workflow_id: 7,
    run_number: 199,
    run_attempt: 1,
    event: "schedule",
    status: "completed",
    conclusion: "success",
    repository: { full_name: repository },
    ...overrides,
  }
}

test("two distinct first-attempt scheduled successes satisfy recovery", () => {
  assert.equal(
    previousScheduledRunSucceeded({
      currentRun,
      workflowRuns: [currentRun, prior()],
      repository,
    }),
    true
  )
})

test("failure, cancellation, or an in-progress prior scheduled run resets recovery", () => {
  for (const state of [
    { status: "completed", conclusion: "failure" },
    { status: "completed", conclusion: "cancelled" },
    { status: "in_progress", conclusion: null },
  ]) {
    assert.equal(
      previousScheduledRunSucceeded({
        currentRun,
        workflowRuns: [prior(state), prior({ id: 18, run_number: 198 })],
        repository,
      }),
      false
    )
  }
})

test("manual, rerun, wrong-workflow, and wrong-repository records cannot authorize recovery", () => {
  for (const candidate of [
    prior({ event: "workflow_dispatch" }),
    prior({ run_attempt: 2 }),
    prior({ workflow_id: 8 }),
    prior({ repository: { full_name: "attacker/fork" } }),
  ]) {
    assert.equal(
      previousScheduledRunSucceeded({
        currentRun,
        workflowRuns: [candidate],
        repository,
      }),
      false
    )
  }
})

test("the current run and an older success cannot skip the immediate prior failure", () => {
  assert.equal(
    previousScheduledRunSucceeded({
      currentRun,
      workflowRuns: [
        currentRun,
        prior({ conclusion: "failure" }),
        prior({ id: 18, run_number: 198 }),
      ],
      repository,
    }),
    false
  )
})
