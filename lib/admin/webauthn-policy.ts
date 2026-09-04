export const ADMIN_MFA_APPLICATION_ORIGIN = "https://nabaperks.com"
export const ADMIN_MFA_BOOTSTRAP_ORIGIN = "https://mfa.nabaperks.com"
export const ADMIN_MFA_RP_ID = "nabaperks.com"

export function resolveAdminWebAuthnContext(currentOrigin: string) {
  const allowedOrigins = new Set([
    ADMIN_MFA_APPLICATION_ORIGIN,
    ADMIN_MFA_BOOTSTRAP_ORIGIN,
  ])

  if (!allowedOrigins.has(currentOrigin)) {
    throw new Error(
      "Administrator security setup is only available on an approved application origin."
    )
  }

  return {
    rpId: ADMIN_MFA_RP_ID,
    rpOrigins: [...allowedOrigins],
  }
}
