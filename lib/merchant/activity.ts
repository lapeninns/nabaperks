import "server-only"

import { getCurrentMerchant } from "@/lib/auth/session"
import {
  cacheByScope,
  merchantActivitySummaryCacheTag,
  merchantCacheTag,
} from "@/lib/cache/tags"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

import {
  activityCategory,
  activityEvents,
  clampActivityLimit,
  eventsForCategory,
  threadActivityRows,
  toSlimActivityRow,
  type ActivityQueryOptions,
  type ActivityQueryResult,
  type ActivitySummary,
  type RawActivityRow,
} from "./activity-display"

// The pure display core now lives in ./activity-display. Re-export it here so
// the six existing callers keep importing from "@/lib/merchant/activity".
export { summarizeActivity } from "./activity-display"
export type {
  ActivityAction,
  ActivityCategory,
  ActivityDetail,
  ActivityDisplayRow,
  ActivityEventName,
  ActivityQueryOptions,
  ActivityQueryResult,
  ActivitySummary,
} from "./activity-display"

export async function getEnrichedMerchantActivity(
  merchantId: string,
  options: ActivityQueryOptions = {}
): Promise<ActivityQueryResult> {
  const scopedMerchantId = await requireCurrentMerchantId(merchantId)
  const limit = clampActivityLimit(options.limit)
  const filter = options.filter ?? "all"
  const supabase = createSupabaseServiceRoleClient()

  // Push the category filter into the DB so "Load more" grows the FILTERED set
  // — not a larger window of all event types — and so events past the window
  // stay reachable by raising the limit. Served by the composite index
  // (merchant_id, event_name, created_at desc). Over-fetch by one row to derive
  // `hasMore` cheaply (no count: "exact" heap touch) and to let a stamp pair
  // straddling the window boundary still thread instead of rendering as orphan
  // "requested"/"collected" cards.
  //
  // The free-text `q` is intentionally NOT pushed into the query: the only
  // first-class text column here is `event_name`, and narrowing on it would
  // hide rows whose match lives in the customer label, reward name, or
  // metadata (e.g. searching a customer name returns no events). Those joins
  // also carry PII we must not expose to a search predicate. `q` therefore
  // stays a client-side refinement over the loaded window (the feed filters on
  // its richer searchText index).
  const { data, error } = await supabase
    .from("product_events")
    .select(
      `
      id,
      event_name,
      created_at,
      actor_type,
      actor_id,
      customer_id,
      membership_id,
      qr_code_id,
      metadata,
      customer_memberships(id, current_stamp_count, total_stamps_earned, total_rewards_redeemed),
      qr_codes(qr_id, destination_type)
    `
    )
    .eq("merchant_id", scopedMerchantId)
    .in("event_name", eventsForCategory(filter))
    .order("created_at", { ascending: false })
    .limit(limit + 1)

  if (error) {
    throw new Error(`Unable to load activity: ${error.message}`)
  }

  const fetched = (data ?? []) as RawActivityRow[]
  const hasMore = fetched.length > limit
  const staffIds = new Set<string>()
  const rewardPoolItemIds = new Set<string>()
  const customerIds = new Set<string>()

  for (const row of fetched) {
    if (row.customer_id) {
      customerIds.add(row.customer_id)
    }

    if (row.actor_type === "staff" && row.actor_id) {
      staffIds.add(row.actor_id)
    }

    const rewardPoolItemId = row.metadata?.reward_pool_item_id
    if (rewardPoolItemId) {
      rewardPoolItemIds.add(String(rewardPoolItemId))
    }
  }

  const [staffById, rewardById, customerById] = await Promise.all([
    loadStaffUsers([...staffIds]),
    loadRewardPoolItems([...rewardPoolItemIds]),
    loadMaskedCustomers([...customerIds]),
  ])
  const rowsWithMaskedCustomers = fetched.map((row) => ({
    ...row,
    customers: row.customer_id
      ? (customerById.get(row.customer_id) ?? null)
      : null,
  }))

  // Thread over the full fetched window (including the +1 spare) but only emit
  // display rows for the first `limit` raw events; a boundary-straddling stamp
  // pair may borrow the spare so it threads instead of orphaning.
  const displayRows = threadActivityRows(
    rowsWithMaskedCustomers,
    staffById,
    rewardById,
    limit
  )
  const loadedCount = Math.min(fetched.length, limit)

  return {
    rows: displayRows.map(toSlimActivityRow),
    // No exact count is run anymore. totalCount reports the rows loaded so far;
    // whether more exist is carried by `hasMore` (the +1 sentinel), which gates
    // "Load more". When more exist we report loadedCount + 1 so totalCount stays
    // strictly greater than loadedCount for any "X of Y" affordance.
    totalCount: hasMore ? loadedCount + 1 : loadedCount,
    loadedCount,
    limit,
    hasMore,
  }
}


const ACTIVITY_SUMMARY_WINDOW_DAYS = 7

/**
 * A true 7-day pulse for the Activity "this week" strip — counted directly from
 * product_events over a fixed window (not the loaded/limited feed rows, which
 * would mislabel "recent N events" as a week). Stamp claims and reward unlocks
 * are excluded so a single visit/redemption is not double-counted.
 */
