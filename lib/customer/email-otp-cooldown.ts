import "server-only"

import { customerEmailHmac } from "@/lib/customer/email-pii-core"
import { RateLimitError, rateLimitBucketHash } from "@/lib/security/rate-limit"

type EmailOtpAdmissionInput = {
  email: string
  customerId: string
  flow: "verification" | "recovery"
}

type AdmissionBuckets = {
  p_customer_bucket: string
  p_recipient_bucket: string
  p_cooldown_bucket: string
}

async function admitEmailOtp(buckets: AdmissionBuckets) {
  const { createSupabaseServiceRoleClient } =
    await import("@/lib/supabase/server")
  return createSupabaseServiceRoleClient().rpc(
    "admit_customer_email_otp_send",
    buckets
  )
}

/** All send limits commit together; a rejection never spends another quota. */
export async function enforceCustomerEmailOtpAdmission(
  { email, customerId, flow }: EmailOtpAdmissionInput,
  admit = admitEmailOtp
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase()
  const prefix =
    flow === "verification"
      ? "customer-email-verification-send"
      : "customer-access-recovery-send"
  const recipient =
    flow === "verification"
      ? normalizedEmail
      : customerEmailHmac(normalizedEmail)
  // Preserve the deployed bucket identities and hash before persistence.
  const { error } = await admit({
    p_customer_bucket: rateLimitBucketHash(`${prefix}:customer:${customerId}`),
    p_recipient_bucket: rateLimitBucketHash(`${prefix}:${recipient}`),
    p_cooldown_bucket: rateLimitBucketHash(
      `customer-email-otp:cooldown:${normalizedEmail}`
    ),
  })
  if (!error) return
  if (/rate limit exceeded/i.test(error.message)) throw new RateLimitError()
  throw new Error(
    `Unable to enforce customer email admission: ${error.message}`
  )
}
