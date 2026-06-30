import assert from "node:assert/strict"
import { test } from "node:test"

import {
  latestPushMarketingConsentOptedIn,
  pushMarketingConsentCustomerIds,
} from "@/lib/notifications/push-marketing-eligibility-core"

/**
 * MS-notifications — push marketing consent policy (unit tier).
 *
 * Enqueue, announcement batching, and delivery all depend on the same latest
 * push-channel consent rule. The database queries stay server-only; the
 * deterministic "latest row wins and only opted_in allows marketing" decision
 * is proven here.
 */

test("latest push consent allows only an opted-in latest row", () => {
  assert.equal(
    latestPushMarketingConsentOptedIn([{ consent_status: "opted_in" }]),
    true
  )
  assert.equal(
    latestPushMarketingConsentOptedIn([{ consent_status: "opted_out" }]),
    false
  )
  assert.equal(
    latestPushMarketingConsentOptedIn([{ consent_status: "pending" }]),
    false
  )
  assert.equal(latestPushMarketingConsentOptedIn([]), false)
})

test("batch audience consent uses the first row per customer as latest", () => {
  const allowed = pushMarketingConsentCustomerIds([
    { customer_id: "customer-a", consent_status: "opted_out" },
    { customer_id: "customer-b", consent_status: "opted_in" },
    { customer_id: "customer-a", consent_status: "opted_in" },
    { customer_id: "", consent_status: "opted_in" },
    { consent_status: "opted_in" },
  ])

  assert.deepEqual([...allowed].sort(), ["customer-b"])
})
