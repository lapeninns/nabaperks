/**
 * Copy-driven templates resolved through getPosterCopy. Concept posters (e.g.
 * "northstar") ship their own copy and are intentionally excluded here, so
 * adding one to the registry never forces a TEMPLATE_HOOKS entry.
 */
export type CopyPosterTemplateId = "editorial" | "bold" | "ticket"

export type PosterData = {
  /** Merchant business name. */
  readonly businessName: string
  /** Location / branch name. */
  readonly locationName: string
  /** Stamps needed to unlock the mystery reward. */
  readonly stampsRequired: number
}

export type PosterHeadline = {
  readonly beforeAccent: string
  readonly accent: string
  readonly afterAccent: string
}

export type PosterCopy = PosterData & {
  readonly template: CopyPosterTemplateId
  /** Giant headline with one accent word. */
  readonly headline: PosterHeadline
  /** Tiny trust/identity eyebrow. */
  readonly eyebrow: string
  /** Supporting line under the hook. */
  readonly support: string
  /** Forbidden-fruit teaser — intrigue on the mystery reward. */
  readonly forbidden: string
  /** The friction-killer strip. */
  readonly frictionLine: string
  /** The QR imperative. */
  readonly qrCaption: string
  /** Endowed-progress line, mystery framing. */
  readonly progress: string
  /** Tiny reassurance — never names the reward. */
  readonly reassurance: string
}

const NUMBER_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
]

function spell(value: number): string {
  return NUMBER_WORDS[value] ?? String(value)
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function buildProgress(stampsRequired: number): string {
  const remaining = stampsRequired - 1

  if (stampsRequired === 1) {
    return "Don't leave your first stamp behind — scan now to unlock it."
  }

  const visitVerb = remaining === 1 ? "visit unlocks" : "visits unlock"
  return `You're already 1 stamp in — don't leave it behind. ${capitalise(spell(remaining))} more ${visitVerb} your mystery reward.`
}

function buildSupport(stampsRequired: number): string {
  if (stampsRequired === 1) {
    return "Your first stamp's on us — and it unlocks a mystery reward."
  }

  return "Your first stamp's on us. The rest unlock a mystery reward."
}

function buildEyebrow(businessName: string, locationName: string): string {
  const business = businessName.trim()
  const location = locationName.trim()

  // Single-site venues often repeat the name across both fields. Show it once —
  // keeping whichever string carries more detail — so the eyebrow never reads
  // "Old Crown Girton · Old Crown Girton".
  if (!location || location === business) return business
  if (business.includes(location)) return business
  if (location.includes(business)) return location

  return `${business} · ${location}`
}

type CopyContext = {
  readonly stampsRequired: number
}

const TEMPLATE_HOOKS: Record<
  CopyPosterTemplateId,
  (ctx: CopyContext) => Pick<
    PosterCopy,
    | "headline"
    | "support"
    | "forbidden"
    | "frictionLine"
    | "qrCaption"
    | "reassurance"
  >
> = {
  bold: ({ stampsRequired }) => ({
    headline: {
      beforeAccent: "Everyone ",
      accent: "wins",
      afterAccent: " something.",
    },
    support: buildSupport(stampsRequired),
    forbidden: "We're not allowed to tell you what it is.",
    frictionLine: "No app · 20 seconds · No spam",
    qrCaption: "Scan to claim your free stamp",
    reassurance: "One stamp a day · Reward revealed when unlocked",
  }),
  editorial: ({ stampsRequired }) => ({
    headline:
      stampsRequired === 1
        ? {
            beforeAccent: "One visit. One ",
            accent: "surprise",
            afterAccent: ".",
          }
        : {
            beforeAccent: `${capitalise(spell(stampsRequired))} visits. One `,
            accent: "surprise",
            afterAccent: ".",
          },
    support:
      stampsRequired === 1
        ? "Start with a free stamp — the reward stays a mystery until you unlock it."
        : "Your first stamp is already waiting. Collect the rest to reveal what you've earned.",
    forbidden: "We can't tell you what it is. That's the point.",
    frictionLine: "No app download · Scan in 20 seconds",
    qrCaption: "Scan to unlock your mystery reward",
    reassurance: "Stamps count once per day · Mystery until unlock",
  }),
  ticket: ({ stampsRequired }) => ({
    headline: {
      beforeAccent: "First stamp's ",
      accent: "free",
      afterAccent: ".",
    },
    support:
      stampsRequired === 1
        ? "Claim it now — your mystery reward unlocks straight after."
        : "Claim stamp one today. The rest unlock your mystery reward.",
    forbidden: "Staff won't spoil it. We won't either.",
    frictionLine: "No account needed · Takes 20 seconds",
    qrCaption: "Scan here to claim your free stamp",
    reassurance: "One stamp per visit · Mystery until unlock",
  }),
}

export function getPosterCopy(
  data: PosterData,
  template: CopyPosterTemplateId
): PosterCopy {
  const stampsRequired = Math.max(1, data.stampsRequired)
  const hook = TEMPLATE_HOOKS[template]({ stampsRequired })

  return {
    ...data,
    template,
    stampsRequired,
    eyebrow: buildEyebrow(data.businessName, data.locationName),
    progress: buildProgress(stampsRequired),
    ...hook,
  }
}
