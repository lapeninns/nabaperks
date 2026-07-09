import {
  enforceRateLimit,
  peekRateLimit,
  RateLimitError,
} from "@/lib/security/rate-limit"

export const MERCHANT_OTP_RESEND_COOLDOWN_MS = 60_000
export const MERCHANT_OTP_RESEND_WINDOW_MS = 15 * 60_000
export const MERCHANT_OTP_RESEND_WINDOW_LIMIT = 5

export type MerchantOtpResendPurpose = "signup" | "recovery"

export type MerchantOtpResendInput = Readonly<{
  email: string
  purpose: MerchantOtpResendPurpose
  requestIdentity: string
}>

type RateLimitConfig = Readonly<{
  key: string
  limit: number
  windowMs: number
}>

type RateLimitUsage = Readonly<{
  used: number
  limit: number
  remaining: number
  windowMs: number
  resetAt: string | null
}>

export type MerchantOtpResendDependencies = Readonly<{
  enforceRateLimit: (config: RateLimitConfig) => Promise<unknown>
  peekRateLimit: (config: RateLimitConfig) => Promise<RateLimitUsage>
}>

const defaultDependencies: MerchantOtpResendDependencies = {
  enforceRateLimit,
  peekRateLimit,
}

export class MerchantOtpResendRateLimitError extends RateLimitError {
  readonly retryAt: string | undefined

  constructor(retryAt?: string) {
    super("Too many code sends. Wait before requesting another email.")
    this.name = "MerchantOtpResendRateLimitError"
    this.retryAt = retryAt
  }
}

export function merchantOtpResendKeys({
  email,
  purpose,
  requestIdentity,
}: MerchantOtpResendInput) {
  const normalizedEmail = email.trim().toLowerCase()
  const identity = requestIdentity.trim() || "unknown"
  const scope = `merchant-otp-resend:${purpose}:${normalizedEmail}:${identity}`

  return {
    cooldown: `${scope}:cooldown`,
    window: `${scope}:window`,
  } as const
}

export async function enforceMerchantOtpResend(
  input: MerchantOtpResendInput,
  dependencies: MerchantOtpResendDependencies = defaultDependencies
): Promise<{ retryAt: string | undefined }> {
  const keys = merchantOtpResendKeys(input)
  const cooldown = cooldownConfig(keys.cooldown)
  const window = windowConfig(keys.window)
  const configs = [cooldown, window]

  const blockedUntil = await latestActiveResetAt(configs, dependencies)
  if (blockedUntil) {
    throw new MerchantOtpResendRateLimitError(blockedUntil)
  }

  await enforceWithDurableReadback(cooldown, configs, dependencies)
  await enforceWithDurableReadback(window, configs, dependencies)

  return {
    retryAt: await activeResetAt(cooldown, dependencies),
  }
}

export async function recordInitialSignupOtpCooldown(
  input: MerchantOtpResendInput,
  dependencies: MerchantOtpResendDependencies = defaultDependencies
): Promise<{ retryAt: string | undefined }> {
  const cooldown = cooldownConfig(merchantOtpResendKeys(input).cooldown)

  try {
    await dependencies.enforceRateLimit(cooldown)
  } catch (error) {
    // The provider send already succeeded. If another request established the
    // same cooldown first, preserve its durable reset instead of turning that
    // successful delivery into an apparent failure.
    if (!(error instanceof RateLimitError)) throw error
  }

  return {
    retryAt: await activeResetAt(cooldown, dependencies),
  }
}

export async function readMerchantOtpResendCooldown(
  input: MerchantOtpResendInput,
  dependencies: MerchantOtpResendDependencies = defaultDependencies
): Promise<string | undefined> {
  const keys = merchantOtpResendKeys(input)
  return latestActiveResetAt(
    [cooldownConfig(keys.cooldown), windowConfig(keys.window)],
    dependencies
  )
}

async function enforceWithDurableReadback(
  config: RateLimitConfig,
  relatedConfigs: readonly RateLimitConfig[],
  dependencies: MerchantOtpResendDependencies
) {
  try {
    await dependencies.enforceRateLimit(config)
  } catch (error) {
    if (!(error instanceof RateLimitError)) throw error

    throw new MerchantOtpResendRateLimitError(
      await latestActiveResetAt(relatedConfigs, dependencies)
    )
  }
}

async function latestActiveResetAt(
  configs: readonly RateLimitConfig[],
  dependencies: MerchantOtpResendDependencies
): Promise<string | undefined> {
  const retryTimes = (
    await Promise.all(
      configs.map((config) => activeResetAt(config, dependencies))
    )
  )
    .map((retryAt) => (retryAt ? Date.parse(retryAt) : Number.NaN))
    .filter(Number.isFinite)

  if (retryTimes.length === 0) return undefined
  return new Date(Math.max(...retryTimes)).toISOString()
}

async function activeResetAt(
  config: RateLimitConfig,
  dependencies: MerchantOtpResendDependencies
) {
  const usage = await dependencies.peekRateLimit(config)
  return usage.remaining === 0 ? (usage.resetAt ?? undefined) : undefined
}

function cooldownConfig(key: string): RateLimitConfig {
  return {
    key,
    limit: 1,
    windowMs: MERCHANT_OTP_RESEND_COOLDOWN_MS,
  }
}

function windowConfig(key: string): RateLimitConfig {
  return {
    key,
    limit: MERCHANT_OTP_RESEND_WINDOW_LIMIT,
    windowMs: MERCHANT_OTP_RESEND_WINDOW_MS,
  }
}
