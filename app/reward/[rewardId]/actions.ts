"use server"

import { redirect } from "next/navigation"

import { capturePostHogEvent } from "@/lib/analytics/events"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type RewardRedemptionState = {
  fields?: {
    rewardId?: string
  }
  errors?: {
    pin?: string
    form?: string
  }
}

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}

function redemptionErrorMessage(message: string) {
  if (
    message.includes("next UK business day") ||
    message.includes("redeemable_from")
  ) {
    return "Come back from the next UK business day to redeem this reward."
  }

  if (message.includes("already redeemed")) {
    return "This reward has already been redeemed."
  }

  if (message.includes("Too many incorrect PIN attempts")) {
    return "Too many failed PIN attempts. Wait before trying again."
  }

  if (message.includes("Staff PIN was not accepted")) {
    return "That staff PIN was not accepted."
  }

  if (message.includes("not redeemable")) {
    return "This reward is not redeemable."
  }

  if (message.includes("not active") || message.includes("unavailable")) {
    return "This loyalty programme is unavailable right now."
  }

  return "The reward could not be redeemed."
}

export async function redeemRewardAction(
  _state: RewardRedemptionState,
  formData: FormData
): Promise<RewardRedemptionState> {
  const rewardId = value(formData, "rewardId")
  const pin = value(formData, "pin")

  if (!rewardId) {
    return { errors: { form: "Open the reward from the customer card." } }
  }

  if (!/^\d{4,12}$/.test(pin)) {
    return {
      fields: { rewardId },
      errors: { pin: "Enter the staff PIN." },
    }
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc("redeem_reward_with_staff_pin", {
    p_reward_id: rewardId,
    p_pin: pin,
  })

  if (error) {
    return {
      fields: { rewardId },
      errors: { form: redemptionErrorMessage(error.message) },
    }
  }

  const membershipId = data?.[0]?.membership_id
  if (membershipId) {
    await capturePostHogEvent({
      eventName: "reward_redeemed",
      membershipId,
      actorType: "staff",
      metadata: { reward_id: rewardId },
    })
    redirect(`/card/${membershipId}?reward=redeemed`)
  }

  redirect(`/reward/${rewardId}`)
}
