"use server"

import { createHash } from "node:crypto"

import { redirect } from "next/navigation"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

/**
 * Suppress future direct-reward invite email from ONE venue.
 *
 * This resolves `unsubscribe_token_hash` only. The claim token is a different
 * secret with a different purpose and is not accepted here — previously both
 * capabilities were the same value, so a leaked claim URL could silence a
 * recipient's invite email across every venue on the platform.
 */
export async function unsubscribeRewardInviteAction(
  formData: FormData
): Promise<void> {
  const token = String(formData.get("token") ?? "")
  if (!token) {
    redirect("/claim/invalid?unsubscribe=failed")
  }

  const unsubscribeTokenHash = createHash("sha256").update(token).digest("hex")
  const supabase = createSupabaseServiceRoleClient()

  // The database derives the venue and the address from the invite, so the
  // caller cannot choose whose mail to suppress or how widely.
  const { error } = await supabase.rpc(
    "suppress_reward_invite_email_by_token",
    {
      p_unsubscribe_token_hash: unsubscribeTokenHash,
    }
  )

  if (error) {
    console.error("Reward invite unsubscribe write failed.")
    redirect(
      `/claim/unsubscribe/${encodeURIComponent(token)}?unsubscribe=failed`
    )
  }

  // A scrubbed or unknown token returns false and is a harmless no-op; the
  // response never reveals which, so the route is not an existence oracle.
  redirect(`/claim/unsubscribe/${encodeURIComponent(token)}?unsubscribe=done`)
}
