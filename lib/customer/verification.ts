import "server-only"

import {
  alternateOtpChannel,
  type OtpChannel,
} from "@/lib/customer/otp-channel-core"
import { logger } from "@/lib/observability/logger"

type VerificationStartResult =
  | { readonly status: "sent"; readonly channel: OtpChannel }
  | { readonly status: "unavailable" }
type VerificationCheckResult = {
  readonly status: "approved" | "rejected" | "unavailable"
}
type VerifyOperation = "VerificationCheck" | "Verifications"
type TwilioVerifyConfig = {
  readonly username: string
  readonly password: string
  readonly serviceSid: string
}
type TwilioVerifyConfigResult =
  | { readonly ok: true; readonly config: TwilioVerifyConfig }
  | {
      readonly ok: false
      readonly reason: "missing_credentials" | "missing_service"
    }
type ProviderFailureCategory =
  | "missing_credentials"
  | "missing_service"
  | "timeout"
  | "network"
  | "rate_limited"
  | "upstream"
  | "provider_rejected_request"
  | "malformed_response"
type ProviderResult =
  | { readonly ok: true; readonly status: string }
  | { readonly ok: false; readonly category: ProviderFailureCategory }

const verifyBaseUrl = "https://verify.twilio.com/v2/Services"
const anyFourDigitBypassMode = "any-4-digits"
const providerTimeoutMs = 8_000

/**
 * Send the code on `channel`. When the provider rejects the request itself
 * (a 4xx that is not a rate limit — for WhatsApp, typically a number with no
 * WhatsApp account), the code goes out on the other channel instead, and the
 * result names the channel that actually carried it so the code step can say
 * where to look. Outages (timeouts, 5xx, missing config) are not retried on
 * the other channel: they are the provider being down, not the channel.
 */
export async function startCustomerPhoneVerification(
  phone: string,
  channel: OtpChannel = "sms"
): Promise<VerificationStartResult> {
  if (isAnyFourDigitOtpBypassEnabled() || isDevOtpConfigured()) {
    return { status: "sent", channel }
  }

  const result = await postVerifyForm("Verifications", {
    To: phone,
    Channel: channel,
  })
  if (result.ok) return { status: "sent", channel }

  if (result.category === "provider_rejected_request") {
    const fallback = alternateOtpChannel(channel)
    logger.warn("customer_verification_channel_fallback", {
      from: channel,
      to: fallback,
    })
    const retry = await postVerifyForm("Verifications", {
      To: phone,
      Channel: fallback,
    })
    if (retry.ok) return { status: "sent", channel: fallback }
  }

  return { status: "unavailable" }
}

export async function checkCustomerPhoneVerification(
  phone: string,
  code: string
): Promise<VerificationCheckResult> {
  if (isAnyFourDigitOtpBypassEnabled()) {
    return isFourDigitOtp(code)
      ? { status: "approved" }
      : { status: "rejected" }
  }

  if (isDevOtpConfigured()) {
    return isApprovedDevOtp(code)
      ? { status: "approved" }
      : { status: "rejected" }
  }

  const result = await postVerifyForm("VerificationCheck", {
    To: phone,
    Code: code,
  })

  if (!result.ok) return { status: "unavailable" }
  return result.status === "approved"
    ? { status: "approved" }
    : { status: "rejected" }
}

async function postVerifyForm(
  path: VerifyOperation,
  params: Record<string, string>
): Promise<ProviderResult> {
  const configured = twilioVerifyConfig()
  if (!configured.ok) {
    logger.error("customer_verification_provider_unavailable", {
      operation: path,
      category: configured.reason,
    })
    return { ok: false, category: configured.reason }
  }

  const { config } = configured
  let response: Response
  try {
    response = await fetch(`${verifyBaseUrl}/${config.serviceSid}/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${config.username}:${config.password}`
        ).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params).toString(),
      signal: AbortSignal.timeout(providerTimeoutMs),
    })
  } catch (error) {
    if (!(error instanceof Error)) throw error
    const category = error.name === "TimeoutError" ? "timeout" : "network"
    logger.error("customer_verification_provider_unavailable", {
      operation: path,
      category,
    })
    return { ok: false, category }
  }

  if (!response.ok) {
    if (path === "VerificationCheck" && [400, 404].includes(response.status)) {
      return { ok: true, status: "rejected" }
    }
    const category: ProviderFailureCategory =
      response.status === 429
        ? "rate_limited"
        : response.status >= 500
          ? "upstream"
          : "provider_rejected_request"
    logger.error("customer_verification_provider_unavailable", {
      operation: path,
      category,
      providerStatus: response.status,
    })
    return { ok: false, category }
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch (error) {
    if (!(error instanceof Error)) throw error
    logger.error("customer_verification_provider_unavailable", {
      operation: path,
      category: "malformed_response",
    })
    return { ok: false, category: "malformed_response" }
  }

  const status = readStatus(payload)
  if (!status) {
    logger.error("customer_verification_provider_unavailable", {
      operation: path,
      category: "malformed_response",
    })
    return { ok: false, category: "malformed_response" }
  }
  return { ok: true, status }
}

function twilioVerifyConfig(): TwilioVerifyConfigResult {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  const apiKeySid = process.env.TWILIO_API_KEY_SID?.trim()
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET?.trim()
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID?.trim()

  if (!serviceSid) {
    return { ok: false, reason: "missing_service" }
  }

  if (accountSid && authToken) {
    return {
      ok: true,
      config: { username: accountSid, password: authToken, serviceSid },
    }
  }

  if (apiKeySid && apiKeySecret) {
    return {
      ok: true,
      config: { username: apiKeySid, password: apiKeySecret, serviceSid },
    }
  }

  return { ok: false, reason: "missing_credentials" }
}

function readStatus(payload: unknown): string | null {
  if (!isRecord(payload)) return null

  return typeof payload.status === "string" ? payload.status : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isApprovedDevOtp(code: string): boolean {
  return (
    isDevOtpConfigured() && code === process.env.CUSTOMER_DEV_OTP_CODE?.trim()
  )
}

/**
 * The dev OTP shortcut is active outside production whenever a code is set. When
 * it is, both send and check skip Twilio so the seeded customer-flow capture is
 * deterministic and never dispatches a real SMS to the demo phone number.
 */
function isDevOtpConfigured(): boolean {
  return (
    isLocalDevelopment() && Boolean(process.env.CUSTOMER_DEV_OTP_CODE?.trim())
  )
}

function isAnyFourDigitOtpBypassEnabled(): boolean {
  return (
    isLocalDevelopment() &&
    process.env.CUSTOMER_OTP_BYPASS_MODE?.trim() === anyFourDigitBypassMode
  )
}

function isLocalDevelopment(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.VERCEL_ENV !== "preview" &&
    process.env.VERCEL_ENV !== "production"
  )
}

function isFourDigitOtp(code: string): boolean {
  return /^\d{4}$/.test(code)
}
