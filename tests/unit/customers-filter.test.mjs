import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  buildCustomersHref,
  containsPattern,
  CUSTOMER_MATCH_ID_CAP,
  CUSTOMER_SEARCH_TERM_MAX_LENGTH,
  escapeLikePattern,
  londonDayStartInstant,
  maskedContactOrIlikeFilter,
  parseCustomerFilterParam,
  parseCustomerSearchParam,
  quotePostgrestValue,
  resolveCustomerFilterBoundaries,
} from "@/lib/merchant/customers-filter"
import {
  deriveMerchantCustomerRewardBadge,
  MERCHANT_GONE_QUIET_DAYS,
} from "@/lib/merchant/customer-readback"

describe("parseCustomerFilterParam", () => {
  it("accepts every pill id, case-insensitively", () => {
    assert.equal(parseCustomerFilterParam("ready"), "ready")
    assert.equal(parseCustomerFilterParam("QUIET"), "quiet")
    assert.equal(parseCustomerFilterParam(" active "), "active")
    assert.equal(parseCustomerFilterParam("all"), "all")
  })

  it("falls back to the whole list rather than an empty one", () => {
    assert.equal(parseCustomerFilterParam(undefined), "all")
    assert.equal(parseCustomerFilterParam("redeemed"), "all")
    assert.equal(parseCustomerFilterParam(""), "all")
  })

  it("reads the first entry of a repeated param", () => {
    assert.equal(parseCustomerFilterParam(["quiet", "ready"]), "quiet")
  })
})

describe("parseCustomerSearchParam", () => {
  it("returns undefined when nothing searchable remains", () => {
    assert.equal(parseCustomerSearchParam(undefined), undefined)
    assert.equal(parseCustomerSearchParam("   "), undefined)
    assert.equal(parseCustomerSearchParam(""), undefined)
  })

  it("collapses whitespace and control characters", () => {
    assert.equal(parseCustomerSearchParam("  a\t\tb\nc "), "a b c")
    assert.equal(parseCustomerSearchParam("a\u0000b"), "a b")
  })

  it("caps the term length", () => {
    const term = parseCustomerSearchParam("x".repeat(500))
    assert.equal(term?.length, CUSTOMER_SEARCH_TERM_MAX_LENGTH)
  })
})

describe("search escaping", () => {
  it("neutralises LIKE wildcards so a fragment matches literally", () => {
    assert.equal(escapeLikePattern("100%_off\\"), "100\\%\\_off\\\\")
    assert.equal(containsPattern("a_b"), "%a\\_b%")
  })

  it("quotes PostgREST reserved characters inside an or() value", () => {
    assert.equal(quotePostgrestValue("a,b(c).d"), '"a,b(c).d"')
    assert.equal(quotePostgrestValue('say "hi"'), '"say \\"hi\\""')
  })

  it("searches only the two columns the masked view exposes", () => {
    const filter = maskedContactOrIlikeFilter("gmail")
    assert.equal(filter, 'email.ilike."%gmail%",phone_last4.ilike."%gmail%"')
    // Neither raw contact column may appear: `customers.phone` was retired and
    // the merchant session reads customers_masked.
    assert.ok(!/(^|[^_])phone\.ilike/.test(filter))
  })

  it("keeps a comma inside the term from splitting the or() expression", () => {
    const filter = maskedContactOrIlikeFilter("a,b")
    assert.equal(filter.split('",').length, 2)
    assert.ok(filter.includes('"%a,b%"'))
  })
})

describe("londonDayStartInstant", () => {
  it("resolves GMT and BST day starts", () => {
    assert.equal(
      londonDayStartInstant("2026-01-15").toISOString(),
      "2026-01-15T00:00:00.000Z"
    )
    assert.equal(
      londonDayStartInstant("2026-07-15").toISOString(),
      "2026-07-14T23:00:00.000Z"
    )
  })

  it("resolves the two clock-change days themselves", () => {
    // BST starts 29 March 2026 at 01:00 UTC; the day still begins at 00:00 UTC.
    assert.equal(
      londonDayStartInstant("2026-03-29").toISOString(),
      "2026-03-29T00:00:00.000Z"
    )
    // BST ends 25 October 2026 at 01:00 UTC; the day begins at 23:00 the day
    // before, while BST is still in force.
    assert.equal(
      londonDayStartInstant("2026-10-25").toISOString(),
      "2026-10-24T23:00:00.000Z"
    )
  })
})

describe("resolveCustomerFilterBoundaries", () => {
  const now = new Date("2026-07-15T09:30:00.000Z")
  const bounds = resolveCustomerFilterBoundaries(now)

  it("compares redeemable_from as a DATE day key, not an instant", () => {
    assert.equal(bounds.redeemableOnOrBeforeKey, "2026-07-15")
  })

  it("starts 'joined today' at the London midnight of the current day", () => {
    assert.equal(bounds.joinedTodayFromIso, "2026-07-14T23:00:00.000Z")
  })

  it("agrees with the badge on the quiet boundary", () => {
    // The DB predicate is `last_visit_at < quietBeforeIso`, so the boundary
    // instant itself is the OLDEST visit the badge still calls active, and one
    // second earlier is the newest visit it calls quiet.
    const boundary = new Date(bounds.quietBeforeIso)
    const quietEnough = new Date(boundary.getTime() - 1_000)
    const stillActive = boundary

    const badge = (lastVisitAt) =>
      deriveMerchantCustomerRewardBadge(
        {
          createdAt: "2020-01-01T00:00:00.000Z",
          lastVisitAt,
          currentStampCount: 0,
          stampsRequired: 3,
          lastRedeemedAt: null,
          activeReward: null,
        },
        now
      ).tone

    assert.equal(badge(quietEnough.toISOString()), "quiet")
    assert.equal(badge(stillActive.toISOString()), "collecting")
    assert.equal(badge(null), "quiet")
  })

  it("spans exactly the documented quiet window", () => {
    const days =
      (new Date(bounds.joinedTodayFromIso).getTime() -
        new Date(bounds.quietBeforeIso).getTime()) /
      86_400_000
    assert.equal(days, MERCHANT_GONE_QUIET_DAYS - 1)
  })
})

describe("buildCustomersHref", () => {
  it("keeps the default state implicit", () => {
    assert.equal(buildCustomersHref(), "/app/customers")
    assert.equal(
      buildCustomersHref({ page: 1, filter: "all", query: "" }),
      "/app/customers"
    )
    assert.equal(
      buildCustomersHref({ query: "   " }),
      "/app/customers"
    )
  })

  it("carries the narrowing into every page href", () => {
    assert.equal(
      buildCustomersHref({ page: 3, filter: "ready", query: "gmail" }),
      "/app/customers?filter=ready&q=gmail&page=3"
    )
  })

  it("encodes a deep-linked member", () => {
    assert.equal(
      buildCustomersHref({ page: 2, highlight: "abc" }),
      "/app/customers?page=2&highlight=abc"
    )
  })
})

describe("CUSTOMER_MATCH_ID_CAP", () => {
  it("keeps a PostgREST in() list inside a normal request-line budget", () => {
    // 36 uuid characters + a comma each, plus the rest of the query string.
    assert.ok(CUSTOMER_MATCH_ID_CAP * 37 < 8_000)
  })
})
