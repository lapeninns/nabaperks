import {
  enforceRateLimit,
  peekRateLimit,
  RateLimitError,
} from "@/lib/security/rate-limit"

export const MERCHANT_OTP_RESEND_COOLDOWN_MS = 60_000
export const MERCHANT_OTP_RESEND_WINDOW_MS = 15 * 60_000
export const MERCHANT_OTP_RESEND_WINDOW_LIMIT = 5
// Deliberately independent of requestIdentity: rotating source IPs must not buy
// a fresh send allowance against the same mailbox.
export const MERCHANT_OTP_RESEND_RECIPIENT_WINDOW_LIMIT = 5

export type MerchantOtpResendPurpose = "signup" | "signin"

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
  const recipientScope = `merchant-otp-resend:${purpose}:${normalizedEmail}`
  const scope = `${recipientScope}:${identity}`

  // The source-scoped keys keep their exact previous strings, so live buckets
  // are not orphaned on deploy. The recipient key ends in `:recipient-window`
  // (hyphen, not colon), so no identity value can collide with a source key.
  return {
    cooldown: `${scope}:cooldown`,
    window: `${scope}:window`,
    recipientWindow: `${recipientScope}:recipient-window`,
  } as const
}

export async function enforceMerchantOtpResend(
  input: MerchantOtpResendInput,
  dependencies: MerchantOtpResendDependencies = defaultDependencies
): Promise<{ retryAt: string | undefined }> {
  const keys = merchantOtpResendKeys(input)
  const cooldown = cooldownConfig(keys.cooldown)
  const window = windowConfig(keys.window)
  const recipientWindow = recipientWindowConfig(keys.recipientWindow)
  const configs = [cooldown, window, recipientWindow]

  const blockedUntil = await latestActiveResetAt(configs, dependencies)
  if (blockedUntil) {
    throw new MerchantOtpResendRateLimitError(blockedUntil)
  }

  // Per-source buckets first, the shared recipient budget LAST: each enforce is
  // its own transaction, so a request the cooldown was going to refuse must not
  // spend the mailbox's budget on its way to being told no.
  await enforceWithDurableReadback(cooldown, configs, dependencies)
  await enforceWithDurableReadback(window, configs, dependencies)
  await enforceWithDurableReadback(recipientWindow, configs, dependencies)

  return {
    // Across all three, so the send that exhausts the recipient window reports
    // the true 15-minute wait rather than the 60-second cooldown.
    retryAt: await latestActiveResetAt(configs, dependencies),
  }
}

/**
 * Gate the FIRST signup email against the recipient budget.
 *
 * recordInitialSignupOtpCooldown runs after the provider send, so it records
 * the debit but cannot prevent the message. Without this, the first email to
 * any mailbox bypassed the recipient cap entirely and rotating source IPs still
 * bought one free send each.
 */
export async function enforceInitialSignupRecipientBudget(
  input: MerchantOtpResendInput,
  dependencies: MerchantOtpResendDependencies = defaultDependencies
): Promise<void> {
  const recipientWindow = recipientWindowConfig(
    merchantOtpResendKeys(input).recipientWindow
  )

  const blockedUntil = await activeResetAt(recipientWindow, dependencies)
  if (blockedUntil) {
    throw new MerchantOtpResendRateLimitError(blockedUntil)
  }

  await dependencies.enforceRateLimit(recipientWindow)
}

export async function recordInitialSignupOtpCooldown(
  input: MerchantOtpResendInput,
  dependencies: MerchantOtpResendDependencies = defaultDependencies
): Promise<{ retryAt: string | undefined }> {
  const keys = merchantOtpResendKeys(input)
  const cooldown = cooldownConfig(keys.cooldown)

  try {
    // The recipient budget was already debited BEFORE the send by
    // enforceInitialSignupRecipientBudget; debiting again here would charge the
    // mailbox twice for one message.
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
    [
      cooldownConfig(keys.cooldown),
      windowConfig(keys.window),
      recipientWindowConfig(keys.recipientWindow),
    ],
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

function recipientWindowConfig(key: string): RateLimitConfig {
  return {
    key,
    limit: MERCHANT_OTP_RESEND_RECIPIENT_WINDOW_LIMIT,
    windowMs: MERCHANT_OTP_RESEND_WINDOW_MS,
  }
}
