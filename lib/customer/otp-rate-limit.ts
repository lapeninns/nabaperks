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
  enforceRateLimit,
  rateLimitBucketHash,
} from "@/lib/security/rate-limit"
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

export async function enforceCustomerOtpVerifyRateLimit({
  phone,
  requestIdentity,
}: CustomerOtpRateLimitInput): Promise<void> {
  await enforceRateLimit({
    key: customerOtpVerifyPhoneRateLimitKey(phone),
    limit: customerOtpVerifyRateLimit,
    windowMs: customerOtpRateLimitWindowMs,
  })
  await enforceRateLimit({
    key: customerOtpVerifyIdentityRateLimitKey(requestIdentity),
    limit: customerOtpVerifyRateLimit,
    windowMs: customerOtpRateLimitWindowMs,
  })
}
