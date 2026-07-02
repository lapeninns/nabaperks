import "server-only"

import {
  customerOtpRateLimitWindowMs,
  customerOtpSendIdentityRateLimitKey,
  customerOtpSendPhoneRateLimitKey,
  customerOtpSendRateLimit,
  customerOtpVerifyIdentityRateLimitKey,
  customerOtpVerifyPhoneRateLimitKey,
  customerOtpVerifyRateLimit,
} from "@/lib/customer/otp-rate-limit-core"
import { enforceRateLimit } from "@/lib/security/rate-limit"

type CustomerOtpRateLimitInput = {
  readonly phone: string
  readonly requestIdentity: string
}

export async function enforceCustomerOtpSendRateLimit({
  phone,
  requestIdentity,
}: CustomerOtpRateLimitInput): Promise<void> {
  await enforceRateLimit({
    key: customerOtpSendPhoneRateLimitKey(phone),
    limit: customerOtpSendRateLimit,
    windowMs: customerOtpRateLimitWindowMs,
  })
  await enforceRateLimit({
    key: customerOtpSendIdentityRateLimitKey(phone, requestIdentity),
    limit: customerOtpSendRateLimit,
    windowMs: customerOtpRateLimitWindowMs,
  })
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
    key: customerOtpVerifyIdentityRateLimitKey(phone, requestIdentity),
    limit: customerOtpVerifyRateLimit,
    windowMs: customerOtpRateLimitWindowMs,
  })
}
