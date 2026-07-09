import assert from "node:assert/strict"
import { test } from "node:test"

import {
  OFFER,
  OFFER_STACK,
  PRODUCT,
  SETUP,
} from "@/lib/marketing/facts"

test("OFFER + SETUP expose the offer wrapper and the speed copy", () => {
  assert.equal(OFFER.name, "The 30-Day First-Regular Launch")
  assert.match(OFFER.riskFraming, /Best case/)
  assert.match(SETUP.line, /billing is ready/)
  assert.match(SETUP.steps, /Five guided steps/)
  assert.match(SETUP.earlyWin, /Once billing is active/)
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

test("PRODUCT pricing: £49/month core with a £490/year annual option (two months free)", () => {
  assert.equal(PRODUCT.price, "£49/month")
  assert.equal(PRODUCT.priceShort, "£49/mo")
  assert.equal(PRODUCT.priceAnnual, "£490/year")
  assert.equal(PRODUCT.annualSaving, "2 months free")
  const monthly = Number(PRODUCT.price.replace(/[^0-9.]/g, ""))
  const annual = Number(PRODUCT.priceAnnual.replace(/[^0-9.]/g, ""))
  assert.ok(annual < monthly * 12, "annual is cheaper than 12 monthly payments")
  assert.equal(monthly * 12 - annual, 98) // exactly two months free at £49
})
