import { NextResponse, type NextRequest } from "next/server"

import { sendEmailOtp } from "@/lib/notifications/resend"
import { verifyStandardWebhook } from "@/lib/notifications/standard-webhook"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type SendEmailHookPayload = {
  user?: { email?: string }
  email_data?: { token?: string; email_action_type?: string }
}

function hookError(httpCode: number, message: string) {
  return NextResponse.json({ error: { http_code: httpCode, message } }, { status: httpCode })
}

/**
 * Supabase "Send Email" auth hook. Supabase POSTs the user + the OTP it
 * generated; we deliver it via Resend. Requests are authenticated with the
 * Standard Webhooks signature using SUPABASE_SEND_EMAIL_HOOK_SECRET.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.SUPABASE_SEND_EMAIL_HOOK_SECRET?.trim()
  if (!secret) {
    return hookError(500, "Email hook is not configured.")
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

  let payload: SendEmailHookPayload
  try {
    payload = JSON.parse(body) as SendEmailHookPayload
  } catch {
    return hookError(400, "Malformed payload.")
  }

  const to = payload.user?.email?.trim()
  const code = payload.email_data?.token?.trim()
  if (!to || !code) {
    return hookError(400, "Missing recipient email or code.")
  }

  try {
    await sendEmailOtp({ to, code })
  } catch {
    return hookError(500, "Email could not be sent.")
  }

  return NextResponse.json({})
}
