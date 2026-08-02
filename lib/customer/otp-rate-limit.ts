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
  customerOtpDispatchBurstLimit,
  customerOtpDispatchBurstRateLimitKey,
  customerOtpDispatchBurstWindowMs,
  customerOtpDispatchSustainedLimit,
  customerOtpDispatchSustainedRateLimitKey,
  customerOtpDispatchSustainedWindowMs,
  type CustomerOtpDispatchScope,
} from "@/lib/customer/otp-rate-limit-core"
import { enforceRateLimit } from "@/lib/security/rate-limit"

type CustomerOtpRateLimitInput = {
  readonly phone: string
  readonly requestIdentity: string
}

type CustomerOtpSendRateLimitInput = CustomerOtpRateLimitInput & {
  readonly trustedIp: string
  /** Closed set, chosen by the server action — never caller-supplied. */
  readonly scope: CustomerOtpDispatchScope
}

export async function enforceCustomerOtpSendRateLimit({
  phone,
  requestIdentity,
  trustedIp,
  scope,
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

  // Debited LAST, and narrowest-subject-first above it. Each enforce is its own
  // transaction, so a bucket consumed before a later rejection stays consumed —
  // putting the shared platform budget last means a request some narrower
  // bucket was already going to refuse can never burn budget on its way out.
  await enforceRateLimit({
    key: customerOtpDispatchBurstRateLimitKey(scope),
    limit: customerOtpDispatchBurstLimit,
    windowMs: customerOtpDispatchBurstWindowMs,
  })
  await enforceRateLimit({
    key: customerOtpDispatchSustainedRateLimitKey(scope),
    limit: customerOtpDispatchSustainedLimit,
    windowMs: customerOtpDispatchSustainedWindowMs,
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
