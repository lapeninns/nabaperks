"use server"

import { redirect } from "next/navigation"

import { capturePostHogEvent } from "@/lib/analytics/events"
import { getQrSetup } from "@/lib/merchant/qr-code"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const QR_REWARD_POOL_ERROR =
  "Add at least one active mystery reward before launching the QR."
const QR_CREATE_ERROR = "Unable to create QR"
const QR_UPDATE_ERROR = "Unable to update QR"

export async function generateQrCodeAction() {
  const { merchant, activeCard, activeRewardPoolItemCount } = await getQrSetup()

  if (!merchant) {
    redirect("/app/onboarding")
  }

  if (!activeCard) {
    redirect("/app/card")
  }

  if (activeRewardPoolItemCount < 1) {
    redirect(`/app/qr?error=${encodeURIComponent(QR_REWARD_POOL_ERROR)}`)
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc("create_or_get_join_qr", {
    p_merchant_id: merchant.id,
    p_loyalty_card_id: activeCard.id,
  })

  if (error) {
    redirect(`/app/qr?error=${encodeURIComponent(QR_CREATE_ERROR)}`)
  }

  await capturePostHogEvent({
    eventName: "qr_created",
    merchantId: merchant.id,
    actorType: "merchant",
    actorId: merchant.id,
    metadata: { source: "merchant_qr_action" },
  })

  redirect("/app/qr?created=1")
}

export async function setQrActiveAction(formData: FormData) {
  const { merchant } = await getQrSetup()
  const qrCodeId = formData.get("qrCodeId")
  const nextActive = formData.get("nextActive") === "true"

  if (!merchant || typeof qrCodeId !== "string") {
    redirect(`/app/qr?error=${encodeURIComponent(QR_UPDATE_ERROR)}`)
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc("set_qr_active", {
    p_merchant_id: merchant.id,
    p_qr_code_id: qrCodeId,
    p_is_active: nextActive,
  })

  if (error) {
    redirect(`/app/qr?error=${encodeURIComponent(QR_UPDATE_ERROR)}`)
  }

  redirect(`/app/qr?${nextActive ? "enabled" : "disabled"}=1`)
}
