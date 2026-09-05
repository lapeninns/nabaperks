"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import {
  merchantActivitySummaryCacheTag,
  revalidateCacheTag,
} from "@/lib/cache/tags"
import { collectMerchantScannedReward } from "@/lib/merchant/reward-collection"
import { verifyAndCollectMerchantReward } from "@/lib/merchant/reward-id-verification"

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

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      scanToken
    )
  ) {
    return { errors: { form: "Reward unavailable." } }
  }

  const result =
    value(formData, "collectionMode") === "verify_id"
      ? await verifyAndCollectMerchantReward({
          scanToken,
          expectedDateOfBirth: value(formData, "expectedDateOfBirth"),
          idConfirmed: value(formData, "idConfirmed") === "true",
        })
      : await collectMerchantScannedReward(scanToken)

  if (result.status === "blocked") {
    return { errors: { form: result.reason } }
  }

  revalidateCacheTag(merchantActivitySummaryCacheTag(result.merchantId))
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
