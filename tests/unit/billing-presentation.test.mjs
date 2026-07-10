import assert from "node:assert/strict"
import { test } from "node:test"

import { buildBillingPresentation } from "@/lib/merchant/billing-presentation"

const monthlyBilling = {
  status: "active",
  stripe_subscription_status: "active",
  stripe_customer_id: "cus_owned",
  billing_interval: "month",
  unit_amount: 4_900,
  currency: "gbp",
  current_period_end: "2026-08-10T12:00:00.000Z",
  cancel_at_period_end: false,
  cancel_at: null,
}

test("monthly billing presents its stored receipt and manages the existing Subscription", () => {
  const presentation = buildBillingPresentation(monthlyBilling)

  assert.deepEqual(presentation.receipt, {
    kind: "monthly",
    amountLabel: "£49",
    cadenceLabel: "per month",
    summary: "£49 per month",
  })
  assert.deepEqual(presentation.primaryAction, {
    kind: "portal",
    label: "Open Stripe portal",
  })
  assert.equal(
    presentation.periodMessage,
    "Current period ends 10 August 2026."
  )
})

test("annual billing presents exact stored annual terms and scheduled cancellation", () => {
  const presentation = buildBillingPresentation({
    ...monthlyBilling,
    billing_interval: "year",
    unit_amount: 49_000,
    current_period_end: "2027-07-10T12:00:00.000Z",
    cancel_at_period_end: true,
    cancel_at: "2027-07-10T12:00:00.000Z",
  })

  assert.deepEqual(presentation.receipt, {
    kind: "annual",
    amountLabel: "£490",
    cadenceLabel: "per year",
    summary: "£490 per year",
  })
  assert.equal(presentation.periodMessage, "Cancels on 10 July 2027.")
})

test("cancelled billing exposes restart Checkout while retaining its annual receipt", () => {
  const presentation = buildBillingPresentation({
    ...monthlyBilling,
    status: "cancelled",
    stripe_subscription_status: "canceled",
    billing_interval: "year",
    unit_amount: 49_000,
  })

  assert.equal(presentation.receipt.kind, "annual")
  assert.deepEqual(presentation.primaryAction, {
    kind: "checkout",
    intent: "restart",
    label: "Restart billing",
  })
})

test("an incomplete-expired Subscription exposes a safe Checkout retry", () => {
  const presentation = buildBillingPresentation({
    ...monthlyBilling,
    status: "suspended",
    stripe_subscription_status: "incomplete_expired",
  })

  assert.deepEqual(presentation.primaryAction, {
    kind: "checkout",
    intent: "retry",
    label: "Try checkout again",
  })
})

test("absent billing starts Checkout without inventing a receipt", () => {
  const presentation = buildBillingPresentation(null)

  assert.deepEqual(presentation.receipt, {
    kind: "unknown",
    message: "Stripe details are still syncing.",
  })
  assert.deepEqual(presentation.primaryAction, {
    kind: "checkout",
    intent: "start",
    label: "Proceed to billing",
  })
})

test("unknown stored terms show syncing copy instead of defaulting to monthly", () => {
  const presentation = buildBillingPresentation({
    ...monthlyBilling,
    billing_interval: null,
    unit_amount: null,
    currency: null,
  })

  assert.deepEqual(presentation.receipt, {
    kind: "unknown",
    message: "Stripe details are still syncing.",
  })
  assert.doesNotMatch(JSON.stringify(presentation.receipt), /49|month/)
})

test("a non-restartable Subscription without a customer mapping stays in recovery", () => {
  const presentation = buildBillingPresentation({
    ...monthlyBilling,
    stripe_customer_id: null,
  })

  assert.deepEqual(presentation.primaryAction, {
    kind: "recovery",
    label: "Refresh billing",
    message:
      "Stripe billing exists, but its management link is still syncing. Refresh before trying again.",
  })
})
