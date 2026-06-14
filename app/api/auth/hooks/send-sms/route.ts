import { NextResponse, type NextRequest } from "next/server"

import { sendSmsOtp } from "@/lib/notifications/twilio"
import { verifyStandardWebhook } from "@/lib/notifications/standard-webhook"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type SendSmsHookPayload = {
  user?: { phone?: string }
  sms?: { otp?: string }
}

function hookError(httpCode: number, message: string) {
  return NextResponse.json({ error: { http_code: httpCode, message } }, { status: httpCode })
}

/**
 * Supabase "Send SMS" auth hook. Supabase POSTs the user + the OTP it
 * generated; we deliver it via Twilio. Requests are authenticated with the
 * Standard Webhooks signature using SUPABASE_SEND_SMS_HOOK_SECRET.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.SUPABASE_SEND_SMS_HOOK_SECRET?.trim()
  if (!secret) {
    return hookError(500, "SMS hook is not configured.")
  }

  const body = await request.text()
  const verified = verifyStandardWebhook({
    secret,
    id: request.headers.get("webhook-id") ?? "",
    timestamp: request.headers.get("webhook-timestamp") ?? "",
    signatureHeader: request.headers.get("webhook-signature") ?? "",
    body,
  })
  if (!verified) {
    return hookError(401, "Invalid signature.")
  }

  let payload: SendSmsHookPayload
  try {
    payload = JSON.parse(body) as SendSmsHookPayload
  } catch {
    return hookError(400, "Malformed payload.")
  }

  const to = payload.user?.phone?.trim()
  const code = payload.sms?.otp?.trim()
  if (!to || !code) {
    return hookError(400, "Missing recipient phone or code.")
  }

  try {
    await sendSmsOtp({ to, code })
  } catch {
    return hookError(500, "SMS could not be sent.")
  }

  return NextResponse.json({})
}
