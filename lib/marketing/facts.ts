/**
 * Approved public marketing facts — the single source of truth for every public
 * claim Nabaperks makes about its operator, vertical focus, product wording, and
 * first-party proof. Centralised so marketing copy can't drift and so the
 * banned-claim guardrail (`scripts/check-banned-claims.mjs`) has one durable
 * place to protect.
 *
 * Governance (see `.omo/plans/seo-geo-pdf-landing-fix.md`): values here are
 * user-APPROVED business/content facts used as implementation constraints. Do
 * NOT add a named individual, a personal title/byline, legal-company
 * identifiers, a registered-office address, founding details, a public count of
 * live venues in the proof methodology, or hard compliance/guarantee claims.
 * The exact banned strings are enforced by `scripts/check-banned-claims.mjs`.
 * The First-Regular Guarantee (`GUARANTEE`) is an owner-approved exception: a
 * commercial trial-extension promise (2026-07-05, marketing offer v1) — a
 * business term, not a compliance claim; compliance-assurance wording stays
 * banned. Offer v2 (2026-07-05, marketing offer v2) adds two more
 * owner-approved commercial terms: the rolling monthly `PROMO` in
 * `lib/marketing/promo.ts` (a real, fulfilled, time-boxed perk with a monthly
 * print-run capacity) and the `OFFER_STACK` `anchor`s (justified
 * external cost/time comparisons — never an invented reference or headline
 * price). The privacy bonus still describes mechanisms only, never a
 * compliance assurance.
 */

// --- Public operator entity (the E-E-A-T Organization fact sheet) ----------

export const OPERATOR = {
  name: "Lapen Inns",
  /** Organization-only role wording — never a personal title. */
  role: "hospitality operator",
  roleAlt: "pub operator",
  /** One-line operator descriptor used in trust copy and schema. */
  descriptor: "Lapen Inns, hospitality operator",
  estateLine: "a hospitality operator running 9 pubs across England",
  estateShort: "9 pubs across England",
  region: "England",
  country: "United Kingdom",
  /** Public operator website — the first allowed sameAs URL. */
  website: "https://www.lapeninns.com",
  /** Public contact + support email. */
  supportEmail: "info@lapeninns.com",
  /** Privacy / data-controller contact email. */
  privacyEmail: "info@lapeninns.com",
} as const

export type EstatePub = { name: string; postcode: string }

/**
 * The 9-pub operating estate — name + postcode trust proof, all in England.
 * Postcodes are the addressable estate proof actually supplied; street lines are
 * intentionally not invented.
 */
export const OPERATOR_ESTATE: readonly EstatePub[] = [
  { name: "The Prince of Wales", postcode: "MK43 8PE" },
  { name: "Old School House", postcode: "MK11 1JA" },
  { name: "Barley Mow", postcode: "PE29 1XU" },
  { name: "The Queen Elizabeth", postcode: "PE30 4EL" },
  { name: "The Railway", postcode: "PE7 1UF" },
  { name: "The Bell", postcode: "PE28 5UY" },
  { name: "Old Crown", postcode: "CB3 0QD" },
  { name: "The Corner House", postcode: "CB5 8JE" },
  { name: "White Horse", postcode: "CB25 9HP" },
] as const

// --- Vertical language (approved public wording only) ----------------------

export const VERTICALS = {
  /** Pub-first language for the pub hub and spokes. */
  pubLed: [
    "pubs",
    "bars",
    "gastropubs",
    "food-led pubs",
    "ale and cask-led locals",
    "wine bars",
    "pub restaurants",
  ],
  /** Anonymous broad venue types allowed in general copy. */
  broad: ["pubs", "cafes", "takeaways"],
} as const

// --- Product terminology ---------------------------------------------------

export const PRODUCT = {
  /** Main public product term. */
  term: "browser-based loyalty card",
  /** Product plan name used at activation and in account billing. */
  planName: "Growth Plan",
  cardLine: "A browser-based loyalty card customers open from your QR code.",
  posLine: "No extra hardware. No POS or EPOS integration required.",
  price: "£49/month",
  priceShort: "£49/mo",
  /**
   * Annual plan — 12 × £49 = £588, offered at £490 up front = exactly two
   * months free. The annual Stripe Price is created by the operator; the
   * optional `STRIPE_GROWTH_ANNUAL_PRICE_ID` gates the annual checkout option
   * until it exists, so a stray annual submit can never bill an undefined price.
   */
  priceAnnual: "£490/year",
  priceAnnualShort: "£490/yr",
  annualSaving: "2 months free",
  pilot: "30-day free pilot",
  /** Public phrasing for claims tied to the venue QR and saved membership. */
  counterStamp: "venue-linked stamps",
  counterStampLong: "stamps linked to the venue QR",
  /**
   * The one cancellation term — a true cancel-anytime as of offer v1
   * (marketing offer v1). Cancellation is self-serve from the billing
   * page and takes effect at the end of the current billing month; the
   * card-required qualifier stays in the sentence form (ASA
   * material-information). Sentence + chip forms; use these, never a bare
   * literal.
   */
  cancelLine: "Card required — cancel anytime from your billing page.",
  cancelChip: "Cancel anytime",
} as const

