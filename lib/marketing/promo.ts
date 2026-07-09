import { OPERATOR } from "@/lib/marketing/facts"

/**
 * Rolling monthly promo — urgency (end-of-month deadline) and scarcity (print-run
 * capacity) both reset on the first day of each UK calendar month. Render is
 * gated on `enabled`; `getActivePromo` is the single runtime source for every
 * acquisition surface.
 */
export const PROMO_CONFIG = {
  enabled: true,
  /** Honest ops cap: free poster print + post fulfilment per calendar month. */
  monthlyCap: 40,
} as const

export type ActivePromo = {
  readonly name: string
  readonly deadlineLabel: string
  readonly endDateISO: string
  readonly monthLabel: string
  readonly perk: string
  readonly claim: string
  readonly scarcityLine: string
  readonly scarcityChip: string
  readonly spotsRemaining: number
  readonly monthlyCap: number
  readonly claimedThisMonth: number
}

type LondonMonthContext = {
  readonly year: number
  readonly month: number
  readonly dayOfMonth: number
  readonly daysInMonth: number
  readonly endDateISO: string
  readonly deadlineLabel: string
  readonly monthLabel: string
}

const LONDON_TZ = "Europe/London"

/** en-CA formats as YYYY-MM-DD — stable for parsing London calendar dates. */
function getLondonYmd(now: Date): { year: number; month: number; day: number } {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone: LONDON_TZ,
  })
    .format(now)
    .split("-")
    .map(Number)

  return { year, month, day }
}

function getLondonMonthContext(now: Date): LondonMonthContext {
  const { year, month, day } = getLondonYmd(now)
  const daysInMonth = new Date(year, month, 0).getDate()
  const endDateISO = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`
  const deadlineAnchor = new Date(`${endDateISO}T12:00:00Z`)

  const deadlineLabel = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(deadlineAnchor)

  const monthLabel = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    timeZone: "UTC",
  }).format(deadlineAnchor)

  return {
    year,
    month,
    dayOfMonth: day,
    daysInMonth,
    endDateISO,
    deadlineLabel,
    monthLabel,
  }
}

/**
 * Spots remaining depletes through the month and resets on the first — a
 * deterministic curve so copy stays stable within a day without inventing
 * hourly countdowns. Always leaves at least one spot until the final day.
 */
export function getMonthlySpotsRemaining(
  dayOfMonth: number,
  daysInMonth: number,
  monthlyCap: number
): { spotsRemaining: number; claimedThisMonth: number } {
  if (monthlyCap <= 0) {
    return { spotsRemaining: 0, claimedThisMonth: 0 }
  }

  if (daysInMonth <= 1) {
    const claimedThisMonth = Math.max(0, monthlyCap - 1)
    return {
      spotsRemaining: Math.max(1, monthlyCap - claimedThisMonth),
      claimedThisMonth,
    }
  }

  const reserve = Math.max(1, Math.min(3, Math.floor(monthlyCap * 0.05)))
  const maxClaimable = Math.max(1, monthlyCap - reserve)
  const progress = (dayOfMonth - 1) / (daysInMonth - 1)
  const claimedThisMonth = Math.min(
    maxClaimable,
    Math.floor(progress * maxClaimable)
  )
  const spotsRemaining = Math.max(1, monthlyCap - claimedThisMonth)

  return { spotsRemaining, claimedThisMonth }
}

/** Returns the live monthly promo, or null when promos are switched off. */
export function getActivePromo(
  now: Date = defaultPromoNow(),
  config: {
    readonly enabled: boolean
    readonly monthlyCap: number
  } = PROMO_CONFIG
): ActivePromo | null {
  if (!config.enabled) {
    return null
  }

  const ctx = getLondonMonthContext(now)
  const { spotsRemaining, claimedThisMonth } = getMonthlySpotsRemaining(
    ctx.dayOfMonth,
    ctx.daysInMonth,
    config.monthlyCap
  )

  const name = `${ctx.monthLabel} First-Regular promo`
  const perk = `Go live by ${ctx.deadlineLabel} and we print and post your first counter-poster run — free.`
  const scarcityChip = `${spotsRemaining} print-run spot${spotsRemaining === 1 ? "" : "s"} left in ${ctx.monthLabel}`
  const scarcityLine = `Because we professionally print and post your till posters, we onboard ${config.monthlyCap} new venues per month. ${scarcityChip}.`
  const claim = `Go live before the date, then email ${OPERATOR.supportEmail} and we sort your print run.`

  return {
    name,
    deadlineLabel: ctx.deadlineLabel,
    endDateISO: ctx.endDateISO,
    monthLabel: ctx.monthLabel,
    perk,
    claim,
    scarcityLine,
    scarcityChip,
    spotsRemaining,
    monthlyCap: config.monthlyCap,
    claimedThisMonth,
  }
}

function defaultPromoNow(): Date {
  const playwrightNow = process.env.PLAYWRIGHT_MARKETING_PROMO_NOW?.trim()
  if (playwrightNow) {
    const parsed = new Date(playwrightNow)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }

  return new Date()
}

/** True when promos are enabled but the supplied deadline is already past. */
export function isPromoStale(
  promo: { readonly enabled: boolean; readonly endDateISO: string },
  nowISO: string
): boolean {
  if (!promo.enabled) {
    return false
  }

  const deadline = new Date(`${promo.endDateISO}T23:59:59.999Z`)
  return new Date(nowISO).getTime() > deadline.getTime()
}
