import assert from "node:assert/strict"
import { FULL_SHA } from "./impact-git.mjs"

export const FULL_WORKLOADS = Object.freeze([
  "fast",
  "quality",
  "build",
  "e2e",
  "a11y",
  "visual",
  "lighthouse",
  "zap-baseline",
  "db",
])

export function expectedIdentity(env) {
  const identity = {
    repository: env.GITHUB_REPOSITORY,
    event: env.GITHUB_EVENT_NAME,
    baseSha: env.CI_BASE_SHA,
    headSha: env.CI_HEAD_SHA,
    candidateSha: env.GITHUB_SHA,
  }
  assert.equal(
    identity.repository,
    "lapeninns/nabaperks",
    "Unexpected CI repository"
  )
  assert.ok(
    ["pull_request", "push"].includes(identity.event),
    "Unexpected CI event"
  )
  for (const field of ["baseSha", "headSha", "candidateSha"])
    assert.match(identity[field] ?? "", FULL_SHA, `Missing ${field} identity`)
  if (identity.event === "push") {
    assert.equal(
      env.GITHUB_REF,
      "refs/heads/main",
      "Only main pushes qualify releases"
    )
    assert.equal(identity.headSha, identity.candidateSha)
  }
  return identity
}

// This prerequisite can validate full comparison plans only. It has no API
// that authorises a selective profile or omits application workloads.
export function validateComparisonPlan(plan, expected) {
  assert.equal(plan?.schema, "nabaperks.ci-impact-plan.v1")
  assert.deepEqual(
    plan.identity,
    expected,
    "CI selection belongs to another candidate"
  )
  assert.equal(
    plan.profile,
    "full",
    "Comparison requires all application workloads"
  )
  assert.equal(plan.comparisonRequired, true)
  assert.deepEqual(plan.required, [...FULL_WORKLOADS])
  assert.deepEqual(plan.pages, [])
  assert.ok(Array.isArray(plan.changes))
  assert.ok(typeof plan.reason === "string" && plan.reason.trim().length > 0)
  return plan
}

export function fullPlan(identity, reason, comparisonRequired = true) {
  return {
    schema: "nabaperks.ci-impact-plan.v1",
    identity,
    profile: "full",
    reason,
    required: [...FULL_WORKLOADS],
    pages: [],
    changes: [],
    comparisonRequired,
  }
}