/**
 * The First-Regular Guarantee — the offer's risk reversal, owner-approved
 * 2026-07-05 (marketing offer v1). A commercial trial-extension promise
 * honoured by support as a manual Stripe trial extension, so no billing code
 * depends on this copy. Compose surfaces from these parts; never fork the
 * promise as a page literal.
 */
export const GUARANTEE = {
  name: "First-Regular Guarantee",
  line: "If your live card hasn't brought back a first regular by the end of your 30-day pilot, the pilot stays free until it does.",
  applies: "Applies from the day your venue QR goes live.",
  claim: `Email ${OPERATOR.supportEmail} and the team applies the extension.`,
} as const

/**
 * What the £49 plan includes — the single source for the /pricing superset
 * and the TrustPricing teaser (`PLAN_INCLUDES.slice(0, 4)`), so the two
 * surfaces can never drift. Location checks sit last so the teaser is a
 * plain prefix of the full list.
 */
export const PLAN_INCLUDES = [
  "Unlimited stamps and members",
  "Simple reward setup",
  "Permanent venue QR",
  "Weekly digest of visits, regulars and redemptions",
  "Optional location checks at your venue",
] as const

/**
 * The offer's public NAME — the Hormozi MAGIC "wrapper" (Goal "first regular" +
 * Interval "30-day" + Container "Launch"). Rendered as the /pricing offer
 * heading (marketing offer v2). This names the OFFER, not the product: the
 * hero product headline ("The loyalty card that just opens.") stays separate.
 * `riskFraming` is the guarantee's best-case/worst-case reversal, composed with
 * `GUARANTEE` and single-sourced so no surface forks it.
 */
export const OFFER = {
  name: "The 30-Day First-Regular Launch",
  riskFraming:
    "Best case, your regulars come back and the £49 pays for itself. Worst case, you pay nothing more until one does.",
} as const

/**
 * Setup copy grounded in the real launch checklist
 * (`lib/merchant/launch-readiness-core`): venue, card and rewards come before
 * billing activation; billing then unlocks venue QR setup.
 */
export const SETUP = {
  line: "Build your card first. Activate it when billing is ready.",
  steps:
    "Five guided steps — add your venue, build the card, confirm your pre-filled rewards, activate billing, then set up your venue QR.",
  noFriction: "No app to build, no POS to connect, nothing to install.",
  earlyWin:
    "Finish your venue, card and rewards first. Once billing is active, your venue QR unlocks for customers to scan and collect their first stamp.",
} as const

/**
 * The named bonus stack /pricing presents under the one price — already
 * shipped product, framed as included; no unbundled price theatre. Each item
 * names the `obstacle` it removes (Hormozi Bonus Bullet #8) and, where a figure
 * is genuinely substantiable, an `anchor`: a real external cost or time saving
 * (marketing offer v2, owner-approved 2026-07-05). Anchors are NEVER an
 * invented reference or headline price, and the privacy item stays
 * mechanism-described with no price (`anchor: null`). Factual anchors: the five
 * A4 poster templates, the seeded default reward pool, optional birthday
 * automation + the weekly digest, the consent/age-gate/retention mechanics, and
 * the three public guides.
 */
export const OFFER_STACK = [
  {
    name: "Launch-ready till poster kit",
    obstacle: "No time to design counter posters.",
    detail:
      "Five print-ready A4 posters — Editorial, Bold, Ticket, Night Card and Receipt — with your venue QR and counter copy already laid out.",
    anchor:
      "The kind of counter posters you'd pay a freelance designer £150+ to make.",
  },
  {
    name: "Done-for-you mystery reward pool",
    obstacle: "Not sure what rewards to run.",
    detail:
      "A starter pool of weighted mystery rewards is seeded with your card — edit it or launch with it as-is.",
    anchor: "A ready-to-run reward game — no blank page to start from.",
  },
  {
    name: "Set-and-forget retention automations",
    obstacle: "No time to chase regulars by hand.",
    detail:
      "Optional birthday treats send automatically, and a weekly digest of visits, regulars and redemptions lands in your inbox.",
    anchor:
      "The birthday messages and weekly numbers you'd otherwise chase by hand every week.",
  },
  {
    name: "Privacy jobs, handled",
    obstacle: "The data rules feel like a minefield.",
    detail:
      "Consent-led marketing kept separate from loyalty, an 18+ age gate at redemption, and automatic data-retention tidy-ups.",
    anchor: null,
  },
  {
    name: "The operator's loyalty guides",
    obstacle: "Unsure what actually works in a pub.",
    detail:
      "Three practical guides from the counter: reward ideas that suit a pub, paper vs QR, and rewarding regulars without an app.",
    anchor: null,
  },
] as const

