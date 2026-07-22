"use server"

import { createHash } from "node:crypto"

import { redirect } from "next/navigation"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

/**
 * Suppress future invite emails for the address behind this claim token. Only a
 * live invite still carries the email HMAC; once terminal it is scrubbed, so a
 * repeat unsubscribe is a harmless no-op.
 */
export async function unsubscribeRewardInviteAction(
  formData: FormData
): Promise<void> {
  const token = String(formData.get("token") ?? "")
  if (!token) {
    redirect("/claim/invalid?unsubscribe=failed")
  }

  const claimTokenHash = createHash("sha256").update(token).digest("hex")
  const supabase = createSupabaseServiceRoleClient()
  const { data, error: lookupError } = await supabase
    .from("pending_reward_invites")
    .select("email_hmac")
    .eq("claim_token_hash", claimTokenHash)
    .maybeSingle()

  if (lookupError) {
    console.error("Reward invite unsubscribe lookup failed.")
    redirect(`/claim/${encodeURIComponent(token)}?unsubscribe=failed`)
  }

  if (data?.email_hmac) {
    const { error: suppressError } = await supabase.rpc(
      "suppress_reward_invite_email",
      {
        p_email_hmac: data.email_hmac,
        p_reason: "unsubscribed",
      }
    )
    if (suppressError) {
      console.error("Reward invite unsubscribe write failed.")
      redirect(`/claim/${encodeURIComponent(token)}?unsubscribe=failed`)
    }
  }

  redirect(`/claim/${encodeURIComponent(token)}?unsubscribe=done`)
}
