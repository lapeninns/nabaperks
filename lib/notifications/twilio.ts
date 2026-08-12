import "server-only"

import {
  HttpError,
  RequestDeadlineError,
  resilientFetch,
} from "@/lib/observability/resilience"

const TWILIO_TIMEOUT_MS = 8_000

type ProviderRequestOptions = {
  readonly timeoutMs?: number
}

type ProviderErrorCode = "deadline_exceeded" | "http_error" | "network_error"

export class ProviderRequestError extends Error {
  readonly name = "ProviderRequestError"
  readonly provider = "twilio"
  readonly status: number | null
  readonly code: ProviderErrorCode

  constructor(status: number | null, code: ProviderErrorCode) {
    super(
      `twilio request failed (${code}${status === null ? "" : `, status ${status}`})`
    )
    this.status = status
    this.code = code
  }
}

/**
 * Send a one-time code by SMS via Twilio. Used by the Supabase Send-SMS auth
 * hook. Authenticates with a Twilio API key pair (SID/secret) against the
 * account's Messaging Service. Throws if Twilio is not configured or the API
 * rejects the send.
 */
export async function sendSmsOtp(
  { to, code }: { to: string; code: string },
  options: ProviderRequestOptions = {}
) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const apiKeySid = process.env.TWILIO_API_KEY_SID?.trim()
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET?.trim()
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim()

  if (!accountSid || !apiKeySid || !apiKeySecret || !messagingServiceSid) {
    throw new Error(
      "Twilio is not configured (TWILIO_ACCOUNT_SID / TWILIO_API_KEY_SID / TWILIO_API_KEY_SECRET / TWILIO_MESSAGING_SERVICE_SID)."
    )
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const auth = Buffer.from(`${apiKeySid}:${apiKeySecret}`).toString("base64")
  const params = new URLSearchParams({
    To: to,
    MessagingServiceSid: messagingServiceSid,
    Body: `Your Nabaperks verification code is ${code}`,
  })

  let res: Response
  try {
    res = await resilientFetch(
      "twilio",
      endpoint,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      },
      { timeoutMs: options.timeoutMs ?? TWILIO_TIMEOUT_MS }
    )
  } catch (error) {
    if (error instanceof RequestDeadlineError) {
      throw new ProviderRequestError(null, "deadline_exceeded")
    }
    if (error instanceof HttpError) {
      throw new ProviderRequestError(error.status, "http_error")
    }
    throw new ProviderRequestError(null, "network_error")
  }

  if (!res.ok) {
    throw new ProviderRequestError(res.status, "http_error")
  }
}
