import assert from "node:assert/strict"
import { test } from "node:test"
import { enforceCustomerEmailOtpAdmission } from "@/lib/customer/email-otp-cooldown"
import { customerEmailHmac } from "@/lib/customer/email-pii-core"
import { RateLimitError, rateLimitBucketHash } from "@/lib/security/rate-limit"

process.env.CUSTOMER_EMAIL_HMAC_SECRET = "email-admission-test-secret"

test("email admission preserves deployed quota keys and shares a normalised cross-flow cooldown", async () => {
  const calls = []
  const admit = async (buckets) => {
    calls.push(buckets)
    return { error: null }
  }
  for (const flow of ["verification", "recovery"]) {
    await enforceCustomerEmailOtpAdmission(
      { email: " Person@Example.test ", customerId: "customer-1", flow },
      admit
    )
  }
  assert.deepEqual(calls[0], {
    p_customer_bucket: rateLimitBucketHash(
      "customer-email-verification-send:customer:customer-1"
    ),
    p_recipient_bucket: rateLimitBucketHash(
      "customer-email-verification-send:person@example.test"
    ),
    p_cooldown_bucket: rateLimitBucketHash(
      "customer-email-otp:cooldown:person@example.test"
    ),
  })
  assert.deepEqual(calls[1], {
    p_customer_bucket: rateLimitBucketHash(
      "customer-access-recovery-send:customer:customer-1"
    ),
    p_recipient_bucket: rateLimitBucketHash(
      `customer-access-recovery-send:${customerEmailHmac("person@example.test")}`
    ),
    p_cooldown_bucket: calls[0].p_cooldown_bucket,
  })
})

test("email admission preserves rate-limit errors and fails closed without its migration", async () => {
  const input = {
    email: "person@example.test",
    customerId: "customer-1",
    flow: "verification",
  }
  await assert.rejects(
    enforceCustomerEmailOtpAdmission(input, async () => ({
      error: { message: "Rate limit exceeded" },
    })),
    RateLimitError
  )
  await assert.rejects(
    enforceCustomerEmailOtpAdmission(input, async () => ({
      error: { message: "function missing" },
    })),
    /Unable to enforce customer email admission/
  )
})
