/**
 * Approved public marketing facts — the single source of truth for every public
 * claim Nabaperks makes about its operator, vertical focus, product wording, and
 * first-party proof. Centralised so marketing copy can't drift and so the
 * banned-claim guardrail (`scripts/check-banned-claims.mjs`) has one durable
 * place to protect.
 *
 * Governance: values here are user-APPROVED business/content facts used as
 * implementation constraints. Do NOT add a named individual, a personal
 * title/byline, legal-company identifiers, a registered-office address,
 * founding details, a public count of live venues in the proof methodology, or
 * hard compliance/guarantee claims. The exact banned strings are enforced by
 * `scripts/check-banned-claims.mjs`.
 *
 * Offer v3 (2026-07-18, marketing offer v3) is sourced exclusively from the
 * owner's finalised offer pack in `Offers- Nabaperks-Finalized/` (8 docs:
 * market, value equation, offer creation, bonus stack, guarantee stack,
 * scarcity & urgency, naming, master). Owner-approved commercial terms:
 * - The offer wrapper `OFFER.name` ("…Revenue Accelerator") leads public pages
 *   per the owner's rebuild brief; `OFFER.nameNote` states on-page that it
 *   names the offer, not a revenue promise (naming doc's claims rule).
 * - `SETUP_FEE` (£99) is COPY ONLY: invoiced at done-for-you onboarding, never
 *   charged through online checkout. No billing code may read it.
 * - `GUARANTEE` (First-Regular, offer v1) + `GUARANTEE_ROI` (90-Day ROI
 *   Extension, offer v3) are conditional service promises honoured manually by
 *   support through Stripe trial extensions/discounts — business terms, not
 *   compliance claims; compliance-assurance wording stays banned.
 * - `SCARCITY` reflects real human onboarding capacity (5/week). Never render
 *   an invented live availability counter; counter-style availability
 *   phrasing is banned by `scripts/check-banned-claims.mjs`.
 * - The rolling monthly `PROMO` in `lib/marketing/promo.ts` stays the one
 *   time-boxed perk. `BONUS_STACK` anchors are justified external cost/time
 *   comparisons — never an invented reference or headline price.
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
  pilotCardNote: "30-day free pilot (card required)",
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

// --- The market (offer pack doc 1: pick the right market) -------------------

/**
 * The final niche statement and qualification rules. Public pages state who the
 * offer is built for and who it is not, so the positioning can't creep.
 */
export const MARKET = {
  niche:
    "Single-site, owner-operated UK food-led pubs with strong weekend trade, quiet Tuesday–Thursday periods, and no effective digital loyalty programme.",
  nicheShort: "Single-site, owner-operated UK food-led pubs",
  profileLine: "Busy weekends. Quiet Tuesday to Thursday.",
  promise:
    "Nabaperks sets up and launches a no-app browser loyalty card for a single-site UK food-led pub, so the venue can capture existing weekend customers and encourage measurable return visits — without a customer app, POS integration, or extra work at the till.",
  /** Venues the offer prioritises (doc 1's qualification rules). */
  qualify: [
    "Single-site and owner-operated, or owner-led day-to-day",
    "Serves food Tuesday to Thursday",
    "Visible weekend demand and a meaningful existing customer base",
    "One manager willing to own the launch and keep the QR counter materials displayed",
    "Wants the implementation done for you, not empty software access",
  ],
  /** Venues the offer honestly turns away (doc 1's disqualification rules). */
  disqualify: [
    "Closed most Tuesdays to Thursdays, or no existing customer base yet",
    "Expects a guarantee of midweek revenue or filled tables — we never promise that",
    "Won't display the physical QR materials or brief the staff",
    "Needs multi-site rollout, bespoke agency creative, or POS/EPOS integration inside the standard setup",
  ],
} as const

// --- The offer wrapper (offer pack docs 7 + 8: naming + master) --------------

/**
 * The offer's public NAME — the assembled wrapper from the finalised pack.
 * `name` is the primary wrapper and names the OFFER, not the product and not a
 * contractual revenue promise (`nameNote` renders that rule on-page).
 * `nameSafe` is the pack's ASA-safer alternate wrapper, used where the
 * pub-specific "Gastropub" framing would over-claim (the café/bar/takeaway
 * spokes). `riskFraming` is the guarantee's best-case/worst-case reversal,
 * composed with `GUARANTEE` and single-sourced so no surface forks it.
 */
