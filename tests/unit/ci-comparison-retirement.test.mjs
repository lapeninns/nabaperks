import assert from "node:assert/strict"
import { test } from "node:test"
import { summarizeImpactEvidence } from "../../scripts/ci/verify-impact-evidence.mjs"
import {
  ALL_WORKLOADS,
  FULL_WORKLOADS,
  fullPlan,
} from "../../scripts/ci/impact-plan-contract.mjs"

const sha = (c) => c.repeat(40)
const identity = {
  repository: "lapeninns/nabaperks",
  event: "pull_request",
  baseSha: sha("a"),
  headSha: sha("b"),
  candidateSha: sha("c"),
}

function evidence(plan, comparison) {
  const jobs = {
    selection: { result: "success", outputs: { plan: JSON.stringify(plan) } },
    ...Object.fromEntries(
      ALL_WORKLOADS.map((name) => [
        name,
        {
          result:
            FULL_WORKLOADS.includes(name) || plan.comparisonRequired
              ? "success"
              : "skipped",
        },
      ])
    ),
  }
  if (comparison !== undefined)
    jobs["selection-comparison"] = { result: comparison }
  return jobs
}

test("the retired comparison job may be absent or skipped, never unexpectedly run", () => {
  const plan = fullPlan(identity, "CI input changes", false)
  assert.match(summarizeImpactEvidence(evidence(plan), identity), /db: passed/)
  assert.match(
    summarizeImpactEvidence(evidence(plan, "skipped"), identity),
    /db: passed/
  )
  for (const result of ["success", "failure", "cancelled"])
    assert.throws(
      () => summarizeImpactEvidence(evidence(plan, result), identity),
      /Selection comparison is missing or unexpected/
    )
})

test("a plan that still requires comparison cannot pass without the job", () => {
  const plan = fullPlan(identity, "Legacy comparison plan", true)
  assert.throws(
    () => summarizeImpactEvidence(evidence(plan), identity),
    /required but its job is missing/
  )
  assert.match(
    summarizeImpactEvidence(evidence(plan, "success"), identity),
    /db: passed/
  )
})

test("dropping the comparison job does not relax the rest of the job set", () => {
  const plan = fullPlan(identity, "CI input changes", false)
  const missing = evidence(plan)
  delete missing.e2e
  assert.throws(
    () => summarizeImpactEvidence(missing, identity),
    /Unexpected or missing CI jobs/
  )
  const extra = { ...evidence(plan), rogue: { result: "success" } }
  assert.throws(
    () => summarizeImpactEvidence(extra, identity),
    /Unexpected or missing CI jobs/
  )
  const cancelled = { ...evidence(plan), e2e: { result: "cancelled" } }
  assert.throws(
    () => summarizeImpactEvidence(cancelled, identity),
    /e2e: successful execution required/
  )
})
