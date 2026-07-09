import assert from "node:assert/strict"
import { test } from "node:test"

import {
  formatMerchantBillingStatus,
  merchantBillingStateCopy,
  shouldShowMerchantDashboardBillingNotice,
} from "@/lib/merchant/billing-status-copy"

test("first-run not_started billing routes to the single launch activation destination", () => {
  const copy = merchantBillingStateCopy("not_started")

  // The dashboard notice must send a not-yet-activated merchant to the launch
  // billing step (not Account billing), matching the launch header CTA.
  assert.equal(copy.actionHref, "/app/launch?tab=billing")
  assert.equal(copy.actionLabel, "Proceed to billing")
  assert.equal(copy.title, "Activate your venue")
})

test("not_started copy never implies scans are active before billing allows them", () => {
  const { description } = merchantBillingStateCopy("not_started")
  assert.match(description, /activate your venue and start accepting stamps/)
  assert.doesNotMatch(description, /scans are (live|active|on)/i)
})

test("the not_started notice is shown on the dashboard", () => {
  assert.equal(shouldShowMerchantDashboardBillingNotice("not_started"), true)
})

test("active and trialing (and the trial alias) suppress the dashboard notice", () => {
  assert.equal(shouldShowMerchantDashboardBillingNotice("active"), false)
  assert.equal(shouldShowMerchantDashboardBillingNotice("trialing"), false)
  assert.equal(shouldShowMerchantDashboardBillingNotice("trial"), false)
})

test("post-activation attention states route to Account billing for management", () => {
  for (const status of ["past_due", "cancelled", "suspended"]) {
    const copy = merchantBillingStateCopy(status)
    assert.equal(copy.actionHref, "/app/account?tab=billing", `${status} href`)
    assert.equal(
      shouldShowMerchantDashboardBillingNotice(status),
      true,
      `${status} shown`
    )
  }
})

test("an unknown status falls back to a safe Account billing review action", () => {
  const copy = merchantBillingStateCopy("garbled")
  assert.equal(copy.actionHref, "/app/account?tab=billing")
  assert.equal(copy.actionLabel, "Review billing")
})

test("the trial alias normalises to trialing in copy", () => {
  assert.equal(formatMerchantBillingStatus("trial"), "trialing")
})
