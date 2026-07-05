import assert from "node:assert/strict"
import { test } from "node:test"

import {
  OFFER,
  OFFER_STACK,
  PROMO,
  SETUP,
  isPromoStale,
} from "@/lib/marketing/facts"

test("OFFER + SETUP expose the offer wrapper and the speed copy", () => {
  assert.equal(OFFER.name, "The 30-Day First-Regular Launch")
  assert.match(OFFER.riskFraming, /Best case/)
  assert.match(SETUP.line, /same afternoon/)
  assert.match(SETUP.steps, /Four guided steps/)
})

test("OFFER_STACK: five items, each with an obstacle; only substantiable items carry an anchor", () => {
  assert.equal(OFFER_STACK.length, 5)
  for (const item of OFFER_STACK) {
    assert.equal(typeof item.name, "string")
    assert.equal(typeof item.obstacle, "string")
    assert.ok(item.obstacle.length > 0, `${item.name} states an obstacle`)
  }
  // Privacy carries no price anchor — mechanisms only, compliance-safe.
  const privacy = OFFER_STACK.find((i) => i.name === "Privacy jobs, handled")
  assert.equal(privacy.anchor, null)
  // Poster kit anchors to a real external design cost, not an invented RRP.
  const posters = OFFER_STACK.find(
    (i) => i.name === "Launch-ready till poster kit"
  )
  assert.match(posters.anchor, /£150\+/)
})

test("PROMO.deadlineLabel is the en-GB rendering of endDateISO (drift guard)", () => {
  const rendered = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${PROMO.endDateISO}T00:00:00Z`))
  assert.equal(PROMO.deadlineLabel, rendered)
  // The perk sentence names the same human date.
  assert.ok(PROMO.perk.includes(PROMO.deadlineLabel))
})

test("isPromoStale: a disabled promo is never stale", () => {
  assert.equal(
    isPromoStale({ enabled: false, endDateISO: "2000-01-01" }, "2026-07-05T00:00:00Z"),
    false
  )
})

test("isPromoStale: an enabled promo is live through its final calendar day and stale after", () => {
  const promo = { enabled: true, endDateISO: "2026-08-31" }
  assert.equal(isPromoStale(promo, "2026-08-31T18:00:00Z"), false)
  assert.equal(isPromoStale(promo, "2026-09-01T00:00:00Z"), true)
})

test("CI staleness tripwire: the shipped PROMO is not already stale", () => {
  // Fails the build once an enabled promo's deadline passes — forcing a
  // deliberate refresh or disable rather than a stale, past-dated promo.
  assert.equal(isPromoStale(PROMO, new Date().toISOString()), false)
})
