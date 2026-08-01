/**
 * Fixed, owner-approved campaign windows. A window must be added explicitly;
 * the code never invents a fresh deadline after one expires. The wrapper may
 * change, but the Growth Plan deliverables, prices and guarantees do not.
 */
export const SEASONAL_OFFER_WINDOWS = [
  {
    slug: "autumn-2026",
    name: "The Autumn First-Regular Launch",
    startDateISO: "2026-07-31",
    endDateISO: "2026-09-30",
    cohort: "autumn launch cohort",
  },
  {
    slug: "christmas-2026",
    name: "The Christmas Regulars Launch",
    startDateISO: "2026-10-01",
    endDateISO: "2026-11-30",
    cohort: "Christmas launch cohort",
  },
  {
    slug: "new-year-2027",
    name: "The New Year First-Regular Launch",
    startDateISO: "2026-12-01",
    endDateISO: "2027-01-31",
    cohort: "New Year launch cohort",
  },
  {
    slug: "spring-2027",
    name: "The Spring First-Regular Launch",
    startDateISO: "2027-02-01",
    endDateISO: "2027-03-31",
    cohort: "spring launch cohort",
  },
] as const

export type SeasonalOffer = {
  readonly slug: string
  readonly name: string
  readonly startDateISO: string
  readonly endDateISO: string
  readonly deadlineLabel: string
  readonly cohort: string
  readonly deadlineLine: string
  readonly termsLine: string
}

const LONDON_TZ = "Europe/London"

function londonCalendarDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LONDON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)
}

function formatDeadline(dateISO: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateISO}T12:00:00Z`))
}

/** Return a configured wrapper only while its fixed London-date window is live. */
export function getActiveSeasonalOffer(
  now: Date = defaultSeasonalOfferNow()
): SeasonalOffer | null {
  const today = londonCalendarDate(now)
  const window = SEASONAL_OFFER_WINDOWS.find(
    (candidate) =>
      today >= candidate.startDateISO && today <= candidate.endDateISO
  )

  if (!window) return null

  const deadlineLabel = formatDeadline(window.endDateISO)

  return {
    ...window,
    deadlineLabel,
    deadlineLine: `Join the ${window.cohort} by ${deadlineLabel}.`,
    termsLine:
      "The wrapper and deadline do not change the standard Growth Plan deliverables, prices or guarantee conditions.",
  }
}

function defaultSeasonalOfferNow(): Date {
  const frozenNow = process.env.PLAYWRIGHT_MARKETING_OFFER_NOW?.trim()
  if (frozenNow) {
    const parsed = new Date(frozenNow)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }

  return new Date()
}
