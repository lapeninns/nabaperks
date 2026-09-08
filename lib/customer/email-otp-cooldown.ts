import "server-only"

import { enforceRateLimit } from "@/lib/security/rate-limit"

/** One recipient cannot receive fresh customer codes from either flow in a burst. */
export async function enforceCustomerEmailOtpCooldown(
  email: string,
  enforce = enforceRateLimit
): Promise<void> {
  // enforceRateLimit hashes the complete key before it reaches persistence.
  await enforce({
    key: `customer-email-otp:cooldown:${email.trim().toLowerCase()}`,
    limit: 1,
    windowMs: 60_000,
  })
}
