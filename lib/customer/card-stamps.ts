import "server-only"

import { REFERRAL_BONUS_STAMP_LABEL } from "@/lib/customer/card-stamp-labels"
import { formatStampDisplayDateFromIso } from "@/lib/customer/uk-calendar"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export {
  reconcileCardStampCount,
  stampDisplayLabelsForCount,
} from "@/lib/customer/card-stamp-labels"

type RawMembershipStampEvent = {
  membership_id: string
  earned_business_date: string | null
  cycle_number: number | null
  metadata: unknown
}

export type MembershipStampDisplayDates = {
  readonly stampDates: string[]
  readonly latestBusinessDate: string | null
}

const UNKNOWN_STAMP_LABEL = "Stamp"

export async function getMembershipStampDisplayDates(
  membershipId: string,
  limit: number,
  cycleNumber?: number | null
): Promise<string[]> {
  const supabase = createSupabaseServiceRoleClient()
  let query = supabase
    .from("stamp_events")
    .select("earned_business_date, metadata")
    .eq("membership_id", membershipId)
    .eq("event_type", "earned")

  if (typeof cycleNumber === "number" && Number.isFinite(cycleNumber)) {
    query = query.eq("cycle_number", cycleNumber)
  }

  const { data, error } = await query
    .order("created_at", { ascending: true })
    .limit(limit)

  if (error) {
    throw new Error(`Unable to load stamp dates: ${error.message}`)
  }

  return (data ?? []).map(stampEventDisplayLabel)
}

export async function getMembershipStampDisplayDatesByMembership(
  membershipIds: readonly string[],
  limitByMembership: number,
  activeCycleByMembership?: ReadonlyMap<string, number>
): Promise<Map<string, MembershipStampDisplayDates>> {
  const uniqueMembershipIds = [...new Set(membershipIds)]
  const stampDatesByMembership = new Map<string, MembershipStampDisplayDates>()

  for (const membershipId of uniqueMembershipIds) {
    stampDatesByMembership.set(membershipId, {
      stampDates: [],
      latestBusinessDate: null,
    })
  }

  if (uniqueMembershipIds.length === 0) return stampDatesByMembership

  const supabase = createSupabaseServiceRoleClient()
  let query = supabase
    .from("stamp_events")
    .select("membership_id, earned_business_date, cycle_number, metadata")
    .in("membership_id", uniqueMembershipIds)
    .eq("event_type", "earned")

  const activeCycleFilter =
    activeCycleByMembership && activeCycleByMembership.size > 0
      ? uniqueMembershipIds
          .map((membershipId) => {
            const activeCycle = activeCycleByMembership.get(membershipId)
            return activeCycle === undefined
              ? `membership_id.eq.${membershipId}`
              : `and(membership_id.eq.${membershipId},cycle_number.eq.${activeCycle})`
          })
          .join(",")
      : null

  if (activeCycleFilter !== null && typeof query.or === "function") {
    query = query.or(activeCycleFilter)
  }

  const { data, error } = await query.order("created_at", {
    ascending: true,
  })

  if (error) {
    throw new Error(`Unable to load stamp dates: ${error.message}`)
  }

  const labelsByMembership = new Map<string, string[]>()
  const latestBusinessDateByMembership = new Map<string, string>()

  for (const row of (data ?? []) as RawMembershipStampEvent[]) {
    const activeCycle = activeCycleByMembership?.get(row.membership_id)
    if (activeCycle !== undefined && row.cycle_number !== activeCycle) continue

    const labels = labelsByMembership.get(row.membership_id) ?? []
    if (labels.length < limitByMembership) {
      labels.push(stampEventDisplayLabel(row))
      labelsByMembership.set(row.membership_id, labels)
    }

    if (typeof row.earned_business_date === "string") {
      latestBusinessDateByMembership.set(
        row.membership_id,
        row.earned_business_date
      )
    }
  }

  for (const [membershipId, stampDates] of labelsByMembership) {
    stampDatesByMembership.set(membershipId, {
      stampDates,
      latestBusinessDate:
        latestBusinessDateByMembership.get(membershipId) ?? null,
    })
  }

  return stampDatesByMembership
}

function stampEventDisplayLabel(event: {
  earned_business_date: string | null
  metadata?: unknown
}): string {
  if (typeof event.earned_business_date === "string") {
    return formatStampDisplayDateFromIso(event.earned_business_date)
  }

  return stampEventSource(event.metadata) === "referral_bonus"
    ? REFERRAL_BONUS_STAMP_LABEL
    : UNKNOWN_STAMP_LABEL
}

function stampEventSource(metadata: unknown): string | null {
  if (!isRecord(metadata)) return null

  const source = metadata.source
  return typeof source === "string" ? source : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