export const OFFER = {
  name: "The 30-Day Gastropub Mid-Week Revenue Accelerator",
  nameSafe: "The 30-Day First-Regular Launch",
  nameNote:
    "Named for what it’s built to do — bring your regulars back midweek.",
  audience:
    "For single-site UK food-led pubs that are busy at weekends and quiet midweek.",
  riskFraming:
    "Best case, your regulars come back and the £49 pays for itself. Worst case, you pay nothing more until one does.",
} as const

// --- Value equation (offer pack doc 2) --------------------------------------

/**
 * The four reasons pubs say yes — the offer pack's value case rewritten in
 * customer voice (the framework built the offer; it never renders on-page).
 * Stated as delivery facts, never as an outcome claim.
 */
export const VALUE_EQUATION = [
  {
    lever: "The point",
    heading: "Make the quiet nights earn their keep",
    detail:
      "Not loyalty software for its own sake — an easy, visible reason for your weekend crowd to come back on a Tuesday or a Wednesday.",
  },
  {
    lever: "The proof",
    heading: "See every return visit in your dashboard",
    detail:
      "We set everything up, pick margin-safe mystery rewards and post you printed posters so the QR is actually seen. Verified return visits land in your dashboard.",
  },
  {
    lever: "The speed",
    heading: "Live without the software project",
    detail:
      "No set-it-up-yourself backlog and no weeks of learning a new tool — you get a branded, working programme ready to stand on the counter.",
  },
  {
    lever: "The effort",
    heading: "No app. No POS work. No till drama.",
    detail:
      "Customers download nothing, there's no POS or EPOS integration, and staff just scan and say one line. Even the first poster run arrives printed.",
  },
] as const

/**
 * The price-to-value maths from the offer pack, kept honest: the £12 gross
 * contribution per return visit is an illustrative example, and every page
 * that renders these lines must carry `illustrativeNote` alongside them.
 */
export const VALUE_MATH = {
  assumptionLine:
    "Say an average return visit is worth about £12 to you once costs are out.",
  coverLine:
    "~5 return visits a month cover the £49 subscription — roughly one extra return visit a week.",
  ninetyDayLine:
    "15 verified return visits cover your first three months of £49 subscriptions.",
  illustrativeNote:
    "That £12 is only an example — your margins will differ. You’ll see the real numbers in your own dashboard.",
} as const

// --- Pricing structure (offer pack docs 2 + 8; £99 is copy-only) -------------

/**
 * The setup fee — COPY/FACTS ONLY, never wired into Stripe or any checkout
 * path; no billing code may import this constant (enforced by
 * `tests/contracts/marketing-offer-source.test.mjs`).
 *
 * Owner decision 2026-07-19: the standard £99 fee is WAIVED to £0 while the
 * rolling monthly launch window is open. The waiver is honest scarcity: it
 * always renders with the window's real end date (from `getActivePromo`), and
 * every surface falls back to the standard-fee copy automatically when the
 * promo is switched off — no undated "limited time" claims.
 */
export const SETUP_FEE = {
  /** The documented standard setup fee — the waiver's reference price. */
  standard: "£99",
  standardLabel: "£99 one-off setup",
  /** What venues pay while the launch-window waiver is open. */
  amount: "£0",
  label: "£0 setup",
  covers:
    "Setup covers the human implementation work: venue and card configuration, a margin-safe mystery reward pool, and your first A4 counter-poster run — generated, printed and posted to your pub.",
  afterWaiver:
    "If the waiver ends, the standard £99 setup fee is invoiced when your onboarding is booked — never charged through the online checkout.",
  exposure:
    "When the standard fee applies, it pays for completed implementation work and the physical print run, so it isn't refunded because trading was quiet — the guarantees below carry the subscription risk instead.",
} as const

// --- The done-for-you launch (offer pack docs 3 + 8) -------------------------

/**
 * The assembled delivery pitch: Lapen Inns does the launch. The five steps are
 * the master doc's own sequence and drive the how-it-works page's HowTo schema.
 */
