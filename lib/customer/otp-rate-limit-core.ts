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
