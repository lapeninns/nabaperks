import { NextResponse, type NextRequest } from "next/server"

import {
  hookError,
  openSignedHookEnvelope,
} from "@/app/api/auth/hooks/signed-hook-envelope"
import {
  claimAuthHookDelivery,
  completeAuthHookDelivery,
  failAuthHookDelivery,
} from "@/lib/auth/auth-hook-delivery"
import { sendSmsOtp } from "@/lib/notifications/twilio"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type SendSmsHookPayload = {
  readonly user?: { readonly phone?: string }
  readonly sms?: { readonly otp?: string }
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

  const envelope = await openSignedHookEnvelope(request, secret)
  if (!envelope.ok) {
    return envelope.response
  }

  const payload = parseSendSmsHookPayload(envelope.payload)
  if (!payload) {
    return hookError(400, "Malformed payload.")
  }

  const to = payload.user?.phone?.trim()
  const code = payload.sms?.otp?.trim()
  if (!to || !code) {
    return hookError(400, "Missing recipient phone or code.")
  }

  // Consume the authenticated webhook id BEFORE the provider call. A replay of
  // an already-completed delivery answers with the ordinary success body. Only
  // the unique claimant may call Twilio; concurrency and claim errors fail
  // closed with a retryable response.
  const claim = await claimAuthHookDelivery("sms", envelope.webhookId)
  if (claim === "replay") {
    return NextResponse.json({})
  }
  if (claim !== "claimed") {
    return hookError(503, "SMS delivery is temporarily unavailable.")
  }

  try {
    await sendSmsOtp({ to, code })
  } catch {
    await failAuthHookDelivery("sms", envelope.webhookId)
    return hookError(500, "SMS could not be sent.")
  }

  await completeAuthHookDelivery("sms", envelope.webhookId)

  return NextResponse.json({})
}

function parseSendSmsHookPayload(value: unknown): SendSmsHookPayload | null {
  if (!isRecord(value)) return null

  const user = isRecord(value.user)
    ? { phone: stringValue(value.user.phone) }
    : undefined
  const sms = isRecord(value.sms)
    ? { otp: stringValue(value.sms.otp) }
    : undefined

  return { user, sms }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
