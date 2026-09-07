import "server-only"

import {
  customerOtpRateLimitWindowMs,
  customerOtpSendIpRateLimitKey,
  customerOtpSendIdentityRateLimitKey,
  customerOtpSendPhoneRateLimitKey,
  customerOtpVerifyIdentityRateLimitKey,
  customerOtpVerifyPhoneRateLimitKey,
  customerOtpVerifyRateLimit,
  type CustomerOtpDispatchScope,
} from "@/lib/customer/otp-rate-limit-core"
import { customerPhoneHmac } from "@/lib/customer/phone-pii"
import { logger } from "@/lib/observability/logger"
import {
  RateLimitError,
  enforceRateLimit,
  rateLimitBucketHash,
} from "@/lib/security/rate-limit"
import { isMissingRpcError } from "@/lib/supabase/missing-rpc"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

type CustomerOtpRateLimitInput = {
  readonly phone: string
  readonly requestIdentity: string
}

type CustomerOtpSendRateLimitInput = CustomerOtpRateLimitInput & {
  readonly deviceHash: string | null
  readonly trustedIp: string
  /** Closed set, chosen by the server action — never caller-supplied. */
  readonly scope: CustomerOtpDispatchScope
}

export async function enforceCustomerOtpSendRateLimit({
  phone,
  requestIdentity,
  trustedIp,
  scope,
  deviceHash,
}: CustomerOtpSendRateLimitInput): Promise<boolean> {
  const supabase = createSupabaseServiceRoleClient()
  const { error } = await supabase.rpc("admit_customer_otp_dispatch", {
    p_scope: scope,
    p_phone_bucket: rateLimitBucketHash(
      customerOtpSendPhoneRateLimitKey(phone)
    ),
    p_identity_bucket: rateLimitBucketHash(
      customerOtpSendIdentityRateLimitKey(requestIdentity)
    ),
    p_ip_bucket: rateLimitBucketHash(customerOtpSendIpRateLimitKey(trustedIp)),
    p_phone_hmac: customerPhoneHmac(phone),
    p_device_hash: deviceHash,
  })

  if (!error) return true

  if (/rate limit exceeded/i.test(error.message)) {
    logger.warn("customer_otp_dispatch_capacity_exhausted", {
      scope,
    })
    return false
  }

  throw new Error(`Unable to enforce customer OTP admission: ${error.message}`)
}

/**
 * Limit OTP guesses per phone and per request identity. Both buckets are
 * debited inside one RPC transaction (`admit_customer_otp_verify`), so a
 * rejection by either rolls back the other's debit. The limits live in the
 * migration; the constants imported here feed only the one-release fallback
 * and are pinned to the SQL by contract test.
 */
export async function enforceCustomerOtpVerifyRateLimit({
  phone,
  requestIdentity,
}: CustomerOtpRateLimitInput): Promise<void> {
  const phoneKey = customerOtpVerifyPhoneRateLimitKey(phone)
  const identityKey = customerOtpVerifyIdentityRateLimitKey(requestIdentity)
  const supabase = createSupabaseServiceRoleClient()
  const { error } = await supabase.rpc("admit_customer_otp_verify", {
    p_phone_bucket: rateLimitBucketHash(phoneKey),
    p_identity_bucket: rateLimitBucketHash(identityKey),
  })

  if (!error) return

  if (/rate limit exceeded/i.test(error.message)) {
    throw new RateLimitError()
  }

  if (isMissingRpcError(error)) {
    // App deployed ahead of the migration: keep the previous shape for one
    // release instead of failing every OTP check.
    await enforceRateLimit({
      key: phoneKey,
      limit: customerOtpVerifyRateLimit,
      windowMs: customerOtpRateLimitWindowMs,
    })
    await enforceRateLimit({
      key: identityKey,
      limit: customerOtpVerifyRateLimit,
      windowMs: customerOtpRateLimitWindowMs,
    })
    return
  }

  throw new Error(
    `Unable to enforce customer OTP verify admission: ${error.message}`
  )
}
