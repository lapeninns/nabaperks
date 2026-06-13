import "server-only"

import { productEventNames } from "@/lib/analytics/events"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export async function getPilotFunnelCounts() {
  const supabase = createSupabaseServiceRoleClient()
  const counts = await Promise.all(
    productEventNames.map(async (eventName) => {
      const { count, error } = await supabase
        .from("product_events")
        .select("*", { count: "exact", head: true })
        .eq("event_name", eventName)

      if (error) {
        throw new Error(`Unable to count ${eventName}: ${error.message}`)
      }

      return [eventName, count ?? 0] as const
    })
  )

  return Object.fromEntries(counts) as Record<
    (typeof productEventNames)[number],
    number
  >
}
