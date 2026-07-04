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
  cardLine: "A browser-based loyalty card customers open from your QR code.",
  posLine: "No extra hardware. No POS or EPOS integration required.",
  price: "£29/month",
  priceShort: "£29/mo",
  pilot: "30-day free pilot",
  /** Public phrasing for the anti-fraud method — not a hero-level brand push. */
  counterStamp: "counter-verified stamps",
  counterStampLong: "stamps confirmed at the counter",
} as const

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
