export const customerOtpRateLimitWindowMs = 15 * 60_000
export const customerOtpSendRateLimit = 5
export const customerOtpVerifyRateLimit = 5

function canonicalRateLimitSubject(subject: string): string {
  return subject.trim().toLowerCase()
}

export function customerOtpSendPhoneRateLimitKey(phone: string): string {
  return `customer-otp:send:phone:${canonicalRateLimitSubject(phone)}`
}

export function customerOtpSendIdentityRateLimitKey(
  phone: string,
  requestIdentity: string
): string {
  return `customer-otp:send:identity:${canonicalRateLimitSubject(phone)}:${requestIdentity}`
}

export function customerOtpVerifyPhoneRateLimitKey(phone: string): string {
  return `customer-otp:verify:phone:${canonicalRateLimitSubject(phone)}`
}

export function customerOtpVerifyIdentityRateLimitKey(
  phone: string,
  requestIdentity: string
): string {
  return `customer-otp:verify:identity:${canonicalRateLimitSubject(phone)}:${requestIdentity}`
}
