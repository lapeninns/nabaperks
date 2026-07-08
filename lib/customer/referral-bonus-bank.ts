import "server-only"

import { formatLondonIso } from "@/lib/customer/uk-calendar"
import { ukTodayIso } from "@/lib/customer/uk-date"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type ReferralBonusBank = {
  readonly banked: number
  readonly awardedToday: number
}

export function emptyReferralBonusBank(): ReferralBonusBank {
  return { banked: 0, awardedToday: 0 }
}

export async function getReferralBonusBank(
  membershipId: string
): Promise<ReferralBonusBank> {
  const banks = await getReferralBonusBanksByMembership([membershipId])
  return banks.get(membershipId) ?? emptyReferralBonusBank()
}

export async function getReferralBonusBanksByMembership(
  membershipIds: readonly string[]
): Promise<Map<string, ReferralBonusBank>> {
  const uniqueMembershipIds = [...new Set(membershipIds)]
  const banks = new Map<string, ReferralBonusBank>()

  for (const membershipId of uniqueMembershipIds) {
    banks.set(membershipId, emptyReferralBonusBank())
  }

  if (uniqueMembershipIds.length === 0) return banks

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("referrals")
    .select(
      "referrer_membership_id, referrer_bonus_due_at, referrer_bonus_awarded_at"
    )
    .in("referrer_membership_id", uniqueMembershipIds)

  if (error) {
    throw new Error(`Unable to load referral bonus bank: ${error.message}`)
  }

  const today = ukTodayIso()
  const rows: unknown = data

  if (!Array.isArray(rows)) return banks

  for (const row of rows) {
    if (!isRecord(row)) continue

    const membershipId = stringValue(row.referrer_membership_id)
    if (!membershipId || !banks.has(membershipId)) continue

    const bonusDue = typeof row.referrer_bonus_due_at === "string"
    const bonusAwarded = typeof row.referrer_bonus_awarded_at === "string"

    if (bonusDue && !bonusAwarded) {
      incrementBank(banks, membershipId, "banked")
    }

    if (isAwardedToday(row.referrer_bonus_awarded_at, today)) {
      incrementBank(banks, membershipId, "awardedToday")
    }
  }

  return banks
}

export async function drainReferralBonusBank(
  membershipId: string
): Promise<number> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc(
    "drain_due_referrer_bonuses_for_membership",
    { p_referrer_membership_id: membershipId }
  )

  if (error) {
    throw new Error(`Unable to drain referral bonus bank: ${error.message}`)
  }

  return numberValue(data) ?? 0
}

function incrementBank(
  banks: Map<string, ReferralBonusBank>,
  membershipId: string,
  key: keyof ReferralBonusBank
) {
  const bank = banks.get(membershipId) ?? emptyReferralBonusBank()
  banks.set(membershipId, {
    ...bank,
    [key]: bank[key] + 1,
  })
}

function isAwardedToday(value: unknown, today: string): boolean {
  if (typeof value !== "string") return false

  const awardedAt = new Date(value)
  if (!Number.isFinite(awardedAt.getTime())) return false

  return formatLondonIso(awardedAt) === today
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