// --- First-party proof (the citable data asset) ----------------------------

/** Approved benchmark / named IP for the first-party proof. */
export const PROOF = {
  indexName: "Nabaperks Counter-Loyalty Index",
  asOf: "June 2026",
  methodology:
    "Nabaperks first-party loyalty data from UK food-and-drink venues, March 2024 to June 2026. Snapshot as of June 2026.",
  calculatedFrom: "Calculated from first-party loyalty records.",
  measuredAcross: "Measured across Nabaperks-powered venues.",
  /** The approved fixed June 2026 snapshot — canonical numbers. */
  stats: {
    members: 1842,
    returnedMembers: 812,
    rewardsRedeemed: 1180,
    rewardsEarned: 2934,
    repeatRatePct: 46.8,
  },
} as const

/** Pre-formatted display strings for the snapshot (en-GB thousands). */
export const PROOF_DISPLAY = {
  members: "1,842",
  returnedMembers: "812",
  rewardsRedeemed: "1,180",
  rewardsEarned: "2,934",
  repeatRate: "46.8%",
} as const

// --- Routes + persona CTAs -------------------------------------------------

export const ROUTES = {
  home: "/",
  howItWorks: "/how-it-works",
  pubHub: "/loyalty-for-pubs",
  cafeHub: "/loyalty-for-cafes",
  takeawayHub: "/loyalty-for-takeaways",
  barHub: "/loyalty-for-bars",
  about: "/about",
  pricing: "/pricing",
  signup: "/signup",
  signupVerify: "/signup/verify",
  guides: {
    bestIdeas: "/guides/best-loyalty-ideas-for-pubs",
    rewardRegulars: "/guides/reward-regulars-without-an-app",
    paperVsQr: "/guides/paper-vs-qr-loyalty-for-pubs",
  },
} as const

export type PublicRouteChangeFrequency = "weekly" | "monthly" | "yearly"

export type PublicSiteRoute = {
  readonly path: string
  readonly priority: number
  readonly changeFrequency: PublicRouteChangeFrequency
}

export const PUBLIC_SITE_ROUTES = [
  { path: ROUTES.home, priority: 1, changeFrequency: "weekly" },
  {
    path: ROUTES.howItWorks,
    priority: 0.9,
    changeFrequency: "monthly",
  },
  { path: ROUTES.pubHub, priority: 0.9, changeFrequency: "monthly" },
  { path: ROUTES.cafeHub, priority: 0.9, changeFrequency: "monthly" },
  { path: ROUTES.takeawayHub, priority: 0.9, changeFrequency: "monthly" },
  { path: ROUTES.barHub, priority: 0.9, changeFrequency: "monthly" },
  { path: ROUTES.pricing, priority: 0.9, changeFrequency: "monthly" },
  { path: ROUTES.about, priority: 0.6, changeFrequency: "monthly" },
  {
    path: ROUTES.guides.bestIdeas,
    priority: 0.6,
    changeFrequency: "monthly",
  },
  {
    path: ROUTES.guides.rewardRegulars,
    priority: 0.6,
    changeFrequency: "monthly",
  },
  {
    path: ROUTES.guides.paperVsQr,
    priority: 0.6,
    changeFrequency: "monthly",
  },
  { path: ROUTES.signup, priority: 0.7, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
] as const satisfies readonly PublicSiteRoute[]

export const CTA = {
  /** Persona + hero persona CTA for the pub hub. */
  pub: "Loyalty for pubs",
  /** Persona CTAs for the cafe/takeaway/bar spokes. */
  cafe: "Loyalty for cafes",
  takeaway: "Loyalty for takeaways",
  bar: "Loyalty for bars",
  /** Standard label whenever a guide links back to the hub. */
  guideLink: "See the pub loyalty guide",
  startPilot: "Start free pilot",
} as const
