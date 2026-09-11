import assert from "node:assert/strict"
import { readAt } from "./impact-git.mjs"
import { impactPolicy } from "./impact-documentation.mjs"

export function qualificationPages(policy) {
  assert.equal(policy?.schema, "nabaperks.ci-impact-policy.v1")
  assert.ok(policy.publicPages && !Array.isArray(policy.publicPages))
  const pages = Object.entries(policy.publicPages).map(([path, page]) => {
    assert.deepEqual(Object.keys(page).sort(), ["route", "visualName"])
    assert.match(path, /^app\/(?:[a-z0-9-]+\/)+page\.tsx$/)
    assert.match(page.route, /^\/(?:[a-z0-9-]+\/)*[a-z0-9-]+$/)
    assert.equal(path, `app${page.route}/page.tsx`)
    assert.match(page.visualName, /^[a-z0-9-]+$/)
    return { path, ...page }
  })
  assert.ok(pages.length > 0 && pages.length <= 20)
  assert.equal(new Set(pages.map((page) => page.route)).size, pages.length)
  assert.equal(new Set(pages.map((page) => page.visualName)).size, pages.length)
  return pages
}

export function candidateQualificationPages(candidateSha, options) {
  return qualificationPages(
    JSON.parse(readAt(candidateSha, "config/ci-impact-policy.json", options))
  )
}

export function selectedQualificationPages(plan) {
  return plan.qualificationPages ?? qualificationPages(impactPolicy)
}

export function verifyQualificationScope(plan, options) {
  const pages = candidateQualificationPages(plan.identity.candidateSha, options)
  assert.deepEqual(
    selectedQualificationPages(plan),
    pages,
    "Qualification pages differ from the immutable candidate policy"
  )
  return pages
}

export const BROWSER_PROJECTS = Object.freeze([
  "chromium",
  "mobile-safari",
  "desktop-firefox",
  "desktop-safari",
])
export const VISUAL_PROJECTS = Object.freeze(["chromium", "mobile-safari"])
export function selectedPages(plan) {
  if (plan.profile === "public-pages") return plan.pages
  assert.equal(plan.profile, "full")
  assert.equal(
    plan.comparisonRequired,
    true,
    "Full runs only duplicate selected checks during policy qualification"
  )
  return selectedQualificationPages(plan)
}
