"use server"

import { redirect } from "next/navigation"

import { resolveInviteClaimContext } from "@/lib/loyalty-invites/claim-context"
import { setInviteCookie } from "@/lib/loyalty-invites/invite-cookie"

/**
 * Transfer a validated invitation's context into an encrypted HttpOnly cookie,
 * then enter the existing merchant join flow. A server action (not the page)
 * because only actions/route handlers may set cookies.
 */
export async function startInviteClaimAction(
  formData: FormData
): Promise<void> {
  const token =
    typeof formData.get("token") === "string"
      ? (formData.get("token") as string).trim()
      : ""
  if (!token) redirect("/")

  const context = await resolveInviteClaimContext(token)
  if (context.status !== "available" || !context.merchantSlug) {
    redirect(`/invite/${encodeURIComponent(token)}`)
  }

  await setInviteCookie({
    claimTokenHash: context.claimTokenHash,
    merchantSlug: context.merchantSlug,
    businessName: context.businessName ?? "",
  })
  redirect(`/m/${context.merchantSlug}/join`)
}
