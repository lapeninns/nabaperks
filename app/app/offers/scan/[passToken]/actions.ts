"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import {
  merchantActivitySummaryCacheTag,
  revalidateCacheTag,
} from "@/lib/cache/tags"
import { redeemMerchantOfferPass } from "@/lib/merchant/offer-pass-redemption"
import { validateOfferPassAttestations } from "@/lib/offers/redeem-core"
import { loadOfferDeskContext } from "../../actions"

/**
 * The only mutation in the discount-pass flow. Scanning navigates; a member of
 * staff redeems here, having confirmed both attestations. No bill amount, no ID
 * number and no date of birth is accepted — the form posts two booleans.
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

  // The same kill switch the page renders behind (page.tsx). A server action is
  // its own HTTP entry point, so gating only the page left a crafted POST able
  // to redeem at a venue that had been switched off — the flag would have
  // stopped new claims but not redemptions, which is not what a rollout control
  // means.
  //
  // A flag flipped between rendering this form and submitting it therefore
  // refuses the redemption in hand. That is deliberate: a venue taken out of
  // the pilot should complete no further redemptions, and nothing is lost —
  // the scan token is untouched and the pass is redeemable again the moment the
  // venue is switched back on.
  const desk = await loadOfferDeskContext()
  if (!desk.enabled) {
    return { errors: { form: "Offers aren't available for your venue yet." } }
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
