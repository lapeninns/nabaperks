import "server-only"

import { formatStampDisplayDateFromIso } from "@/lib/customer/uk-calendar"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

type RawMembershipStampEvent = {
  membership_id: string
  earned_business_date: string | null
  cycle_number: number | null
}

export type MembershipStampDisplayDates = {
  readonly stampDates: string[]
  readonly latestBusinessDate: string | null
}

export async function getMembershipStampDisplayDates(
  membershipId: string,
  limit: number,
  cycleNumber?: number | null
): Promise<string[]> {
  const supabase = createSupabaseServiceRoleClient()
  let query = supabase
    .from("stamp_events")
    .select("earned_business_date")
    .eq("membership_id", membershipId)
    .eq("event_type", "earned")

  if (typeof cycleNumber === "number" && Number.isFinite(cycleNumber)) {
    query = query.eq("cycle_number", cycleNumber)
  }

  const { data, error } = await query
    .order("earned_business_date", { ascending: true })
    .limit(limit)

  if (error) {
    throw new Error(`Unable to load stamp dates: ${error.message}`)
  }

  return (data ?? [])
    .map((row) => row.earned_business_date)
    .filter((date): date is string => typeof date === "string")
    .map(formatStampDisplayDateFromIso)
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
    .select("membership_id, earned_business_date, cycle_number")
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

  const { data, error } = await query.order("earned_business_date", {
    ascending: true,
  })

  if (error) {
    throw new Error(`Unable to load stamp dates: ${error.message}`)
  }

  const rawDatesByMembership = new Map<string, string[]>()

  for (const row of (data ?? []) as RawMembershipStampEvent[]) {
    if (typeof row.earned_business_date !== "string") continue

    const activeCycle = activeCycleByMembership?.get(row.membership_id)
    if (activeCycle !== undefined && row.cycle_number !== activeCycle) continue

    const dates = rawDatesByMembership.get(row.membership_id) ?? []
    if (dates.length < limitByMembership) {
      dates.push(row.earned_business_date)
      rawDatesByMembership.set(row.membership_id, dates)
    }
  }

  for (const [membershipId, rawDates] of rawDatesByMembership) {
    stampDatesByMembership.set(membershipId, {
      stampDates: rawDates.map(formatStampDisplayDateFromIso),
      latestBusinessDate: rawDates.at(-1) ?? null,
    })
  }

  return stampDatesByMembership
}

export function reconcileCardStampCount({
  stampDateCount,
  total,
}: {
  membershipCount: number
  stampDateCount: number
  total: number
}) {
  return Math.min(stampDateCount, total)
}
