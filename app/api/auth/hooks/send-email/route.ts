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
import { authHookEmailIdempotencyKey } from "@/lib/auth/auth-hook-delivery-core"
import { recordMerchantFunnelEventSafely } from "@/lib/analytics/funnel-events"
import {
  createMerchantEmailOtpAlias,
  revokeMerchantEmailOtpAlias,
} from "@/lib/auth/merchant-email-otp-alias"
import { runMerchantOtpDelivery } from "@/lib/auth/merchant-email-otp-provider"
import { classifySendEmailAction } from "@/lib/auth/send-email-action-core"
import { isDefinitiveProviderRejection } from "@/lib/notifications/provider-delivery-error"
import { readEmailOtpConfig, sendEmailOtp } from "@/lib/notifications/resend"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type SendEmailHookPayload = {
  readonly user?: { readonly email?: string; readonly id?: string }
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
  const userId = payload.user?.id?.trim()
  const code = payload.email_data?.token?.trim()
  const action = classifySendEmailAction(payload.email_data?.email_action_type)
  if (!to || !code) {
    return hookError(400, "Missing recipient email or code.")
  }
  if (!action) {
    return hookError(400, "Unsupported email action.")
  }
  if (
    action.recordsAccountCreation &&
    (!userId || !UUID_PATTERN.test(userId))
  ) {
    return hookError(400, "Missing signup user identity.")
  }

  if (action.recordsAccountCreation) {
    recordMerchantFunnelEventSafely({
      actorId: userId,
      event: "merchant_account_created",
    })
  }

  try {
    readEmailOtpConfig()
  } catch {
    return hookError(500, "Email hook is not configured.")
  }

  let claim
  try {
    claim = await claimAuthHookDelivery("email", envelope.webhookId)
  } catch {
    return hookRetryError("Email delivery could not be claimed.")
  }
  if (claim.status === "replay") return NextResponse.json({})
  if (claim.status === "busy") {
    return hookRetryError("Email delivery is already in progress.")
  }

  let providerAttempted = false

  try {
    await runMerchantOtpDelivery({
      createAlias: () =>
        createMerchantEmailOtpAlias({
          email: to,
          purpose: action.purpose,
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
      sendAlias: async (aliasCode) => {
        await sendEmailOtp({
          to,
          code: aliasCode,
          audience: action.audience,
          idempotencyKey: authHookEmailIdempotencyKey(envelope.webhookId),
          beforeProviderAttempt: async () => {
            await markAuthHookDeliveryAttempted(
              "email",
              envelope.webhookId,
              claim.leaseId
            )
            providerAttempted = true
          },
        })
      },
      shouldRevokeAfterSendError: (error) =>
        !providerAttempted || isDefinitiveProviderRejection(error),
    })
  } catch (error) {
    const definitelyUnsent =
      !providerAttempted || isDefinitiveProviderRejection(error)
    const settle = definitelyUnsent
      ? failAuthHookDelivery
      : completeAuthHookDelivery
    await settle("email", envelope.webhookId, claim.leaseId).catch(
      () => undefined
    )
    return hookRetryError("Email could not be sent.")
  }

  try {
    await completeAuthHookDelivery("email", envelope.webhookId, claim.leaseId)
  } catch {
    return hookError(500, "Email delivery could not be recorded.")
  }

  return NextResponse.json({})
}

function parseSendEmailHookPayload(
  value: unknown
): SendEmailHookPayload | null {
  if (!isRecord(value)) return null

  const user = isRecord(value.user)
    ? {
        email: stringValue(value.user.email),
        id: stringValue(value.user.id),
      }
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
