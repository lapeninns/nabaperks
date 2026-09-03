import "server-only"

import { resilientFetch } from "@/lib/observability/resilience"
import { DefinitiveProviderRejectionError } from "@/lib/notifications/provider-delivery-error"

type SmsOtpConfig = {
  readonly accountSid: string
  readonly apiKeySid: string
  readonly apiKeySecret: string
  readonly messagingServiceSid: string
}

export function readSmsOtpConfig(): SmsOtpConfig {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const apiKeySid = process.env.TWILIO_API_KEY_SID?.trim()
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET?.trim()
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim()

  if (!accountSid || !apiKeySid || !apiKeySecret || !messagingServiceSid) {
    throw new Error(
      "Twilio is not configured (TWILIO_ACCOUNT_SID / TWILIO_API_KEY_SID / TWILIO_API_KEY_SECRET / TWILIO_MESSAGING_SERVICE_SID)."
    )
  }
  return { accountSid, apiKeySid, apiKeySecret, messagingServiceSid }
}

async function safeDetail(res: Response) {
  try {
    return (await res.text()).slice(0, 500)
  } catch {
    return "<no body>"
  }
}

/**
 * Send a one-time code by SMS via Twilio. Used by the Supabase Send-SMS auth
 * hook. Authenticates with a Twilio API key pair (SID/secret) against the
 * account's Messaging Service. Throws if Twilio is not configured or the API
 * rejects the send.
 */
export async function sendSmsOtp({
  to,
  code,
  beforeProviderAttempt,
}: {
  to: string
  code: string
  beforeProviderAttempt?: () => Promise<void>
}) {
  const { accountSid, apiKeySid, apiKeySecret, messagingServiceSid } =
    readSmsOtpConfig()

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const auth = Buffer.from(`${apiKeySid}:${apiKeySecret}`).toString("base64")
  const params = new URLSearchParams({
    To: to,
    MessagingServiceSid: messagingServiceSid,
    Body: `Your Nabaperks verification code is ${code}`,
  })

  const res = await resilientFetch(
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
    { beforeAttempt: beforeProviderAttempt }
  )

  if (!res.ok) {
    throw new DefinitiveProviderRejectionError(
      `Twilio send failed (${res.status}): ${await safeDetail(res)}`
    )
  }
}
