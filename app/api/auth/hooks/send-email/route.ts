import { NextResponse, type NextRequest } from "next/server"

import {
  hookError,
  openSignedHookEnvelope,
} from "@/app/api/auth/hooks/signed-hook-envelope"
import {
  createMerchantEmailOtpAlias,
  revokeMerchantEmailOtpAlias,
} from "@/lib/auth/merchant-email-otp-alias"
import { runMerchantOtpDelivery } from "@/lib/auth/merchant-email-otp-provider"
import { readEmailOtpConfig, sendEmailOtp } from "@/lib/notifications/resend"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type SendEmailHookPayload = {
  readonly user?: { readonly email?: string }
  readonly email_data?: {
    readonly token?: string
    readonly email_action_type?: string
  }
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

  const envelope = await openSignedHookEnvelope(request, secret)
  if (!envelope.ok) {
    return envelope.response
  }

  const payload = parseSendEmailHookPayload(envelope.payload)
  if (!payload) {
    return hookError(400, "Malformed payload.")
  }

  const to = payload.user?.email?.trim()
  const code = payload.email_data?.token?.trim()
  if (!to || !code) {
    return hookError(400, "Missing recipient email or code.")
  }

  try {
    readEmailOtpConfig()
    const purpose =
      payload.email_data?.email_action_type === "recovery"
        ? "recovery"
        : "signup"
    const audience =
      purpose === "recovery" ? "merchant-reset" : "merchant-verify"
    await runMerchantOtpDelivery({
      createAlias: () =>
        createMerchantEmailOtpAlias({
          email: to,
          purpose,
          supabaseToken: code,
        }),
      onRevocationError: (aliasId, revocationError) => {
        console.error("Merchant email alias revocation failed", {
          aliasId,
          error: revocationError.message,
        })
      },
      revokeAlias: (aliasId) =>
        revokeMerchantEmailOtpAlias({
          aliasId,
          outcome: "delivery_failed",
        }),
      sendAlias: (aliasCode) => sendEmailOtp({ to, code: aliasCode, audience }),
    })
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
