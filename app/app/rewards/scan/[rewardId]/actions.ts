"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { collectMerchantScannedReward } from "@/lib/merchant/reward-collection"

export type MerchantRewardCollectionActionState = {
  errors?: {
    form?: string
  }
}

export async function confirmMerchantRewardCollectionAction(
  _state: MerchantRewardCollectionActionState,
  formData: FormData
): Promise<MerchantRewardCollectionActionState> {
  const rewardId = value(formData, "rewardId")

  if (!rewardId) {
    return { errors: { form: "Reward unavailable." } }
  }

  const result = await collectMerchantScannedReward(rewardId)

  if (result.status === "blocked") {
    return { errors: { form: result.reason } }
  }

  revalidatePath(`/app/rewards/scan/${result.rewardId}`)
  revalidatePath("/app/activity")
  revalidatePath("/app/customers")
  redirect(`/app/rewards/scan/${result.rewardId}?collected=1`)
}

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  if (typeof raw !== "string") return ""

  return raw.trim()
}
