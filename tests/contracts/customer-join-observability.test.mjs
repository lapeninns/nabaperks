import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

function read(...segments) {
  return readFileSync(path.join(root, ...segments), "utf8")
}

test("Given join funnel capture When source is inspected Then first-party persistence precedes the closed optional mirror", () => {
  const funnel = read("lib", "customer", "join-funnel.ts")

  assert.match(funnel, /recordProductEvent/)
  assert.match(funnel, /deterministicFunnelEventId/)
  assert.match(funnel, /scheduleAfterResponseAnalytics\(after/)
  assert.doesNotMatch(funnel, /merchant_slug|qr_id/)
})

test("Given join page views When source is inspected Then attribution follows the rendered experience", () => {
  const loader = read("lib", "customer", "experience", "load-join.ts")
  const page = read("app", "m", "[merchantSlug]", "join", "page.tsx")

  assert.doesNotMatch(loader, /eventName: "join_page_viewed"/)
  assert.match(page, /joinStepForExperienceKind\(experience\.kind\)/)
  assert.match(page, /eventName: "join_page_viewed"/)
})

test("Given authoritative join transitions When action source is inspected Then milestones follow success", () => {
  const actions = read("app", "m", "[merchantSlug]", "join", "actions.ts")
  const send = actions.indexOf("commitPendingPhoneVerification")
  const sendEvent = actions.indexOf('eventName: "join_phone_requested"')
  const rpc = actions.indexOf('"join_customer_membership_with_first_stamp"')
  const termsEvent = actions.indexOf('eventName: "join_terms_accepted"')

  assert.ok(send >= 0 && sendEvent > send)
  assert.ok(rpc >= 0 && termsEvent > rpc)
  assert.match(actions, /join_first_stamp_issued/)
  assert.match(actions, /join_first_stamp_pending/)
})

test("Given a join journey crosses the card redirect When proxy source is inspected Then the signed HTTP-only token continues without browser storage", () => {
  const proxy = read("proxy.ts")

  assert.match(proxy, /request\.nextUrl\.pathname\.startsWith\("\/card\/"\)/)
  assert.match(proxy, /httpOnly: true/)
  assert.match(proxy, /sameSite: "lax"/)
  assert.match(proxy, /secure: process\.env\.NODE_ENV === "production"/)
  assert.match(proxy, /JOIN_JOURNEY_HEADER/)
})
