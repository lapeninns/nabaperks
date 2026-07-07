"use server"

import { redirect } from "next/navigation"

import { capturePostHogEvent } from "@/lib/analytics/events"
import { revalidateMerchantLaunchSurfaces } from "@/lib/merchant/revalidate-launch-surfaces"
import { LAUNCH_MIN_ACTIVE_REWARDS } from "@/lib/merchant/launch-readiness-contract"
import { getQrSetup } from "@/lib/merchant/qr-code"
import { qrReturnHref, resolveQrReturnBase } from "@/lib/merchant/qr-nav"
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