export const DFY_LAUNCH = {
  intro: "Instead of handing you empty software, Lapen Inns does the launch.",
  steps: [
    {
      title: "We set up your venue",
      detail:
        "Your venue profile and branded browser loyalty card, configured for your pub.",
    },
    {
      title: "We configure your rewards",
      detail:
        "A recommended 5-stamp food-led cycle plus a custom weighted mystery reward pool — free-starter, coffee-after-lunch, Sunday-roast-upgrade territory — chosen to be margin-safe.",
    },
    {
      title: "We turn on the automations",
      detail:
        "Birthday rewards and the Bring-a-Regular referral loop, configured on your card before launch.",
    },
    {
      title: "We print and post your posters",
      detail:
        "Your first A4 counter-poster run is generated with your venue QR and counter copy, then physically printed and posted to the pub.",
    },
    {
      title: "You go live",
      detail:
        "A permanent venue QR at the counter — no customer app, no POS integration, and no extra work at the till.",
    },
  ],
  yourPart:
    "Your part: display the posters, honour the rewards, and give your staff a short brief.",
} as const

// --- The core offer stack (offer pack doc 3) ---------------------------------

/**
 * The trimmed-and-stacked core offer. Each component names why it's valuable in
 * the pack's own terms. Excluded on purpose (and never implied on-page):
 * unlimited consulting, monthly strategy calls, ongoing reprint budgets,
 * multi-site rollouts, paid ads management, POS integrations.
 */
export const CORE_OFFER = [
  {
    name: "Done-for-you venue & card launch",
    detail:
      "Venue profile and branded browser loyalty card configured for you, with a recommended 5-stamp food-led stamp cycle.",
    why: "No blank-account problem — you start from a working setup, not a DIY project.",
  },
  {
    name: "Food-led mystery rewards, chosen with you",
    detail:
      "A custom weighted mystery reward pool — think free starter, coffee after lunch, Sunday roast upgrade — configured to stay margin-safe.",
    why: "Solves “what should we give away” without blanket discounting.",
  },
  {
    name: "One venue QR, no app for your customers",
    detail:
      "A permanent venue QR with the customer join and stamp journeys tested. No customer app, no wallet pass, no POS integration.",
    why: "Fits busy counter service and removes the biggest guest objection: app fatigue.",
  },
  {
    name: "Your numbers, every week",
    detail:
      "Dashboard access for visits, members, stamps and returning customers, plus a weekly digest of visits, regulars and redemptions.",
    why: "Judge the return from your own concrete numbers — no guessing.",
  },
] as const

// --- The bonus stack (offer pack doc 4) --------------------------------------

/**
 * The three named bonuses. Each names the `obstacle` it removes and, where a
 * figure is genuinely substantiable, an `anchor`: a real external cost or time
 * comparison. Anchors are NEVER an invented reference or headline price.
 */
export const BONUS_STACK = [
  {
    name: "Print-ready marketing — first run printed and posted",
    obstacle: "No time or designer for posters.",
    detail:
      "We generate the A4 counter posters with your venue QR and counter copy, then physically print and post the first run to your pub.",
    anchor:
      "What a freelance designer plus a local print shop would charge £150+ to produce and fulfil.",
  },
  {
    name: "Birthday automation, configured",
    obstacle: "Nobody remembers to message birthday guests.",
    detail:
      "We configure the birthday reward name and terms on your card, so the platform's daily job issues birthday rewards during a customer's birthday month.",
    anchor:
      "The weekly hours you'd otherwise spend chasing birthday messages by hand.",
  },
  {
    name: "“Bring a Regular” referrals, configured",
    obstacle: "You want new diners without paid ads.",
    detail:
      "We configure referral sharing so existing members can invite new diners — attribution and the referrer's bonus stamps settle automatically after the new diner's first genuine visit.",
    anchor:
      "A ready-to-go referral loop you'd otherwise have to invent and track yourself.",
  },
] as const

/**
 * Integrity note from the bonus doc: features every Growth Plan already ships
 * with are never double-counted as extra priced bonuses.
 */
export const BONUS_STACK_NOTE =
  "Every Growth Plan already includes the weekly digest, consent handling and the seeded mystery-reward presets — so we don't count those as bonuses."

// --- The guarantee stack (offer pack doc 5) ----------------------------------

/**
 * The First-Regular Guarantee — the offer's core risk reversal, owner-approved
 * 2026-07-05 (marketing offer v1). A commercial trial-extension promise
 * honoured by support as a manual Stripe trial extension, so no billing code
 * depends on this copy. Compose surfaces from these parts; never fork the
 * promise as a page literal. `conditions` (offer v3) states the operator
 * conditions from the guarantee doc.
 */
