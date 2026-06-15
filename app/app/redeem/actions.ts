"use server"

import { revalidatePath } from "next/cache"

import {
  consumeRedemptionToken,
  lookupRedemptionToken,
  type ConsumeRedemptionResult,
  type RedemptionLookup,
} from "@/lib/merchant/redeem"

export async function lookupRedemptionAction(
  rawTokenOrUrl: string
): Promise<RedemptionLookup> {
  return lookupRedemptionToken(rawTokenOrUrl)
}

export async function consumeRedemptionAction(
  rawTokenOrUrl: string
): Promise<ConsumeRedemptionResult> {
  const result = await consumeRedemptionToken(rawTokenOrUrl)

  if (result.status === "redeemed") {
    revalidatePath("/app")
    revalidatePath("/app/redeem")
    revalidatePath("/app/activity")
    revalidatePath("/app/customers")
  }

  return result
}
