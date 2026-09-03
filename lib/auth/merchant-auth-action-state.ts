export const MERCHANT_OTP_OUTCOMES = [
  "idle",
  "invalid",
  "expired",
  "used",
  "superseded",
  "busy",
  "throttled",
  "verification_unavailable",
  "delivery_unavailable",
  "sent",
  "verification_required",
] as const

export type MerchantOtpOutcome = (typeof MERCHANT_OTP_OUTCOMES)[number]
export type MerchantOtpFlow = "signup" | "signin"
export type MerchantOtpStep = "request" | "verify"

export type MerchantOtpActionContext = Readonly<{
  flow: MerchantOtpFlow
  step: MerchantOtpStep
  email: string
  name?: string
  next: string
}>

export type MerchantOtpActionErrors = Readonly<{
  email?: string
  otp?: string
  form?: string
}>

/**
 * Safe, serializable state shared by the merchant OTP server actions and forms.
 * Secret input values deliberately have no place in this contract.
 */
export type MerchantOtpActionState = Readonly<{
  outcome: MerchantOtpOutcome
  context: MerchantOtpActionContext
  errors?: MerchantOtpActionErrors
  message?: string
  retryAt?: string
}>

export type MerchantOtpFocusTarget = "otp" | "recovery" | null

const MAX_MERCHANT_OTP_RETRY_WINDOW_MS = 15 * 60_000

export function merchantOtpInitialState(
  context: MerchantOtpActionContext
): MerchantOtpActionState {
  return {
    outcome: "idle",
    context: { ...context },
  }
}

export function merchantOtpFocusTarget(
  outcome: MerchantOtpOutcome
): MerchantOtpFocusTarget {
  switch (outcome) {
    case "invalid":
    case "sent":
      return "otp"
    case "expired":
    case "used":
    case "superseded":
    case "busy":
    case "throttled":
    case "delivery_unavailable":
    case "verification_unavailable":
    case "verification_required":
      return "recovery"
    case "idle":
      return null
  }
}

export function merchantOtpRequiresFreshCode(
  outcome: MerchantOtpOutcome
): boolean {
  switch (outcome) {
    case "expired":
    case "used":
    case "superseded":
    case "delivery_unavailable":
    case "verification_required":
      return true
    case "idle":
    case "invalid":
    case "busy":
    case "throttled":
    case "verification_unavailable":
    case "sent":
      return false
  }
}

export function merchantOtpFreshCodeRequiredAfter(
  currentlyRequired: boolean,
  outcome: MerchantOtpOutcome
): boolean {
  if (outcome === "sent") return false
  if (merchantOtpRequiresFreshCode(outcome)) return true
  return currentlyRequired
}

export function normalizeMerchantOtpRetryAt(
  retryAt: string | null | undefined,
  now = Date.now()
): string | undefined {
  if (!retryAt || !Number.isFinite(now)) return undefined

  const retryAtMs = Date.parse(retryAt)
  if (!Number.isFinite(retryAtMs)) return undefined
  if (retryAtMs <= now) return undefined
  if (retryAtMs - now > MAX_MERCHANT_OTP_RETRY_WINDOW_MS) return undefined

  return new Date(retryAtMs).toISOString()
}

export function merchantOtpRetryCountdown(
  retryAt: string | null | undefined,
  now = Date.now()
): Readonly<{ active: boolean; remainingSeconds: number }> {
  const normalizedRetryAt = normalizeMerchantOtpRetryAt(retryAt, now)
  if (!normalizedRetryAt) {
    return { active: false, remainingSeconds: 0 }
  }

  return {
    active: true,
    remainingSeconds: Math.ceil((Date.parse(normalizedRetryAt) - now) / 1_000),
  }
}