export const GUARANTEE = {
  name: "First-Regular Guarantee",
  line: "If your live card hasn't brought back a first regular by the end of your 30-day pilot, the pilot stays free until it does.",
  applies: "Applies from the day your venue QR goes live.",
  claim: `Email ${OPERATOR.supportEmail} and the team applies the extension.`,
  conditions:
    "Conditions: the done-for-you setup is completed, the approved posters are displayed, rewards are honoured, and no deliberate staff gaming of the card.",
} as const

/**
 * The 90-Day ROI Extension — the offer pack's second, value risk reversal
 * (owner-approved 2026-07-18, marketing offer v3). Honoured by support as a
 * manual 100% Stripe discount on the following three months; no billing code
 * depends on this copy.
 */
export const GUARANTEE_ROI = {
  name: "90-Day ROI Extension",
  line: "If your loyalty card doesn't generate enough return visits to cover your software investment in your first 90 days, your next 3 months are completely free.",
  mechanic: `${VALUE_MATH.ninetyDayLine} If your dashboard hasn't recorded them by day 90, Lapen Inns applies a 100% discount to your next three months.`,
  conditions:
    "Conditions: the QR stays actively displayed at the counter for the full 90 days, rewards are honoured, and no test or staff gaming of the card.",
  claim: `Email ${OPERATOR.supportEmail} and the team applies the discount.`,
} as const

/**
 * The claims boundary the whole site holds (offer pack docs 3, 5, 6 and 8).
 * What we stand behind is a measurable return signal the software can track —
 * never an uncontrollable revenue outcome.
 */
export const CLAIMS_BOUNDARY = {
  guarantee:
    "What we do promise: a completed launch, and a pilot that stays free until the card brings back your first regular — a promise tied to a number you can check on your own dashboard.",
  never: "We do not guarantee midweek revenue or filled tables.",
  yourPart: DFY_LAUNCH.yourPart,
} as const

// --- Honest scarcity & urgency (offer pack doc 6) ----------------------------

/**
 * Real human onboarding capacity — the only scarcity the site is allowed to
 * state. Never pair it with an invented live counter: availability for a given
 * week is confirmed by a human, not rendered by the site.
 */
export const SCARCITY = {
  capLine: "We only onboard 5 new pubs a week",
  capReason:
    "so we can fully manage each launch and physically print the materials.",
  fullWeek:
    "Five is the number a human team can genuinely launch well in a week — if this week is full, your launch is booked into the next one.",
  honesty:
    "When a week’s full, we’ll tell you and hold the next opening for you.",
} as const

/**
 * Rolling launch urgency: a real operational cutoff (the physical print batch),
 * never a fake deadline. The rolling monthly promo in `lib/marketing/promo.ts`
 * is the one time-boxed perk and carries its own real end date.
 */
export const URGENCY = {
  printBatch:
    "Confirm this week and your setup joins the next physical print batch — posters arrive and you go live sooner.",
} as const

// --- Setup copy for the product's own guided flow ---------------------------

/**
 * Setup copy grounded in the real launch checklist
 * (`lib/merchant/launch-readiness-core`): venue, card and rewards come before
 * billing activation; billing then unlocks venue QR setup. This is the
 * software's own guided flow — the done-for-you launch is Lapen Inns driving
 * these same steps for the venue.
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
 * What the £49 plan includes. Retained as an approved commercial fact set for
 * merchant billing and marketing pricing copy.
 */
export const PLAN_INCLUDES = [
  "Unlimited stamps and members",
  "Simple reward setup",
  "Permanent venue QR",
  "Weekly digest of visits, regulars and redemptions",
  "Optional location checks at your venue",
] as const

// --- Persona spokes ---------------------------------------------------------

export type MarketingPersona = {
  readonly slug: "pubs" | "cafes" | "bars" | "takeaways"
  readonly path: string
  readonly noun: string
  readonly title: string
  readonly navLabel: string
  /** The offer wrapper this spoke may honestly lead with. */
  readonly offerName: string
  /** True only for the niche the offer was actually built around. */
  readonly primary: boolean
  /** Who the spoke speaks to — conditional phrasing, never a venue claim. */
  readonly audience: string
  /** The quiet-period pattern the spoke addresses, phrased as a question. */
  readonly quietQuestion: string
  /** Honest fit note tying every spoke back to the pub-first design. */
  readonly fitNote: string
}

