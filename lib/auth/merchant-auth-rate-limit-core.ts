export type MerchantAuthRateLimitScope =
  "merchant-signup" | "merchant-signin" | "merchant-verify"

export type MerchantAuthRateLimitConfig = Readonly<{
  key: string
  limit: number
  windowMs: number
}>

const AUTH_WINDOW_MS = 15 * 60_000

export function merchantAuthRateLimitConfigs(
  scope: MerchantAuthRateLimitScope,
  email: string,
  requestIdentity: string
): readonly MerchantAuthRateLimitConfig[] {
  const normalizedEmail = email.trim().toLowerCase()
  const normalizedIdentity = requestIdentity.trim() || "unknown"
  const source = {
    key: `${scope}:${normalizedEmail}:${normalizedIdentity}`,
    limit: scope === "merchant-signup" ? 3 : 5,
    windowMs: AUTH_WINDOW_MS,
  }

  if (scope !== "merchant-signin") return [source]

  return [
    source,
    {
      key: `merchant-signin:${normalizedEmail}:account-window`,
      limit: 5,
      windowMs: AUTH_WINDOW_MS,
    },
  ]
}