export async function getMerchantActivitySummary(
  merchantId: string
): Promise<ActivitySummary> {
  const scopedMerchantId = await requireCurrentMerchantId(merchantId)

  return cacheByScope(
    () => loadMerchantActivitySummary(scopedMerchantId),
    ["merchant-activity-summary", scopedMerchantId],
    [
      merchantCacheTag(scopedMerchantId),
      merchantActivitySummaryCacheTag(scopedMerchantId),
    ]
  )
}

async function loadMerchantActivitySummary(
  scopedMerchantId: string
): Promise<ActivitySummary> {
  const since = new Date(
    Date.now() - ACTIVITY_SUMMARY_WINDOW_DAYS * 86_400_000
  ).toISOString()
  const supabase = createSupabaseServiceRoleClient()
  const summary: ActivitySummary = {
    total: 0,
    joins: 0,
    stamps: 0,
    rewards: 0,
    qrEvents: 0,
    accountEvents: 0,
  }

  // SQL-side aggregation is the primary path: PostgREST caps row responses
  // at 1,000, so tallying fetched rows under-counts a busy week. The RPC
  // returns one bounded row per event name instead.
  const { data, error } = await supabase.rpc(
    "get_merchant_activity_event_counts",
    {
      target_merchant_id: scopedMerchantId,
      p_since: since,
      p_event_names: [...activityEvents],
    }
  )

  if (!error) {
    for (const row of Array.isArray(data) ? data : []) {
      const name =
        typeof row?.event_name === "string" ? row.event_name : null
      if (!name) continue
      applyActivityEventCount(summary, name, parseActivityEventCount(row.event_count))
    }
    return summary
  }

  // Deploy-before-migrate safety: fall back to the row-fetch tally until
  // the aggregation RPC exists in this environment.
  if (!isMissingActivityRpcError(error)) {
    throw new Error(`Unable to load activity summary: ${error.message}`)
  }

  const { data: rows, error: rowError } = await supabase
    .from("product_events")
    .select("event_name")
    .eq("merchant_id", scopedMerchantId)
    .in("event_name", [...activityEvents])
    .gte("created_at", since)

  if (rowError) {
    throw new Error(`Unable to load activity summary: ${rowError.message}`)
  }

  for (const raw of rows ?? []) {
    applyActivityEventCount(summary, raw.event_name, 1)
  }

  return summary
}

function applyActivityEventCount(
  summary: ActivitySummary,
  eventName: string,
  count: number
) {
  if (count <= 0) return
  switch (eventName) {
    case "customer_joined":
      summary.joins += count
      break
    case "stamp_issued":
      summary.stamps += count
      break
    case "reward_redeemed":
      summary.rewards += count
      break
    case "qr_downloaded":
    case "qr_scanned":
      summary.qrEvents += count
      break
    default:
      if (activityCategory(eventName) === "account") {
        summary.accountEvents += count
        break
      }
      return
  }
  summary.total += count
}

function parseActivityEventCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value))
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value)
  }
  return 0
}

function isMissingActivityRpcError(error: {
  readonly code?: string
  readonly message?: string
}) {
  if (error.code === "PGRST202") return true
  return (
    typeof error.message === "string" &&
    error.message.includes("Could not find the function")
  )
}

async function requireCurrentMerchantId(merchantId: string) {
  const merchant = await getCurrentMerchant()
  if (!merchant || merchant.id !== merchantId) {
    throw new Error("Current merchant access required for activity readback.")
  }

  return merchant.id
}


async function loadStaffUsers(ids: string[]) {
  const staffById = new Map<string, { display_name: string; role: string }>()
  if (!ids.length) return staffById

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("staff_users")
    .select("id, display_name, role")
    .in("id", ids)

  if (error) {
    throw new Error(`Unable to load staff activity context: ${error.message}`)
  }

  for (const staff of data ?? []) {
    staffById.set(staff.id, {
      display_name: staff.display_name,
      role: staff.role,
    })
  }

  return staffById
}

async function loadRewardPoolItems(ids: string[]) {
  const rewardById = new Map<string, { reward_name: string }>()
  if (!ids.length) return rewardById

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("reward_pool_items")
    .select("id, reward_name")
    .in("id", ids)

  if (error) {
    throw new Error(`Unable to load reward activity context: ${error.message}`)
  }

  for (const reward of data ?? []) {
    rewardById.set(reward.id, { reward_name: reward.reward_name })
  }

  return rewardById
}

async function loadMaskedCustomers(ids: string[]) {
  const customerById = new Map<
    string,
    { email: string | null; phone: string | null }
  >()
  if (!ids.length) return customerById

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customers_masked")
    .select("id, email, phone")
    .in("id", ids)

  if (error) {
    throw new Error(
      `Unable to load masked activity customers: ${error.message}`
    )
  }

  for (const customer of (data ?? []) as Array<{
    id: string
    email: string | null
    phone: string | null
  }>) {
    customerById.set(customer.id, {
      email: customer.email,
      phone: customer.phone,
    })
  }

  return customerById
}