/**
 * The persona spokes all run the same engine; pubs lead because the offer pack
 * targets food-led pubs. The other spokes reuse the ASA-safer wrapper and say
 * plainly that the launch was designed pub-first — analogous framing, not a
 * literal transplant of the gastropub offer.
 */
export const PERSONAS: readonly MarketingPersona[] = [
  {
    slug: "pubs",
    path: "/loyalty-for-pubs",
    noun: "pub",
    title: "Loyalty for pubs",
    navLabel: "Pubs",
    offerName: "The 30-Day Gastropub Mid-Week Revenue Accelerator",
    primary: true,
    audience: MARKET.niche,
    quietQuestion: "Full on Saturday, quiet on Tuesday?",
    fitNote:
      "Built for single-site, owner-operated food-led pubs — the exact venues this offer was designed around.",
  },
  {
    slug: "cafes",
    path: "/loyalty-for-cafes",
    noun: "café",
    title: "Loyalty for cafés",
    navLabel: "Cafés",
    offerName: "The 30-Day First-Regular Launch",
    primary: false,
    audience:
      "Counter-service cafés with a real base of regulars and a quiet stretch in the week.",
    quietQuestion: "Busy at the morning rush, quiet after it?",
    fitNote:
      "The launch was designed for food-led pubs first. The card is the same — if you run a counter with existing regulars, the no-app card, the done-for-you launch and the guarantees work the same way.",
  },
  {
    slug: "bars",
    path: "/loyalty-for-bars",
    noun: "bar",
    title: "Loyalty for bars",
    navLabel: "Bars",
    offerName: "The 30-Day First-Regular Launch",
    primary: false,
    audience:
      "Independent bars with strong weekend nights and a meaningful base of returning faces.",
    quietQuestion: "Packed on Friday and Saturday, flat early in the week?",
    fitNote:
      "The launch was designed for food-led pubs first. The card is the same — if your bar has real regulars, the no-app card, the done-for-you launch and the guarantees work the same way.",
  },
  {
    slug: "takeaways",
    path: "/loyalty-for-takeaways",
    noun: "takeaway",
    title: "Loyalty for takeaways",
    navLabel: "Takeaways",
    offerName: "The 30-Day First-Regular Launch",
    primary: false,
    audience:
      "Counter takeaways with regular customers and order peaks that leave the rest of the week quiet.",
    quietQuestion: "Queues at peak, quiet between them?",
    fitNote:
      "The launch was designed for food-led pubs first. The card is the same — if your counter serves the same faces every week, the no-app card, the done-for-you launch and the guarantees work the same way.",
  },
] as const

/** Look up a persona spoke by slug; throws on an unknown slug at build time. */
export function getMarketingPersona(
  slug: MarketingPersona["slug"]
): MarketingPersona {
  const persona = PERSONAS.find((candidate) => candidate.slug === slug)
  if (!persona) {
    throw new Error(`Unknown marketing persona: ${slug}`)
  }
  return persona
}

// --- FAQ (composed from the facts above; rendered + FAQPage JSON-LD) ---------

export type MarketingFaq = {
  readonly question: string
  readonly answer: string
}

