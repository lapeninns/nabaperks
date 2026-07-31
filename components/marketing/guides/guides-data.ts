import {
  BONUS_STACK,
  CORE_OFFER,
  DFY_LAUNCH,
  GUARANTEE,
  MARKET,
  PRODUCT,
  ROUTES,
  VALUE_MATH,
} from "@/lib/marketing/facts"

export type GuideSection = {
  readonly heading: string
  readonly paragraphs: readonly string[]
}

export type ComparisonRow = {
  readonly aspect: string
  readonly paper: string
  readonly qr: string
}

export type Guide = {
  readonly slug: string
  readonly path: string
  readonly title: string
  readonly metaTitle: string
  readonly description: string
  readonly intro: string
  readonly publishedOn: string
  readonly updatedOn: string
  readonly sections: readonly GuideSection[]
  /** When set, the comparison table renders after this section heading. */
  readonly comparisonAfterHeading?: string
}

/**
 * Paper vs QR, stated honestly in both directions. Product-side cells read
 * from the shared marketing facts; paper-side cells describe paper cards
 * generically and never invent a stat.
 */
export const PAPER_VS_QR_ROWS: readonly ComparisonRow[] = [
  {
    aspect: "Getting started",
    paper: "Order printed cards, hand them out at the till",
    qr: "One venue QR — the card opens in the browser",
  },
  {
    aspect: "For the guest",
    paper: "Another card to carry, easy to lose",
    qr: "Nothing to install; the card lives in their browser",
  },
  {
    aspect: "At the till",
    paper: "Any ink stamp, no verification",
    qr: `${PRODUCT.counterStampLong[0].toUpperCase()}${PRODUCT.counterStampLong.slice(1)}, one claim per customer per UK date`,
  },
  {
    aspect: "What you learn",
    paper: "Nothing is recorded",
    qr: "Visits, members and returning customers in a dashboard, plus a weekly digest",
  },
  {
    aspect: "Ongoing cost",
    paper: "Reprints whenever cards run out",
    qr: `${PRODUCT.price} after the ${PRODUCT.pilot}`,
  },
]

/**
 * The three marketing guides, grounded in the offer pack's no-app, done-for-you
 * and midweek angles. Every product/offer fact is interpolated from
 * `lib/marketing/facts.ts`; only generic editorial framing is written here.
 */
