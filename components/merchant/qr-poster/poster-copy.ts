/**
 * Copy-driven templates resolved through getPosterCopy. Concept posters (e.g.
 * "northstar") ship their own copy and are intentionally excluded here, so
 * adding one to the registry never forces a TEMPLATE_HOOKS entry.
 */
export type CopyPosterTemplateId = "editorial" | "bold" | "ticket"

export type PosterData = {
  readonly businessName: string
  /** Stamps needed to unlock the mystery reward. */
  readonly stampsRequired: number
}

export type PosterHeadline = {
  readonly beforeAccent: string
  readonly accent: string
  readonly afterAccent: string
}

/** Stamp rule + mystery framing — shared footer on every A4 template. */
export const POSTER_REASSURANCE =
  "One stamp per day · Mystery until unlock" as const

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
    return "Your first stamp's on us — claim it now."
  }

  return "Your first stamp's already waiting — collect the rest to unlock the mystery."
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
    frictionLine: "No app · No download · No spam",
    qrCaption: "Scan to claim your free stamp",
    reassurance: POSTER_REASSURANCE,
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
    support: buildSupport(stampsRequired),
    forbidden: "We can't tell you what it is. That's the point.",
    frictionLine: "No app · Opens in your browser",
    qrCaption: "Scan to unlock your mystery reward",
    reassurance: POSTER_REASSURANCE,
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
        : "Claim stamp one today — the rest unlock the mystery.",
    forbidden: "Staff won't spoil it. We won't either.",
    frictionLine: "No account needed · Scan with your camera",
    qrCaption: "Scan here to claim your free stamp",
    reassurance: POSTER_REASSURANCE,
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
    eyebrow: data.businessName.trim(),
    progress: buildProgress(stampsRequired),
    ...hook,
  }
}
