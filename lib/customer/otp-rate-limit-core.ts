export const customerOtpRateLimitWindowMs = 15 * 60_000
export const customerOtpSendRateLimit = 5
export const customerOtpVerifyRateLimit = 5
export const customerOtpIdentitySendWindowMs = 24 * 60 * 60_000
export const customerOtpIdentitySendRateLimit = 10
export const customerOtpIpSendWindowMs = 24 * 60 * 60_000
export const customerOtpIpSendRateLimit = 30

function canonicalRateLimitSubject(subject: string): string {
  return subject.trim().toLowerCase()
}

export function customerOtpSendPhoneRateLimitKey(phone: string): string {
  return `customer-otp:send:phone:${canonicalRateLimitSubject(phone)}`
}

export function customerOtpSendIdentityRateLimitKey(
  requestIdentity: string
): string {
  return `customer-otp:send:identity:${requestIdentity}`
}

export function customerOtpSendIpRateLimitKey(trustedIp: string): string {
  return `customer-otp:send:ip:${canonicalRateLimitSubject(trustedIp)}`
}

export function customerOtpVerifyPhoneRateLimitKey(phone: string): string {
  return `customer-otp:verify:phone:${canonicalRateLimitSubject(phone)}`
}

export function customerOtpVerifyIdentityRateLimitKey(
  requestIdentity: string
): string {
  return `customer-otp:verify:identity:${requestIdentity}`
}

/**
 * The dispatch budget: the only OTP ceiling whose key a caller cannot rotate.
 *
 * Every other bucket is keyed on a subject the sender controls — phone, device
 * hash, source IP — so a distributed sender simply varies them and the platform
 * pays for unbounded SMS. The scope here comes from a closed set chosen by the
 * server action, never from a header, cookie or form field.
 *
 * Burst blunts a spike; sustained bounds the hour. A one-hour sustained window
 * is deliberate: a saturated budget must self-heal without an operator, so the
 * blast radius of a successful exhaustion attempt is an hour of degraded
 * sign-in rather than a day of it.
 */
export type CustomerOtpDispatchScope = "wallet" | "join"

export const customerOtpDispatchBurstWindowMs = 60_000
export const customerOtpDispatchBurstLimit = 30
export const customerOtpDispatchSustainedWindowMs = 60 * 60_000
export const customerOtpDispatchSustainedLimit = 150

export function customerOtpDispatchBurstRateLimitKey(
  scope: CustomerOtpDispatchScope
): string {
  return `customer-otp:send:dispatch-budget:${scope}:burst`
}

export function customerOtpDispatchSustainedRateLimitKey(
  scope: CustomerOtpDispatchScope
): string {
  return `customer-otp:send:dispatch-budget:${scope}:sustained`
}
