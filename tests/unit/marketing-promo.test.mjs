import assert from "node:assert/strict"
import { test } from "node:test"

import {
  getActivePromo,
  getMonthlySpotsRemaining,
  isPromoStale,
  PROMO_CONFIG,
} from "@/lib/marketing/promo"

test("getActivePromo: returns null when promos are disabled", () => {
  assert.equal(
    getActivePromo(new Date("2026-07-15T12:00:00Z"), {
      enabled: false,
      monthlyCap: 40,
    }),
    null
  )
})

test("getActivePromo: urgency rolls to the end of the current UK month", () => {
  const promo = getActivePromo(new Date("2026-07-05T12:00:00Z"))
  assert.ok(promo)
  assert.equal(promo.name, "July First-Regular promo")
  assert.equal(promo.endDateISO, "2026-07-31")
  assert.equal(promo.deadlineLabel, "31 July 2026")
  assert.ok(promo.perk.includes("31 July 2026"))
})

test("getActivePromo: urgency and scarcity reset on the first day of a new month", () => {
  const july = getActivePromo(new Date("2026-07-31T12:00:00Z"))
  const august = getActivePromo(new Date("2026-08-01T12:00:00Z"))
  assert.ok(july && august)
  assert.equal(july.monthLabel, "July")
  assert.equal(august.monthLabel, "August")
  assert.equal(august.endDateISO, "2026-08-31")
  assert.notEqual(july.spotsRemaining, august.spotsRemaining)
})

test("getActivePromo: deadlineLabel is the en-GB rendering of endDateISO", () => {
  const promo = getActivePromo(new Date("2026-09-12T12:00:00Z"))
  assert.ok(promo)
  const rendered = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${promo.endDateISO}T00:00:00Z`))
  assert.equal(promo.deadlineLabel, rendered)
  assert.ok(promo.perk.includes(promo.deadlineLabel))
})

test("getActivePromo: scarcity line names the monthly cap and remaining spots", () => {
  const promo = getActivePromo(new Date("2026-07-15T12:00:00Z"))
  assert.ok(promo)
  assert.match(promo.scarcityLine, /onboard 40 new venues per month/)
  assert.match(promo.scarcityChip, /print-run spots left in July/)
  assert.equal(promo.monthlyCap, PROMO_CONFIG.monthlyCap)
  assert.ok(promo.spotsRemaining >= 1)
  assert.ok(promo.claimedThisMonth >= 0)
})

test("getMonthlySpotsRemaining: depletes through the month and keeps at least one spot", () => {
  const start = getMonthlySpotsRemaining(1, 31, 40)
  const mid = getMonthlySpotsRemaining(16, 31, 40)
  const end = getMonthlySpotsRemaining(31, 31, 40)

  assert.ok(start.spotsRemaining > mid.spotsRemaining)
  assert.ok(mid.spotsRemaining > end.spotsRemaining)
  assert.ok(end.spotsRemaining >= 1)
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

test("CI tripwire: the live monthly promo deadline is never already past", () => {
  const promo = getActivePromo(new Date())
  if (!promo) {
    return
  }
  assert.equal(isPromoStale({ enabled: true, endDateISO: promo.endDateISO }, new Date().toISOString()), false)
})
