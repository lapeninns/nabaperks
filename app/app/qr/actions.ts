"use server"

import { redirect } from "next/navigation"

import { capturePostHogEvent } from "@/lib/analytics/events"
import { scheduleMerchantActivationEvent } from "@/lib/analytics/merchant-activation-events"
import { getCurrentUser } from "@/lib/auth/session"
import { getServerEnv } from "@/lib/env/server"
import { revalidateMerchantLaunchSurfaces } from "@/lib/merchant/revalidate-launch-surfaces"
import { getLaunchBillingReadiness } from "@/lib/merchant/launch-readiness"
import { LAUNCH_MIN_ACTIVE_REWARDS } from "@/lib/merchant/launch-readiness-contract"
import { isLaunchBillingReady } from "@/lib/merchant/launch-readiness-core"
import { getQrSetup } from "@/lib/merchant/qr-code"
import { qrReturnHref, resolveQrReturnBase } from "@/lib/merchant/qr-nav"
import { buildPosterEmailContent } from "@/lib/notifications/poster-email"
import { buildPosterPdfAttachments } from "@/lib/notifications/poster-pdf"
import { buildTentPdfAttachments } from "@/lib/notifications/tent-pdf"
import { sendTransactionalEmail } from "@/lib/notifications/resend"
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const QR_REWARD_POOL_ERROR =
  "Add at least 3 active mystery rewards before launching the QR."
const QR_BILLING_ERROR = "Activate billing to enable your venue QR."
const QR_CREATE_ERROR = "Unable to create QR"
const QR_UPDATE_ERROR = "Unable to update QR"
const POSTER_EMAIL_LIMIT = 3
const POSTER_EMAIL_WINDOW_MS = 60 * 60 * 1_000

