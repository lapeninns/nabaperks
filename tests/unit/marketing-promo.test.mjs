import assert from "node:assert/strict"
import { test } from "node:test"

import { getActivePromo, isPromoStale } from "@/lib/marketing/promo"

test("getActivePromo: returns null when promos are disabled", () => {
  assert.equal(
    getActivePromo(new Date("2026-07-15T12:00:00Z"), {
      enabled: false,
    }),
    null
  )
})

test("getActivePromo: live configuration stays off until a genuine incremental perk exists", () => {
  assert.equal(getActivePromo(new Date("2026-07-15T12:00:00Z")), null)
})

test("getActivePromo: urgency rolls to the end of the current UK month", () => {
  const promo = getActivePromo(new Date("2026-07-05T12:00:00Z"), {
    enabled: true,
  })
  assert.ok(promo)
  assert.equal(promo.name, "July First-Regular promo")
  assert.equal(promo.endDateISO, "2026-07-31")
  assert.equal(promo.deadlineLabel, "31 July 2026")
  assert.ok(promo.perk.includes("31 July 2026"))
})

test("getActivePromo: urgency resets on the first day of a new month", () => {
  const july = getActivePromo(new Date("2026-07-31T12:00:00Z"), {
    enabled: true,
  })
  const august = getActivePromo(new Date("2026-08-01T12:00:00Z"), {
    enabled: true,
  })
  assert.ok(july && august)
  assert.equal(july.monthLabel, "July")
  assert.equal(august.monthLabel, "August")
  assert.equal(august.endDateISO, "2026-08-31")
})

test("getActivePromo: deadlineLabel is the en-GB rendering of endDateISO", () => {
  const promo = getActivePromo(new Date("2026-09-12T12:00:00Z"), {
    enabled: true,
  })
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

test("getActivePromo: copy makes no numeric availability claim", () => {
  const promo = getActivePromo(new Date("2026-07-15T12:00:00Z"), {
    enabled: true,
  })
  assert.ok(promo)
  assert.doesNotMatch(
    Object.values(promo).join(" "),
    /spots? left|onboard \d+/i
  )
})

test("getActivePromo: Playwright can freeze the server-rendered promo clock", () => {
  const previous = process.env.PLAYWRIGHT_MARKETING_PROMO_NOW
  process.env.PLAYWRIGHT_MARKETING_PROMO_NOW = "2026-07-06T12:00:00Z"

  try {
    const promo = getActivePromo(undefined, { enabled: true })
    assert.ok(promo)
    assert.equal(promo.name, "July First-Regular promo")
    assert.equal(promo.endDateISO, "2026-07-31")
  } finally {
    if (previous === undefined) {
      delete process.env.PLAYWRIGHT_MARKETING_PROMO_NOW
    } else {
      process.env.PLAYWRIGHT_MARKETING_PROMO_NOW = previous
    }
  }
})

test("isPromoStale: a disabled promo is never stale", () => {
  assert.equal(
    isPromoStale(
      { enabled: false, endDateISO: "2000-01-01" },
      "2026-07-05T00:00:00Z"
    ),
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
  assert.equal(
    isPromoStale(
      { enabled: true, endDateISO: promo.endDateISO },
      new Date().toISOString()
    ),
    false
  )
})
