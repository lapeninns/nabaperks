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
  const scanToken = value(formData, "scanToken")

  if (!scanToken) {
    return { errors: { form: "Reward unavailable." } }
  }

  const result = await collectMerchantScannedReward(scanToken)

  if (result.status === "blocked") {
    return { errors: { form: result.reason } }
  }

  revalidatePath(`/app/rewards/scan/${result.scanToken}`)
  revalidatePath("/app/activity")
  revalidatePath("/app/customers")
  redirect(`/app/rewards/scan/${result.scanToken}?collected=1`)
}

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  if (typeof raw !== "string") return ""

  return raw.trim()
}