export async function generateQrCodeAction(formData: FormData) {
  const returnBase = resolveQrReturnBase(formData.get("returnTo"))
  const { merchant, activeCard, activeRewardPoolItemCount } = await getQrSetup()

  if (!merchant) {
    redirect("/app/onboarding")
  }

  if (!activeCard) {
    redirect("/app/launch?tab=card")
  }

  if (activeRewardPoolItemCount < LAUNCH_MIN_ACTIVE_REWARDS) {
    redirect(
      qrReturnHref(
        returnBase,
        `error=${encodeURIComponent(QR_REWARD_POOL_ERROR)}`
      )
    )
  }

  const billing = await getLaunchBillingReadiness(
    merchant.id,
    merchant.requires_billing !== false
  )
  if (!isLaunchBillingReady(billing)) {
    redirect(
      qrReturnHref(returnBase, `error=${encodeURIComponent(QR_BILLING_ERROR)}`)
    )
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc("create_or_get_join_qr", {
    p_merchant_id: merchant.id,
    p_loyalty_card_id: activeCard.id,
  })

  if (error) {
    redirect(
      qrReturnHref(returnBase, `error=${encodeURIComponent(QR_CREATE_ERROR)}`)
    )
  }

  await capturePostHogEvent({
    eventName: "qr_created",
    merchantId: merchant.id,
    actorType: "merchant",
    actorId: merchant.id,
    metadata: { source: "merchant_qr_action" },
  })

  revalidateMerchantLaunchSurfaces(merchant.id)

  redirect(qrReturnHref(returnBase, "created=1"))
}

export async function setQrActiveAction(formData: FormData) {
  const returnBase = resolveQrReturnBase(formData.get("returnTo"))
  const { merchant, activeRewardPoolItemCount } = await getQrSetup()
  const qrCodeId = formData.get("qrCodeId")
  const nextActive = formData.get("nextActive") === "true"

  if (!merchant || typeof qrCodeId !== "string") {
    redirect(
      qrReturnHref(returnBase, `error=${encodeURIComponent(QR_UPDATE_ERROR)}`)
    )
  }

  if (nextActive && activeRewardPoolItemCount < LAUNCH_MIN_ACTIVE_REWARDS) {
    redirect(
      qrReturnHref(
        returnBase,
        `error=${encodeURIComponent(QR_REWARD_POOL_ERROR)}`
      )
    )
  }

  const billing = nextActive
    ? await getLaunchBillingReadiness(
        merchant.id,
        merchant.requires_billing !== false
      )
    : undefined
  if (nextActive && !isLaunchBillingReady(billing)) {
    redirect(
      qrReturnHref(returnBase, `error=${encodeURIComponent(QR_BILLING_ERROR)}`)
    )
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc("set_qr_active", {
    p_merchant_id: merchant.id,
    p_qr_code_id: qrCodeId,
    p_is_active: nextActive,
  })

  if (error) {
    redirect(
      qrReturnHref(returnBase, `error=${encodeURIComponent(QR_UPDATE_ERROR)}`)
    )
  }

  await capturePostHogEvent({
    eventName: nextActive ? "qr_enabled" : "qr_disabled",
    merchantId: merchant.id,
    qrCodeId,
    actorType: "merchant",
    actorId: merchant.id,
    metadata: {
      source: "merchant_qr_action",
      is_active: nextActive,
    },
  })

  revalidateMerchantLaunchSurfaces(merchant.id)

  redirect(qrReturnHref(returnBase, `${nextActive ? "enabled" : "disabled"}=1`))
}

export type EmailPosterState = { ok?: boolean; message?: string }

/**
 * Email every poster PDF to the signed-in merchant so they can print directly
 * from any device — the phone-native alternative to browser print controls.
 * Returns inline `useActionState` feedback rather than redirecting, so the QR
 * panel shows the result without a reload.
 */
export async function emailPosterAction(): Promise<EmailPosterState> {
  try {
    const { merchant, activeCard, qrCode } = await getQrSetup()

    if (!merchant || !activeCard || !qrCode) {
      return {
        ok: false,
        message: "Create your venue QR before emailing the poster PDFs.",
      }
    }

    const user = await getCurrentUser()
    const to = user?.email?.trim()

    if (!to) {
      return {
        ok: false,
        message:
          "Add an email to your account before emailing the poster PDFs.",
      }
    }

    await enforceRateLimit({
      key: `poster-email:${merchant.id}`,
      limit: POSTER_EMAIL_LIMIT,
      windowMs: POSTER_EMAIL_WINDOW_MS,
    })

    const env = getServerEnv()
    const shareUrl = `${env.NEXT_PUBLIC_APP_URL}/q/${qrCode.qr_id}`
    const venueName = merchant.business_name.trim().slice(0, 120)
    const [posterAttachments, tentAttachments] = await Promise.all([
      buildPosterPdfAttachments({
        merchantName: venueName,
        shareUrl,
        stampsRequired: activeCard.stamps_required,
      }),
      buildTentPdfAttachments({
        merchantName: venueName,
        shareUrl,
        stampsRequired: activeCard.stamps_required,
      }),
    ])
    const attachments = [...posterAttachments, ...tentAttachments]
    const content = buildPosterEmailContent({ venueName })
    await sendTransactionalEmail({ to, ...content, attachments })

    scheduleMerchantActivationEvent({
      eventName: "qr_poster_emailed",
      merchantId: merchant.id,
      idempotencyKey: "first-success",
      source: "merchant_qr_action",
    })

    return {
      ok: true,
      message: `${attachments.length} print-kit PDFs sent to ${to}.`,
    }
  } catch (error) {
    if (error instanceof RateLimitError) {
      return {
        ok: false,
        message:
          "Poster PDFs can be emailed up to 3 times an hour. Try again later.",
      }
    }

    console.error(
      "[qr] poster email failed",
      error instanceof Error ? error.message : error
    )
    return {
      ok: false,
      message: "Could not email the poster PDFs just now. Try again.",
    }
  }
}
