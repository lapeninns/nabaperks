import assert from "node:assert/strict"
import { FULL_SHA } from "./impact-git.mjs"

export const ALL_WORKLOADS = Object.freeze([
  "fast",
  "quality",
  "build",
  "e2e",
  "a11y",
  "visual",
  "lighthouse",
  "zap-baseline",
  "db",
  "documentation",
  "targeted-browser",
  "targeted-visual",
])
export const FULL_WORKLOADS = Object.freeze(ALL_WORKLOADS.slice(0, 9))
const PROFILE_WORKLOADS = {
  full: FULL_WORKLOADS,
  documentation: ["documentation"],
  "public-pages": [
    "fast",
    "quality",
    "build",
    "targeted-browser",
    "targeted-visual",
  ],
}

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

export function validatePlan(plan, expected) {
  assert.equal(
    plan?.schema,
    "nabaperks.ci-impact-plan.v1",
    "Unknown CI selection plan"
  )
  assert.deepEqual(
    plan.identity,
    expected,
    "CI selection belongs to another candidate"
  )
  assert.ok(
    Object.hasOwn(PROFILE_WORKLOADS, plan.profile),
    "Unknown impact profile"
  )
  assert.deepEqual(
    plan.required,
    [...PROFILE_WORKLOADS[plan.profile]],
    "Required checks differ from the profile"
  )
  assert.equal(typeof plan.comparisonRequired, "boolean")
  assert.ok(typeof plan.reason === "string" && plan.reason.length > 0)
  assert.ok(Array.isArray(plan.pages) && Array.isArray(plan.changes))
  if (plan.profile === "public-pages") {
    assert.ok(
      plan.pages.length > 0 && plan.pages.length <= 3,
      "Affected pages are missing"
    )
    const known = {
      "app/about/page.tsx": ["/about", "marketing-about"],
      "app/faq/page.tsx": ["/faq", "marketing-faq"],
      "app/how-it-works/page.tsx": ["/how-it-works", "marketing-how-it-works"],
    }
    assert.equal(
      new Set(plan.pages.map((page) => page.path)).size,
      plan.pages.length
    )
    for (const page of plan.pages)
      assert.deepEqual(
        [page.route, page.visualName],
        known[page.path],
        "Unqualified page selection"
      )
  } else assert.deepEqual(plan.pages, [])
  if (expected.event === "push")
    assert.equal(
      plan.profile,
      "full",
      "Application releases require complete main CI"
    )
  if (plan.profile !== "full") {
    assert.ok(plan.changes.length > 0)
    assert.match(plan.changeDigest ?? "", /^[a-f0-9]{64}$/)
    assert.match(plan.policyDigest ?? "", /^[a-f0-9]{64}$/)
    assert.equal(
      plan.comparisonRequired,
      false,
      "Selection changes must retain the full comparison"
    )
  }
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
