import "server-only"

import { productEventNames } from "@/lib/analytics/events"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export async function getPilotFunnelCounts() {
  return getProductEventCounts(productEventNames)
}

export async function getProductEventCounts(eventNames: readonly string[]) {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("get_product_event_counts", {
    target_event_names: eventNames,
  })

  if (error) {
    throw new Error(`Unable to load product event counts: ${error.message}`)
  }

  const rpcCounts = parseProductEventCounts(data)

  if (rpcCounts) {
    return toCountRecord(eventNames, rpcCounts)
  }

  if (data !== null) {
    throw new Error("Unable to load product event counts: invalid RPC response")
  }

  return toCountRecord(eventNames, await getProductEventCountsByQuery(eventNames))
}

async function getProductEventCountsByQuery(eventNames: readonly string[]) {
  const supabase = createSupabaseServiceRoleClient()
  const counts = await Promise.all(
    eventNames.map(async (eventName) => {
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

  return new Map(counts)
}

function parseProductEventCounts(data: unknown) {
  if (!Array.isArray(data)) {
    return null
  }

  const counts = new Map<string, number>()

  for (const row of data) {
    if (!isRecord(row)) return null

    const eventName = row["event_name"]
    const eventCount = parseCount(row["event_count"])

    if (typeof eventName !== "string" || eventCount === null) {
      return null
    }

    counts.set(eventName, eventCount)
  }

  return counts
}

function toCountRecord(
  eventNames: readonly string[],
  counts: ReadonlyMap<string, number>
) {
  const output: Record<string, number> = {}

  for (const eventName of eventNames) {
    output[eventName] = counts.get(eventName) ?? 0
  }

  return output
}

function parseCount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value)
  }

  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