export const FAQ_ITEMS: readonly MarketingFaq[] = [
  {
    question: "Do my customers need to download an app?",
    answer: `No. ${PRODUCT.cardLine} There's no customer app and no wallet pass — the card lives in the browser, linked to your venue QR.`,
  },
  {
    question: "Does this need POS or EPOS integration?",
    answer: `No. ${PRODUCT.posLine} The floor process stays a simple scan and a short script for your staff.`,
  },
  {
    question: "What exactly do you set up for us?",
    answer: `${DFY_LAUNCH.intro} We set up your venue and branded card, configure a 5-stamp food-led cycle and a margin-safe mystery reward pool, turn on birthday automation and the Bring-a-Regular referral loop, and print and post your first A4 counter-poster run. ${DFY_LAUNCH.yourPart}`,
  },
  {
    question: "What does it cost?",
    answer: `Setup is ${SETUP_FEE.amount} right now — the standard ${SETUP_FEE.standard} setup fee is waived while the current month's launch window is open (the exact end date is shown next to the price). The software is ${PRODUCT.price} (or ${PRODUCT.priceAnnual} — ${PRODUCT.annualSaving}) after a ${PRODUCT.pilot}. ${PRODUCT.cancelLine}`,
  },
  {
    question: "Is setup really £0?",
    answer: `Yes — for launches booked while the current window is open. ${SETUP_FEE.covers} We do all of that either way. ${SETUP_FEE.afterWaiver}`,
  },
  {
    question: "What if nobody comes back?",
    answer: `${GUARANTEE.name}: ${GUARANTEE.line} And the ${GUARANTEE_ROI.name}: ${GUARANTEE_ROI.line} ${OFFER.riskFraming}`,
  },
  {
    question: "What do you not guarantee?",
    answer: `${CLAIMS_BOUNDARY.never} ${CLAIMS_BOUNDARY.guarantee} ${CLAIMS_BOUNDARY.yourPart}`,
  },
  {
    question: "Why do you only take 5 launches a week?",
    answer: `${SCARCITY.capLine} ${SCARCITY.capReason} ${SCARCITY.fullWeek}`,
  },
  {
    question: "How will I know it's working?",
    answer: `Your dashboard shows visits, members, stamps and returning customers, and a weekly digest of visits, regulars and redemptions lands in your inbox. ${VALUE_MATH.coverLine} ${VALUE_MATH.illustrativeNote}`,
  },
] as const

/** The pricing page's FAQ subset — cost, guarantee and capacity questions. */
export const PRICING_FAQ_ITEMS: readonly MarketingFaq[] = FAQ_ITEMS.filter(
  (faq) =>
    [
      "What does it cost?",
      "Is setup really £0?",
      "What if nobody comes back?",
      "What do you not guarantee?",
      "Why do you only take 5 launches a week?",
    ].includes(faq.question)
)

// --- Public routes ----------------------------------------------------------

export const ROUTES = {
  home: "/",
  signup: "/signup",
  signupVerify: "/signup/verify",
  howItWorks: "/how-it-works",
  pricing: "/pricing",
  demo: "/demo",
  about: "/about",
  pubs: "/loyalty-for-pubs",
  cafes: "/loyalty-for-cafes",
  bars: "/loyalty-for-bars",
  takeaways: "/loyalty-for-takeaways",
  guideNoApp: "/guides/reward-regulars-without-an-app",
  guideIdeas: "/guides/best-loyalty-ideas-for-pubs",
  guidePaperVsQr: "/guides/paper-vs-qr-loyalty-for-pubs",
} as const

export type PublicRouteChangeFrequency = "weekly" | "monthly" | "yearly"

export type PublicSiteRoute = {
  readonly path: string
  readonly priority: number
  readonly changeFrequency: PublicRouteChangeFrequency
}

/**
 * Indexable public routes — the sitemap + llms.txt registry. `/demo` is
 * deliberately absent: it stays robots-disallowed as an app-like surface
 * (2026-07-05 GEO audit decision).
 */
export const PUBLIC_SITE_ROUTES = [
  { path: ROUTES.home, priority: 1, changeFrequency: "weekly" },
  { path: ROUTES.pricing, priority: 0.9, changeFrequency: "monthly" },
  { path: ROUTES.howItWorks, priority: 0.8, changeFrequency: "monthly" },
  { path: ROUTES.pubs, priority: 0.8, changeFrequency: "monthly" },
  { path: ROUTES.signup, priority: 0.7, changeFrequency: "monthly" },
  { path: ROUTES.cafes, priority: 0.6, changeFrequency: "monthly" },
  { path: ROUTES.bars, priority: 0.6, changeFrequency: "monthly" },
  { path: ROUTES.takeaways, priority: 0.6, changeFrequency: "monthly" },
  { path: ROUTES.guideNoApp, priority: 0.5, changeFrequency: "monthly" },
  { path: ROUTES.guideIdeas, priority: 0.5, changeFrequency: "monthly" },
  { path: ROUTES.guidePaperVsQr, priority: 0.5, changeFrequency: "monthly" },
  { path: ROUTES.about, priority: 0.4, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/cookies", priority: 0.2, changeFrequency: "yearly" },
  { path: "/merchant-terms", priority: 0.2, changeFrequency: "yearly" },
  { path: "/data-processing", priority: 0.2, changeFrequency: "yearly" },
] as const satisfies readonly PublicSiteRoute[]
