"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import {
  redeemSelfServiceReward,
  type GeoCoordinates,
} from "@/lib/customer/stamp"

export type SelfRedeemActionState = {
  errors?: {
    form?: string
  }
}

export async function selfRedeemAction(
  _state: SelfRedeemActionState,
  formData: FormData
): Promise<SelfRedeemActionState> {
  const rewardId = value(formData, "rewardId")

  if (!rewardId) {
    return { errors: { form: "Reward unavailable." } }
  }

  const result = await redeemSelfServiceReward(rewardId, coordinates(formData))

  if (result.status === "blocked") {
    return { errors: { form: result.reason } }
  }

  revalidatePath(`/card/${result.membershipId}`)
  revalidatePath(`/reward/${rewardId}`)
  // Land on a reward-specific proof URL — unambiguous when a membership has more
  // than one reward, and the proof screen links back to the card.
  redirect(`/reward/${rewardId}?redeemed=1`)
}

function coordinates(formData: FormData): GeoCoordinates | undefined {
  const latitude = numberValue(formData, "latitude")
  const longitude = numberValue(formData, "longitude")

  if (latitude === null || longitude === null) return undefined

  return { latitude, longitude }
}

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  if (typeof raw !== "string") return ""

  return raw.trim()
}

function numberValue(formData: FormData, key: string) {
  const raw = value(formData, key)
  if (!raw) return null

  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}
