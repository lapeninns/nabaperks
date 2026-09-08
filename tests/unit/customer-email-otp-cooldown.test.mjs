import assert from "node:assert/strict"
import { test } from "node:test"
import { enforceCustomerEmailOtpCooldown } from "@/lib/customer/email-otp-cooldown"
import { RateLimitError } from "@/lib/security/rate-limit"

test("customer email cooldown normalises recipients and rejects bursts until 60 seconds", async () => {
  const buckets = new Map()
  let now = 0
  const enforce = async ({ key, limit, windowMs }) => {
    assert.equal(limit, 1)
    if ((buckets.get(key) ?? -1) > now) throw new RateLimitError()
    buckets.set(key, now + windowMs)
  }
  await enforceCustomerEmailOtpCooldown(" Person@Example.test ", enforce)
  now = 3500
  await assert.rejects(
    enforceCustomerEmailOtpCooldown("person@example.test", enforce),
    RateLimitError
  )
  await enforceCustomerEmailOtpCooldown("another@example.test", enforce)
  now = 59999
  await assert.rejects(
    enforceCustomerEmailOtpCooldown("person@example.test", enforce),
    RateLimitError
  )
  now = 60000
  await enforceCustomerEmailOtpCooldown("person@example.test", enforce)
})
