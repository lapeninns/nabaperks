"use server"

import { redirect } from "next/navigation"

import { hashInviteToken } from "@/lib/loyalty-invites/tokens"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

/**
 * Venue-scoped unsubscribe: suppress this address for the inviting venue,
 * resolved by the recipient's independent unsubscribe token. Idempotent.
 */
export async function unsubscribeInviteAction(
  formData: FormData
): Promise<void> {
  const token =
    typeof formData.get("token") === "string"
      ? (formData.get("token") as string).trim()
      : ""

  if (token) {
    const supabase = createSupabaseServiceRoleClient()
    await supabase.rpc("suppress_loyalty_invite_email", {
      p_unsubscribe_token_hash: hashInviteToken(token),
    })
  }

  redirect(`/invite/unsubscribe/${encodeURIComponent(token)}?done=1`)
}
