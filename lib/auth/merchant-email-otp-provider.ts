export type MerchantOtpProviderOutcome =
  | "expired"
  | "rejected"
  | "retryable"
  | "verified"

type MerchantOtpProviderFinalizeOutcome = Exclude<
  MerchantOtpProviderOutcome,
  "retryable"
>

type CleanupStage = "finalize" | "release"

type MerchantOtpProviderVerificationInput = {
  readonly finalize: (
    outcome: MerchantOtpProviderFinalizeOutcome
  ) => Promise<boolean>
  readonly onCleanupError?: (stage: CleanupStage, error: Error) => void
  readonly release: () => Promise<boolean>
  readonly verify: () => Promise<{ readonly error: unknown }>
}

type MerchantOtpAliasDelivery = {
  readonly aliasCode: string
  readonly aliasId: string
}

type MerchantOtpDeliveryInput = {
  readonly createAlias: () => Promise<MerchantOtpAliasDelivery>
  readonly onRevocationError?: (aliasId: string, error: Error) => void
  readonly revokeAlias: (aliasId: string) => Promise<boolean>
  readonly sendAlias: (aliasCode: string) => Promise<void>
}

/**
 * Email delivery owns the alias it creates. If the provider does not accept
 * that email, revoke that exact row without touching a different-purpose or
 * newer alias.
 */
export async function runMerchantOtpDelivery({
  createAlias,
  onRevocationError,
  revokeAlias,
  sendAlias,
}: MerchantOtpDeliveryInput): Promise<MerchantOtpAliasDelivery> {
  const alias = await createAlias()

  try {
    await sendAlias(alias.aliasCode)
    return alias
  } catch (deliveryError) {
    try {
      const revoked = await revokeAlias(alias.aliasId)
      if (!revoked) {
        onRevocationError?.(
          alias.aliasId,
          new Error("Merchant OTP alias was no longer live during revocation.")
        )
      }
    } catch (revocationError) {
      onRevocationError?.(
        alias.aliasId,
        revocationError instanceof Error
          ? revocationError
          : new Error("Unknown OTP revocation error")
      )
    }

    throw deliveryError
  }
}

/**
 * Provider verification is the authentication authority; alias cleanup is a
 * best-effort security transition around it. This orchestrator keeps that
 * ordering explicit and unit-testable without importing server-only actions.
 */
export async function runMerchantOtpProviderVerification({
  finalize,
  onCleanupError,
  release,
  verify,
}: MerchantOtpProviderVerificationInput): Promise<MerchantOtpProviderOutcome> {
  let error: unknown = null
  let threw = false

  try {
    error = (await verify()).error
  } catch (caught) {
    error = caught
    threw = true
  }

  const outcome = classifyMerchantOtpProviderOutcome(error, threw)

  if (outcome === "retryable") {
    await runCleanup("release", release, onCleanupError)
    return outcome
  }

  await runCleanup("finalize", () => finalize(outcome), onCleanupError)
  return outcome
}

export function classifyMerchantOtpProviderOutcome(
  error: unknown,
  threw: boolean
): MerchantOtpProviderOutcome {
  if (error == null) return "verified"
  if (threw) return "retryable"

  const code = stringProperty(error, "code")
  if (code === "otp_expired") return "expired"

  const status = numberProperty(error, "status")
  const name = stringProperty(error, "name")
  if (
    name === "AuthRetryableFetchError" ||
    name === "AuthUnknownError" ||
    status === 408 ||
    status === 429 ||
    (status !== null && status >= 500) ||
    RETRYABLE_PROVIDER_CODES.has(code ?? "")
  ) {
    return "retryable"
  }

  if (DEFINITIVE_PROVIDER_REJECTION_CODES.has(code ?? "")) {
    return "rejected"
  }

  // Preserve the code for unknown and future provider failures. Only an
  // explicit definitive rejection may destroy a valid alias.
  return "retryable"
}

const RETRYABLE_PROVIDER_CODES = new Set([
  "hook_timeout",
  "hook_timeout_after_retry",
  "over_email_send_rate_limit",
  "over_request_rate_limit",
  "over_sms_send_rate_limit",
  "request_timeout",
  "unexpected_failure",
])

const DEFINITIVE_PROVIDER_REJECTION_CODES = new Set([
  "invalid_credentials",
  "user_not_found",
])

async function runCleanup(
  stage: CleanupStage,
  operation: () => Promise<boolean>,
  onCleanupError?: (stage: CleanupStage, error: Error) => void
) {
  try {
    const completed = await operation()
    if (!completed) {
      onCleanupError?.(
        stage,
        new Error(`Merchant OTP ${stage} no longer matched the current lease.`)
      )
    }
  } catch (error) {
    onCleanupError?.(
      stage,
      error instanceof Error ? error : new Error("Unknown OTP cleanup error")
    )
  }
}

function stringProperty(value: unknown, key: string) {
  if (!value || typeof value !== "object" || !(key in value)) return null
  const candidate = value[key as keyof typeof value]
  return typeof candidate === "string" ? candidate : null
}

function numberProperty(value: unknown, key: string) {
  if (!value || typeof value !== "object" || !(key in value)) return null
  const candidate = value[key as keyof typeof value]
  return typeof candidate === "number" ? candidate : null
}
