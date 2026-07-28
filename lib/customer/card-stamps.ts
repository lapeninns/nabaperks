import "server-only"

import { REFERRAL_BONUS_STAMP_LABEL } from "@/lib/customer/card-stamp-labels"
import { formatStampDisplayDateFromIso } from "@/lib/customer/uk-calendar"
import { ukTodayIso } from "@/lib/customer/uk-date"
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
  activeCycleByMembership: ReadonlyMap<string, number>
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
  const today = ukTodayIso()
  const activeCycleFilters = uniqueMembershipIds.map((membershipId) => {
    const cycleNumber = activeCycleByMembership.get(membershipId)
    if (typeof cycleNumber !== "number" || !Number.isFinite(cycleNumber)) {
      throw new Error(
        `Active stamp cycle missing for membership ${membershipId}`
      )
    }

    return `and(membership_id.eq.${membershipId},cycle_number.eq.${cycleNumber})`
  })

  const [activeCycleResult, todayResult] = await Promise.all([
    supabase
      .from("stamp_events")
      .select("membership_id, earned_business_date, cycle_number, metadata")
      .eq("event_type", "earned")
      .or(activeCycleFilters.join(","))
      .order("created_at", { ascending: true }),
    supabase
      .from("stamp_events")
      .select("membership_id")
      .in("membership_id", uniqueMembershipIds)
      .eq("event_type", "earned")
      .eq("earned_business_date", today),
  ])

  if (activeCycleResult.error) {
    throw new Error(
      `Unable to load active-cycle stamp dates: ${activeCycleResult.error.message}`
    )
  }
  if (todayResult.error) {
    throw new Error(
      `Unable to load today's stamp status: ${todayResult.error.message}`
    )
  }

  const labelsByMembership = new Map<string, string[]>()
  const stampedTodayMemberships = new Set(
    (todayResult.data ?? []).map((row) => row.membership_id)
  )

  for (const row of (activeCycleResult.data ??
    []) as RawMembershipStampEvent[]) {
    const labels = labelsByMembership.get(row.membership_id) ?? []
    if (labels.length < limitByMembership) {
      labels.push(stampEventDisplayLabel(row))
      labelsByMembership.set(row.membership_id, labels)
    }
  }

  for (const membershipId of uniqueMembershipIds) {
    stampDatesByMembership.set(membershipId, {
      stampDates: labelsByMembership.get(membershipId) ?? [],
      latestBusinessDate: stampedTodayMemberships.has(membershipId)
        ? today
        : null,
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
