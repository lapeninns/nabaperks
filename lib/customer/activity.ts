import "server-only"

import {
  customerActivityCategory,
  customerActivityEventNames,
  isCustomerActivityEventName,
  parseCustomerActivityMetadata,
  shapeCustomerActivityItem,
  type CustomerActivityCategory,
  type CustomerActivityItem,
  type CustomerActivityRow,
} from "@/lib/customer/activity-core"
import { getCurrentCustomer } from "@/lib/customer/identity"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type { CustomerActivityCategory, CustomerActivityItem }

type RawCustomerActivityRow = {
  readonly id: string
  readonly event_name: string
  readonly created_at: string
  readonly metadata: unknown
  readonly merchants: unknown
}

const DEFAULT_LIMIT = 40
const MAX_LIMIT = 100

/**
 * The signed-in customer's own activity stream — joins, stamps, and rewards
 * across every venue, newest first. A lean, customer-scoped counterpart to the
 * merchant feed in `getEnrichedMerchantActivity` ([lib/merchant/activity.ts]).
 */
export async function getCustomerActivity(
  limit = DEFAULT_LIMIT
): Promise<CustomerActivityItem[]> {
  const customer = await getCurrentCustomer()

  if (!customer) return []

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("product_events")
    .select("id, event_name, created_at, metadata, merchants(business_name)")
    .eq("customer_id", customer.id)
    .in("event_name", [...customerActivityEventNames()])
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), MAX_LIMIT))

  if (error) {
    throw new Error(`Unable to load activity: ${error.message}`)
  }

  return customerActivityRowsFromQuery(data).map((row) =>
    shapeCustomerActivityItem(row)
  )
}

function customerActivityRowsFromQuery(value: unknown): CustomerActivityRow[] {
  const rows: CustomerActivityRow[] = []
  if (!Array.isArray(value)) return rows

  for (const item of value) {
    const row = customerActivityRowFromQuery(item)
    if (row) rows.push(row)
  }

  return rows
}

function customerActivityRowFromQuery(
  value: unknown
): CustomerActivityRow | null {
  const row = rawCustomerActivityRow(value)
  if (!row || !isCustomerActivityEventName(row.event_name)) return null

  return {
    id: row.id,
    eventName: row.event_name,
    category: customerActivityCategory(row.event_name),
    metadata: parseCustomerActivityMetadata(row.metadata),
    businessName: businessNameFromRelation(row.merchants),
    createdAt: row.created_at,
  }
}

function rawCustomerActivityRow(value: unknown): RawCustomerActivityRow | null {
  if (!isRecord(value)) return null

  const id = stringValue(value.id)
  const eventName = stringValue(value.event_name)
  const createdAt = stringValue(value.created_at)
  if (!id || !eventName || !createdAt) return null

  return {
    id,
    event_name: eventName,
    created_at: createdAt,
    metadata: value.metadata,
    merchants: value.merchants,
  }
}

function businessNameFromRelation(value: unknown): string | null {
  const merchant = firstRelationRecord(value)
  return merchant ? nullableString(merchant.business_name) : null
}

function firstRelationRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return relationRecordFromArray(value)
  return isRecord(value) ? value : null
}

function relationRecordFromArray(
  value: readonly unknown[]
): Record<string, unknown> | null {
  for (const item of value) {
    if (isRecord(item)) return item
  }

  return null
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
