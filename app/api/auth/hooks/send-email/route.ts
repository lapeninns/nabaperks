import { NextResponse, type NextRequest } from "next/server"

import { createMerchantEmailOtpAlias } from "@/lib/auth/merchant-email-otp-alias"
import { sendEmailOtp } from "@/lib/notifications/resend"
import { verifyStandardWebhook } from "@/lib/notifications/standard-webhook"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type SendEmailHookPayload = {
  readonly user?: { readonly email?: string }
  readonly email_data?: {
    readonly token?: string
    readonly email_action_type?: string
  }
}

function hookError(httpCode: number, message: string) {
  return NextResponse.json(
    { error: { http_code: httpCode, message } },
    { status: httpCode }
  )
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

  let parsedBody: unknown
  try {
    parsedBody = JSON.parse(body)
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      throw error
    }

    return hookError(400, "Malformed payload.")
  }

  const payload = parseSendEmailHookPayload(parsedBody)
  if (!payload) {
    return hookError(400, "Malformed payload.")
  }

  const to = payload.user?.email?.trim()
  const code = payload.email_data?.token?.trim()
  if (!to || !code) {
    return hookError(400, "Missing recipient email or code.")
  }

  try {
    const aliasCode = await createMerchantEmailOtpAlias({
      email: to,
      supabaseToken: code,
    })
    const audience =
      payload.email_data?.email_action_type === "recovery"
        ? "merchant-reset"
        : "merchant-verify"
    await sendEmailOtp({ to, code: aliasCode, audience })
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error
    }

    return hookError(500, "Email could not be sent.")
  }

  return NextResponse.json({})
}

function parseSendEmailHookPayload(
  value: unknown
): SendEmailHookPayload | null {
  if (!isRecord(value)) return null

  const user = isRecord(value.user)
    ? { email: stringValue(value.user.email) }
    : undefined
  const emailData = isRecord(value.email_data)
    ? {
        token: stringValue(value.email_data.token),
        email_action_type: stringValue(value.email_data.email_action_type),
      }
    : undefined

  return { user, email_data: emailData }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
