import assert from "node:assert/strict"
import { test } from "node:test"

import {
  billingCheckoutSuccessHref,
  billingReturnHref,
  BILLING_ACCOUNT_PATH,
  BILLING_LAUNCH_TAB_PATH,
  resolveBillingReturnBase,
} from "@/lib/merchant/billing-nav"

test("resolveBillingReturnBase only allows launch and account billing paths", () => {
  assert.equal(
    resolveBillingReturnBase(BILLING_LAUNCH_TAB_PATH),
    BILLING_LAUNCH_TAB_PATH
  )
  assert.equal(
    resolveBillingReturnBase(BILLING_ACCOUNT_PATH),
    BILLING_ACCOUNT_PATH
  )
  assert.equal(resolveBillingReturnBase("//evil.example"), BILLING_ACCOUNT_PATH)
  assert.equal(
    resolveBillingReturnBase("/app/launch?tab=billing&next=//evil.example"),
    BILLING_ACCOUNT_PATH
  )
  assert.equal(
    resolveBillingReturnBase("https://evil.example/app/billing"),
    BILLING_ACCOUNT_PATH
  )
})

test("billingReturnHref preserves existing query params on launch billing", () => {
  assert.equal(
    billingReturnHref(BILLING_LAUNCH_TAB_PATH, { checkout: "success" }),
    "/app/launch?tab=billing&checkout=success"
  )
})

test("billingCheckoutSuccessHref preserves the literal Stripe Session placeholder", () => {
  assert.equal(
    billingCheckoutSuccessHref(BILLING_LAUNCH_TAB_PATH),
    "/app/launch?tab=billing&checkout=success&session_id={CHECKOUT_SESSION_ID}"
  )
  assert.equal(
    billingCheckoutSuccessHref("//evil.example"),
    "/app/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}"
  )
})
