import "server-only"

import {
  customerOtpRateLimitWindowMs,
  customerOtpIdentitySendRateLimit,
  customerOtpIdentitySendWindowMs,
  customerOtpIpSendRateLimit,
  customerOtpSendIpRateLimitKey,
  customerOtpIpSendWindowMs,
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

type CustomerOtpSendRateLimitInput = CustomerOtpRateLimitInput & {
  readonly trustedIp: string
}

export async function enforceCustomerOtpSendRateLimit({
  phone,
  requestIdentity,
  trustedIp,
}: CustomerOtpSendRateLimitInput): Promise<void> {
  await enforceRateLimit({
    key: customerOtpSendIpRateLimitKey(trustedIp),
    limit: customerOtpIpSendRateLimit,
    windowMs: customerOtpIpSendWindowMs,
  })
  await enforceRateLimit({
    key: customerOtpSendIdentityRateLimitKey(requestIdentity),
    limit: customerOtpIdentitySendRateLimit,
    windowMs: customerOtpIdentitySendWindowMs,
  })
  await enforceRateLimit({
    key: customerOtpSendPhoneRateLimitKey(phone),
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
    key: customerOtpVerifyIdentityRateLimitKey(requestIdentity),
    limit: customerOtpVerifyRateLimit,
    windowMs: customerOtpRateLimitWindowMs,
  })
}
