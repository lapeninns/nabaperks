import "server-only"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

/**
 * When the venue issued its first stamp — the clock the Numbers low-data
 * bands run on. Read from the same `stamp_events` ledger the dashboard
 * counts and series use (event_type = earned), so stamps that arrived via
 * invitations, offers or referral bonuses count exactly as they do in the
 * totals. One indexed row read; null for a venue that has never stamped.
 */
export async function getFirstStampAt(
  merchantId: string
): Promise<string | null> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("stamp_events")
    .select("created_at")
    .eq("merchant_id", merchantId)
    .eq("event_type", "earned")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to load first stamp: ${error.message}`)
  }

  return typeof data?.created_at === "string" ? data.created_at : null
}
