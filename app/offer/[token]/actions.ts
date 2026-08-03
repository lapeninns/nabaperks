"use server"

import { redirect } from "next/navigation"

import { resolveOfferClaimContext } from "@/lib/offers/claim-context"
import { setOfferCookie } from "@/lib/offers/offer-cookie"

/**
 * Hand a validated campaign link to the existing merchant join flow.
 *
 * The landing page cannot do this itself: only a server action or a route
 * handler may set a cookie. The context is resolved a second time here rather
 * than trusted from the rendered page, so a form replayed after the campaign
 * was paused, ended or rotated cannot open the join flow.
 */
export async function startOfferClaimAction(formData: FormData): Promise<void> {
  const submitted = formData.get("token")
  const token = typeof submitted === "string" ? submitted.trim() : ""
  if (!token) redirect("/")

  const context = await resolveOfferClaimContext(token)
  if (context.status !== "available" || !context.merchantSlug) {
    // Back to the landing page, which renders the honest reason.
    redirect(`/offer/${encodeURIComponent(token)}`)
  }

  await setOfferCookie({
    claimTokenHash: context.claimTokenHash,
    merchantSlug: context.merchantSlug,
  })
  redirect(`/m/${context.merchantSlug}/join`)
}
