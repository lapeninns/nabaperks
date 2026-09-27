/**
 * The local-development code shortcut, shared by the phone and email sign-in
 * paths. Pure (no `server-only`, no imports) so the refusal outside local
 * development unit-tests directly.
 *
 * "Local" means NODE_ENV is not production AND the process is not a Vercel
 * preview or production deployment. A preview build runs with NODE_ENV set to
 * production anyway, but the explicit VERCEL_ENV check keeps a preview from
 * ever honouring a configured dev code even if that ever changes.
 */

type Env = Record<string, string | undefined>

export function isLocalDevelopment(env: Env = process.env): boolean {
  return (
    env.NODE_ENV !== "production" &&
    env.VERCEL_ENV !== "preview" &&
    env.VERCEL_ENV !== "production"
  )
}

/** The configured dev code, only when running locally; otherwise null. */
export function localDevOtpCode(env: Env = process.env): string | null {
  if (!isLocalDevelopment(env)) return null
  const code = env.CUSTOMER_DEV_OTP_CODE?.trim()
  return code ? code : null
}

/** True when a local dev code is configured, so no real message is sent. */
export function isLocalDevOtpConfigured(env: Env = process.env): boolean {
  return localDevOtpCode(env) !== null
}

/** True only for the configured local dev code, and never outside local. */
export function approvedLocalDevOtp(
  code: string,
  env: Env = process.env
): boolean {
  const devCode = localDevOtpCode(env)
  return devCode !== null && code === devCode
}
