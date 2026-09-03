import { NextResponse, type NextRequest } from "next/server"

import {
  hookError,
  hookRetryError,
  openSignedHookEnvelope,
} from "@/app/api/auth/hooks/signed-hook-envelope"
import {
  claimAuthHookDelivery,
  completeAuthHookDelivery,
  failAuthHookDelivery,
  markAuthHookDeliveryAttempted,
} from "@/lib/auth/auth-hook-delivery"
import { isDefinitiveProviderRejection } from "@/lib/notifications/provider-delivery-error"
import { readSmsOtpConfig, sendSmsOtp } from "@/lib/notifications/twilio"

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

  try {
    readSmsOtpConfig()
  } catch {
    return hookError(500, "SMS hook is not configured.")
  }

  let claim
  try {
    claim = await claimAuthHookDelivery("sms", envelope.webhookId)
  } catch {
    return hookRetryError("SMS delivery could not be claimed.")
  }
  if (claim.status === "replay") {
    return NextResponse.json({})
  }
  if (claim.status === "busy") {
    return hookRetryError("SMS delivery is already in progress.")
  }

  let providerAttempted = false
  try {
    await sendSmsOtp({
      to,
      code,
      beforeProviderAttempt: async () => {
        await markAuthHookDeliveryAttempted(
          "sms",
          envelope.webhookId,
          claim.leaseId
        )
        providerAttempted = true
      },
    })
  } catch (error) {
    const definitelyUnsent =
      !providerAttempted || isDefinitiveProviderRejection(error)
    const settle = definitelyUnsent
      ? failAuthHookDelivery
      : completeAuthHookDelivery
    await settle("sms", envelope.webhookId, claim.leaseId).catch(
      () => undefined
    )
    return hookRetryError("SMS could not be sent.")
  }

  try {
    await completeAuthHookDelivery("sms", envelope.webhookId, claim.leaseId)
  } catch {
    return hookError(500, "SMS delivery could not be recorded.")
  }

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
