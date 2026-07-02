import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  SHARED_MEMBERS_CAPTION,
  dashboardScopeMembersCaption,
  resolveMerchantDashboardScope,
} from "@/lib/merchant/dashboard-scope"

describe("merchant dashboard location scope", () => {
  it("treats blank or missing location values as merchant-wide", () => {
    assert.deepEqual(resolveMerchantDashboardScope(), { mode: "merchant" })
    assert.deepEqual(resolveMerchantDashboardScope({ locationId: "" }), {
      mode: "merchant",
    })
    assert.deepEqual(resolveMerchantDashboardScope({ locationId: "   " }), {
      mode: "merchant",
    })
  })

  it("normalizes non-blank location ids into a location scope", () => {
    assert.deepEqual(
      resolveMerchantDashboardScope({ locationId: " loc_white_horse " }),
      {
        mode: "location",
        locationId: "loc_white_horse",
      }
    )
  })

  it("surfaces the shared-members caption only for a location scope", () => {
    assert.equal(
      dashboardScopeMembersCaption({ locationId: "loc_white_horse" }),
      SHARED_MEMBERS_CAPTION
    )
    assert.equal(dashboardScopeMembersCaption(), null)
  })
})
