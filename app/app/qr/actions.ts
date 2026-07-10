"use server"

import { redirect } from "next/navigation"

import { capturePostHogEvent } from "@/lib/analytics/events"
import { scheduleMerchantActivationEvent } from "@/lib/analytics/merchant-activation-events"
import { getCurrentUser } from "@/lib/auth/session"
import { getServerEnv } from "@/lib/env/server"
import { revalidateMerchantLaunchSurfaces } from "@/lib/merchant/revalidate-launch-surfaces"
import { LAUNCH_MIN_ACTIVE_REWARDS } from "@/lib/merchant/launch-readiness-contract"
import { getQrSetup } from "@/lib/merchant/qr-code"
import { qrReturnHref, resolveQrReturnBase } from "@/lib/merchant/qr-nav"
import { buildPosterEmailContent } from "@/lib/notifications/poster-email"
import { sendTransactionalEmail } from "@/lib/notifications/resend"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const QR_REWARD_POOL_ERROR =
  "Add at least 3 active mystery rewards before launching the QR."
const QR_CREATE_ERROR = "Unable to create QR"
const QR_UPDATE_ERROR = "Unable to update QR"

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
 * Email the poster link to the signed-in merchant so they can open and print it
 * from a computer later — the phone-native alternative to "print A4 at 100%".
 * Returns inline `useActionState` feedback rather than redirecting, so the QR
 * panel shows the result without a reload.
 */
export async function emailPosterAction(): Promise<EmailPosterState> {
  const { merchant, activeCard, qrCode } = await getQrSetup()

  if (!merchant || !activeCard || !qrCode) {
    return {
      ok: false,
      message: "Create your venue QR before emailing the poster.",
    }
  }

  const user = await getCurrentUser()
  const to = user?.email?.trim()

  if (!to) {
    return {
      ok: false,
      message: "Add an email to your account before emailing the poster.",
    }
  }

  const env = getServerEnv()
  const content = buildPosterEmailContent({
    venueName: merchant.business_name,
    posterUrl: `${env.NEXT_PUBLIC_APP_URL}/app/qr`,
    shareUrl: `${env.NEXT_PUBLIC_APP_URL}/q/${qrCode.qr_id}`,
  })

  try {
    await sendTransactionalEmail({ to, ...content })
  } catch (error) {
    console.error(
      "[qr] poster email failed",
      error instanceof Error ? error.message : error
    )
    return {
      ok: false,
      message: "Could not email the poster just now. Try again.",
    }
  }

  scheduleMerchantActivationEvent({
    eventName: "qr_poster_emailed",
    merchantId: merchant.id,
    idempotencyKey: "first-success",
    source: "merchant_qr_action",
  })

  return { ok: true, message: `Poster link sent to ${to}.` }
}
