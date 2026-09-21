import "server-only"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

/**
 * When the venue issued its first stamp — the clock the Numbers low-data
 * bands run on. One indexed row read (merchant_id, event_name, created_at);
 * null for a venue that has never stamped.
 */
export async function getFirstStampAt(
  merchantId: string
): Promise<string | null> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("product_events")
    .select("created_at")
    .eq("merchant_id", merchantId)
    .eq("event_name", "stamp_issued")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to load first stamp: ${error.message}`)
  }

  return typeof data?.created_at === "string" ? data.created_at : null
}
