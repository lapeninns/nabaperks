import type { ReferralBonusBank } from "@/lib/customer/referral-bonus-bank"

export const REFERRAL_BONUS_DAILY_CAP = 2

type ReferralBonusBankStat = {
  readonly label: string
  readonly value: string
}

export type ReferralBonusBankCopy = {
  readonly headline: string
  readonly badgeLabel: string
  readonly detail: string
  readonly compactDetail: string
  readonly ruleSummary: string
  readonly stats: readonly ReferralBonusBankStat[]
}

export function hasVisibleReferralBonusBank(
  bank: ReferralBonusBank | null | undefined
): bank is ReferralBonusBank {
  return Boolean(bank && (bank.banked > 0 || bank.awardedToday > 0))
}

export function referralBonusBankCopy(
  bank: ReferralBonusBank
): ReferralBonusBankCopy {
  const banked = Math.max(0, bank.banked)
  const awardedToday = Math.max(0, bank.awardedToday)
  const remainingToday = Math.max(REFERRAL_BONUS_DAILY_CAP - awardedToday, 0)
  const canApplyToday = Math.min(banked, remainingToday)
  const staysBanked = Math.max(banked - canApplyToday, 0)

  return {
    headline:
      banked > 0
        ? pluralise(banked, "referral bonus", "referral bonuses", "banked")
        : pluralise(
            awardedToday,
            "referral bonus",
            "referral bonuses",
            "applied today"
          ),
    badgeLabel: `${Math.min(awardedToday, REFERRAL_BONUS_DAILY_CAP)} / ${REFERRAL_BONUS_DAILY_CAP} today`,
    detail: detailCopy({
      banked,
      canApplyToday,
      staysBanked,
      remainingToday,
    }),
    compactDetail: compactDetailCopy({
      banked,
      canApplyToday,
      staysBanked,
      remainingToday,
    }),
    ruleSummary: ruleSummaryCopy({ banked }),
    stats: [
      { label: "Banked", value: String(banked) },
      {
        label: "Used today",
        value: String(Math.min(awardedToday, REFERRAL_BONUS_DAILY_CAP)),
      },
      { label: "Next scan", value: String(canApplyToday) },
    ],
  }
}

function detailCopy({
  banked,
  canApplyToday,
  staysBanked,
  remainingToday,
}: {
  readonly banked: number
  readonly canApplyToday: number
  readonly staysBanked: number
  readonly remainingToday: number
}): string {
  if (banked === 0) {
    return "You still keep your venue stamp separately. Referral bonuses are capped at 2 per UK business day."
  }

  if (remainingToday === 0) {
    return "Your venue stamp can still land today. Referral bonus limit is full, so these stay banked for another UK business day."
  }

  const applyCopy = countNoun(
    canApplyToday,
    "banked referral bonus",
    "banked referral bonuses"
  )
  if (staysBanked === 0) {
    return `Your venue stamp lands first. Then ${applyCopy} can be added today.`
  }

  return `Your venue stamp lands first. Then ${applyCopy} can be added today; ${staysBankedCopy(staysBanked)}.`
}

function compactDetailCopy({
  banked,
  canApplyToday,
  staysBanked,
  remainingToday,
}: {
  readonly banked: number
  readonly canApplyToday: number
  readonly staysBanked: number
  readonly remainingToday: number
}): string {
  if (banked === 0) {
    return "Venue stamps are separate. Referral bonus limit: 2 per UK business day."
  }

  if (remainingToday === 0) {
    return "Venue stamp can still land; bonuses stay banked after 2 today."
  }

  if (staysBanked === 0) {
    return `Venue stamp first, then ${countNoun(canApplyToday, "bonus stamp")} today.`
  }

  return `Venue stamp first, then ${countNoun(canApplyToday, "bonus stamp")} today; ${staysBankedCopy(staysBanked)}.`
}

function ruleSummaryCopy({ banked }: { readonly banked: number }): string {
  if (banked === 0) {
    return `Venue stamps stay separate from the ${REFERRAL_BONUS_DAILY_CAP}-per-day referral bonus limit.`
  }

  return `Venue stamp first. Up to ${REFERRAL_BONUS_DAILY_CAP} referral bonus stamps can land per UK business day; the rest stay banked.`
}

function countNoun(
  count: number,
  singular: string,
  plural = `${singular}s`
): string {
  return count === 1 ? `${count} ${singular}` : `${count} ${plural}`
}

function pluralise(
  count: number,
  singular: string,
  plural: string,
  suffix: string
): string {
  return `${countNoun(count, singular, plural)} ${suffix}`
}

function staysBankedCopy(count: number): string {
  return count === 1 ? "1 stays banked" : `${count} stay banked`
}
