import assert from "node:assert/strict"
import { test } from "node:test"

import {
  billingReturnHref,
  BILLING_LAUNCH_TAB_PATH,
  resolveBillingReturnBase,
} from "@/lib/merchant/billing-nav"

test("resolveBillingReturnBase only allows launch and account billing paths", () => {
  assert.equal(resolveBillingReturnBase(BILLING_LAUNCH_TAB_PATH), BILLING_LAUNCH_TAB_PATH)
  assert.equal(resolveBillingReturnBase("/app/billing"), "/app/billing")
  assert.equal(resolveBillingReturnBase("//evil.example"), "/app/billing")
})

test("billingReturnHref preserves existing query params on launch billing", () => {
  assert.equal(
    billingReturnHref(BILLING_LAUNCH_TAB_PATH, { checkout: "success" }),
    "/app/launch?tab=billing&checkout=success"
  )
})
