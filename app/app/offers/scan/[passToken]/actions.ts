"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import {
  merchantActivitySummaryCacheTag,
  revalidateCacheTag,
} from "@/lib/cache/tags"
import { redeemMerchantOfferPass } from "@/lib/merchant/offer-pass-redemption"
import { validateOfferPassAttestations } from "@/lib/offers/redeem-core"

/**
 * The only mutation in the discount-pass flow. Scanning navigates; a member of
 * staff redeems here, having confirmed both attestations. No bill amount, no ID
 * number and no date of birth is accepted — the form posts two booleans.
 *
 * A server action is its own HTTP entry point, so authorisation is not
 * inherited from the page that rendered the form. `redeemMerchantOfferPass`
 * proves the merchant session itself and passes that venue's id to
 * `redeem_offer_pass`, which refuses a pass minted anywhere else.
 */

export type MerchantOfferPassRedemptionActionState = {
  errors?: {
    form?: string
    idCheck?: string
    noStacking?: string
  }
}

export async function confirmOfferPassRedemptionAction(
  _state: MerchantOfferPassRedemptionActionState,
  formData: FormData
): Promise<MerchantOfferPassRedemptionActionState> {
  const scanToken = value(formData, "scanToken")

  if (!scanToken) {
    return { errors: { form: "Discount pass unavailable." } }
  }

  // requiresIdCheck is a rendering hint from the form, used only to decide
  // whether the ID box is demanded inline. redeem_offer_pass re-reads the rule
  // from the pass snapshot and refuses regardless of what was posted.
  const attestations = validateOfferPassAttestations({
    requiresIdCheck: flag(formData, "requiresIdCheck"),
    idChecked: flag(formData, "idChecked"),
    noStacking: flag(formData, "noStacking"),
  })

  if (!attestations.ok) {
    return { errors: attestations.errors }
  }

  const result = await redeemMerchantOfferPass(scanToken, {
    idChecked: attestations.idChecked,
    noStacking: attestations.noStacking,
  })

  if (result.status === "blocked") {
    return { errors: { form: result.reason } }
  }

  revalidateCacheTag(merchantActivitySummaryCacheTag(result.merchantId))
  revalidatePath(`/app/offers/scan/${result.scanToken}`)
  revalidatePath("/app/activity")
  revalidatePath("/app/offers")
  redirect(`/app/offers/scan/${result.scanToken}?redeemed=1`)
}

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  if (typeof raw !== "string") return ""

  return raw.trim()
}

function flag(formData: FormData, key: string) {
  return formData.get(key) === "1"
}
