import { OPERATOR, SETUP_FEE } from "@/lib/marketing/facts"

/**
 * Rolling monthly promo. The end-of-month deadline is real and the first poster
 * run is included; availability is deliberately not quantified until fulfilment
 * has a durable reservation ledger. `getActivePromo` is the single runtime
 * source for every acquisition surface. The promo window also carries the
 * setup-fee waiver (`setupLine`): "£0 setup" claims must always render with
 * this real dated window, and every surface falls back to the standard-fee
 * copy when the promo is off.
 */
export const PROMO_CONFIG = {
  enabled: true,
} as const

export type ActivePromo = {
  readonly name: string
  readonly deadlineLabel: string
  readonly endDateISO: string
  readonly monthLabel: string
  readonly perk: string
  readonly setupLine: string
  readonly claim: string
}

type LondonMonthContext = {
  readonly year: number
  readonly month: number
  readonly endDateISO: string
  readonly deadlineLabel: string
  readonly monthLabel: string
}

const LONDON_TZ = "Europe/London"

/** en-CA formats as YYYY-MM-DD — stable for parsing London calendar dates. */
function getLondonYearMonth(now: Date): { year: number; month: number } {
  const [year, month] = new Intl.DateTimeFormat("en-CA", {
    timeZone: LONDON_TZ,
  })
    .format(now)
    .split("-")
    .map(Number)

  return { year, month }
}

function getLondonMonthContext(now: Date): LondonMonthContext {
  const { year, month } = getLondonYearMonth(now)
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
    endDateISO,
    deadlineLabel,
    monthLabel,
  }
}

/** Returns the live monthly promo, or null when promos are switched off. */
export function getActivePromo(
  now: Date = defaultPromoNow(),
  config: { readonly enabled: boolean } = PROMO_CONFIG
): ActivePromo | null {
  if (!config.enabled) {
    return null
  }

  const ctx = getLondonMonthContext(now)
  const name = `${ctx.monthLabel} First-Regular promo`
  const perk = `Go live by ${ctx.deadlineLabel} and we print and post your first counter-poster run — free.`
  const setupLine = `Book your launch by ${ctx.deadlineLabel} and the ${SETUP_FEE.standard} setup fee is ${SETUP_FEE.amount}.`
  const claim = `Go live before the date, then email ${OPERATOR.supportEmail} and we sort your print run.`

  return {
    name,
    deadlineLabel: ctx.deadlineLabel,
    endDateISO: ctx.endDateISO,
    monthLabel: ctx.monthLabel,
    perk,
    setupLine,
    claim,
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