export const GUIDES: readonly Guide[] = [
  {
    slug: "reward-regulars-without-an-app",
    path: ROUTES.guideNoApp,
    title: "Reward regulars without an app",
    metaTitle: "How to Reward Regulars Without an App",
    description: `A practical way to run pub loyalty when customers won't download another app: a browser card from your venue QR — the ${PRODUCT.pilot} comes before ${PRODUCT.price}.`,
    intro:
      "“My customers will not download another app.” It's one of the most common objections owners raise about loyalty schemes — and it's fair. Here's how to reward regulars with nothing to install.",
    publishedOn: "2026-07-19",
    updatedOn: "2026-07-19",
    sections: [
      {
        heading: "Why app-based loyalty stalls at the counter",
        paragraphs: [
          "A loyalty scheme that starts with “download our app” loses most guests before the first stamp, and a busy counter is the worst possible place to talk anyone through an install.",
          "Staff feel it from the other side of the bar: anything complicated at the till gets skipped on a busy shift.",
        ],
      },
      {
        heading: "The no-app alternative: a browser card from your venue QR",
        paragraphs: [
          `${PRODUCT.cardLine} ${PRODUCT.posLine}`,
          `Stamps are ${PRODUCT.counterStamp} — ${PRODUCT.counterStampLong}, with one claim per customer per UK date — so the card stays a record of real visits, not a free-for-all.`,
        ],
      },
      {
        heading: "Make the reward worth a return visit",
        paragraphs: [
          CORE_OFFER[1].detail,
          `${CORE_OFFER[1].why} The sealed mystery gives the final stamp a reason to matter.`,
        ],
      },
      {
        heading: "Let the automations do the remembering",
        paragraphs: [BONUS_STACK[1].detail, BONUS_STACK[2].detail],
      },
      {
        heading: "Skip the setup job entirely",
        paragraphs: [
          `${DFY_LAUNCH.intro} ${DFY_LAUNCH.covers}`,
          `${GUARANTEE.name}: ${GUARANTEE.line}`,
        ],
      },
    ],
  },
  {
    slug: "best-loyalty-ideas-for-pubs",
    path: ROUTES.guideIdeas,
    title: "Best loyalty ideas for pubs",
    metaTitle: "Best Loyalty Ideas for Pubs — Food-Led and Margin-Safe",
    description:
      "Food-led, margin-safe loyalty ideas for pubs: a short stamp cycle, weighted mystery rewards, birthday months and a referral loop — aimed at quiet midweek trade.",
    intro: `${MARKET.profileLine} The best pub loyalty ideas aren't discounts for their own sake — they give your existing weekend customers a concrete reason to come back on the nights you need them.`,
    publishedOn: "2026-07-19",
    updatedOn: "2026-07-19",
    sections: [
      {
        heading: "Start from a short, food-led stamp cycle",
        paragraphs: [
          CORE_OFFER[0].detail,
          "Short cycles get finished. A five-stamp card a regular can complete in a handful of visits beats a ten-stamp card nobody fills.",
        ],
      },
      {
        heading: "Run a mystery reward, not a blanket discount",
        paragraphs: [CORE_OFFER[1].detail, CORE_OFFER[1].why],
      },
      {
        heading: "Use birthday months, automatically",
        paragraphs: [BONUS_STACK[1].detail, BONUS_STACK[1].anchor],
      },
      {
        heading: "Turn regulars into recruiters",
        paragraphs: [BONUS_STACK[2].detail, BONUS_STACK[2].anchor],
      },
      {
        heading: "Point every idea at the quiet nights",
        paragraphs: [
          "The measure of a pub loyalty idea is simple: does it move a weekend face onto a Tuesday or a Wednesday?",
          `${VALUE_MATH.assumptionLine} ${VALUE_MATH.coverLine} ${VALUE_MATH.illustrativeNote}`,
        ],
      },
    ],
  },
  {
    slug: "paper-vs-qr-loyalty-for-pubs",
    path: ROUTES.guidePaperVsQr,
    title: "Paper vs QR loyalty for pubs",
    metaTitle: "Paper vs QR Loyalty Cards for Pubs — an Honest Comparison",
    description:
      "Paper stamp cards against a QR browser card, compared honestly: friction, verification, measurement and cost — and where paper still wins.",
    intro:
      "Paper stamp cards built pub loyalty: cheap, familiar, zero technology. The honest question isn't whether paper works — it's what you give up by not being able to see or verify any of it.",
    publishedOn: "2026-07-19",
    updatedOn: "2026-07-19",
    comparisonAfterHeading: "What changes with a QR browser card",
    sections: [
      {
        heading: "What paper does well",
        paragraphs: [
          "Nothing to explain and nothing to install: a card, an ink stamp, done. For a venue that wants zero screens anywhere near the till, paper still wins that trade.",
        ],
      },
      {
        heading: "Where paper leaks",
        paragraphs: [
          "Cards get lost, forgotten and quietly re-stamped at home — and none of it is visible to you. There's no record of who came back and no way to tell whether the scheme pays for itself.",
        ],
      },
      {
        heading: "What changes with a QR browser card",
        paragraphs: [
          `${PRODUCT.cardLine} ${PRODUCT.posLine}`,
          `Stamps become ${PRODUCT.counterStamp} — ${PRODUCT.counterStampLong}, one claim per customer per UK date — and visits land in a dashboard you can actually read.`,
        ],
      },
      {
        heading: "The switch without the setup job",
        paragraphs: [
          `${DFY_LAUNCH.intro} ${DFY_LAUNCH.covers}`,
          `${GUARANTEE.name}: ${GUARANTEE.line}`,
        ],
      },
    ],
  },
]

/** Look up a guide by slug; throws on an unknown slug at build time. */
export function getGuide(slug: string): Guide {
  const guide = GUIDES.find((candidate) => candidate.slug === slug)
  if (!guide) {
    throw new Error(`Unknown guide: ${slug}`)
  }
  return guide
}
