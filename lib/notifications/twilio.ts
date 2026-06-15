import "server-only"

import { resilientFetch } from "@/lib/observability/resilience"

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
export async function sendSmsOtp({ to, code }: { to: string; code: string }) {
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

  const res = await resilientFetch("twilio", endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  })

  if (!res.ok) {
    throw new Error(
      `Twilio send failed (${res.status}): ${await safeDetail(res)}`
    )
  }
}
