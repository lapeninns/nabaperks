import { createHmac } from "node:crypto"

/**
 * Derive the recovery-code digest held in the pending-recovery cookie.
 *
 * This lives outside `access-continuity.ts` because that module is
 * `server-only`: end-to-end fixtures need the real derivation so a regression
 * here fails them, and they run in plain Node rather than the Next bundler.
 * The secret is passed in for the same reason.
 */
export function customerAccessRecoveryCodeHmac({
  customerId,
  deviceHash,
  email,
  code,
  secret,
}: {
  customerId: string
  deviceHash: string
  email: string
  code: string
  secret: string
}): string {
  return createHmac("sha256", secret)
    .update("nabaperks:customer-access-recovery:v1")
    .update("\0")
    .update(customerId)
    .update("\0")
    .update(deviceHash)
    .update("\0")
    .update(email.trim().toLowerCase())
    .update("\0")
    .update(code)
    .digest("hex")
}
