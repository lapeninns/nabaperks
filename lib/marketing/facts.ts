/**
 * Approved public marketing facts — the single source of truth for every public
 * claim Nabaperks makes about its brand, vertical focus, product wording, and
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
 * Offer v6 (2026-07-31) is sourced from the owner's finalised offer pack and
 * subsequent approved pricing decisions. Owner-approved commercial terms:
 * owner's finalised offer pack in `Offers- Nabaperks-Finalized/` (8 docs:
 * market, value equation, offer creation, bonus stack, guarantee stack,
 * scarcity & urgency, naming, master). Owner-approved commercial terms:
 * - Public pages lead with the offer pack's safer `First-Regular Launch`
 *   wrapper. The original `Revenue Accelerator` wording is retained only as a
 *   campaign wrapper that requires separate approval before public use.
 * - New customers pay the done-for-you launch fee before the free 28-day
 *   platform pilot, then choose 28-day billing or discounted annual prepay.
 *   `PLAN_LINE` is the single-sourced investment line.
 * - `GUARANTEE` (First-Regular, offer v1) + `GUARANTEE_ROI` (90-Day ROI
 *   Extension, offer v3) are conditional service promises honoured manually by
 *   support through Stripe trial extensions/discounts — business terms, not
 *   compliance claims; compliance-assurance wording stays banned.
 * - `SCARCITY` reflects real human onboarding capacity (5/week). Never render
 *   an invented live availability counter; counter-style availability
 *   phrasing is banned by `scripts/check-banned-claims.mjs`.
 * - `BONUS_STACK` anchors are justified external cost/time comparisons — never
 *   an invented reference or headline price. Promotional printing stays off:
 *   the first poster run is already part of the core launch.
 */

// --- Legal and service contact ---------------------------------------------

/**
 * The current legal/service contact remains available where a contract,
 * privacy notice or support route needs it. It is deliberately not a marketing
 * authority, public byline or parent brand: Nabaperks owns the public product
 * narrative and its structured-data entity.
 */
export const LEGAL_CONTACT = {
  name: "Lapen Inns",
  /** Existing support address until a verified Nabaperks mailbox replaces it. */
  supportEmail: "info@lapeninns.com",
  /** Existing privacy / data-controller contact address. */
  privacyEmail: "info@lapeninns.com",
} as const

// --- Brand identity --------------------------------------------------------

/**
 * The brand's own name and motto. The motto is a slogan — it sits beside the
 * wordmark and on the social card, and it never replaces the benefit copy that
 * does the selling (`LANDING.hero`) or the keyword-bearing page `<title>`.
 *
 * Voice rule: a motto states what the brand is, never what the venue will get.
 * "Sorted" is a posture, not an outcome — keep it that way. Anything that
 * promises revenue, full tables or a guaranteed result belongs nowhere near
 * this constant, and `scripts/check-banned-claims.mjs` is the backstop.
 */
export const BRAND = {
  name: "Nabaperks",
  motto: "Pub loyalty, sorted",
  positioning: "Loyalty made for independent pubs",
  pointOfView: "Built around how independent pubs actually work",
} as const

// --- Product terminology ---------------------------------------------------

export const PRODUCT = {
  /** Main public product term. */
  term: "browser-based loyalty card",
  /** Product plan name used at activation and in account billing. */
  planName: "Growth Plan",
  cardLine: "A browser-based loyalty card customers open from your QR code.",
  posLine: "No extra hardware. No POS or EPOS integration required.",
  launchFee: "£299.99",
  launchFeeAmount: "299.99",
  price: "£69.99 every 28 days",
  priceShort: "£69.99/28 days",
  priceAmount: "69.99",
  annualPrice: "£699.90 a year",
  annualPriceShort: "£699.90/year",
  annualPriceAmount: "699.90",
  annualSaving: "Save £209.97 against 13 separate 28-day payments.",
  /** Chip form of the annual saving, for tight tags beside the annual price. */
  annualSavingShort: "Save £209.97",
  /**
   * Display-split pairs of `price`/`annualPrice` for ticket-style price
   * lockups (big amount, small cadence) — kept in sync with the sentence
   * forms above and drift-guarded by the marketing offer-source contract.
   */
  priceCadence: "every 28 days",
  annualPriceCadence: "a year",
  annualBillingDisclosure:
    "One prepaid yearly payment after the 28-day platform pilot.",
  pilot: "28-day free platform pilot",
  pilotCardNote: "28-day free platform pilot (card required)",
  billingDisclosure:
    "13 payments totalling £909.87 in each 364-day billing year.",
  processingFeeLine: "No separate card-processing surcharge.",
  /** Public phrasing for claims tied to the venue QR and saved membership. */
  counterStamp: "venue-linked stamps",
  counterStampLong: "stamps linked to the venue QR",
  /**
   * The one cancellation term — a true cancel-anytime as of offer v1
   * (marketing offer v1). Cancellation is self-serve from the billing
   * page and takes effect at the end of the current billing period; the
   * card-required qualifier stays in the sentence form (ASA
   * material-information). Sentence + chip forms; use these, never a bare
   * literal.
   */
  cancelLine:
    "Card required — cancel renewal anytime after a short exit review from your billing page.",
  cancelChip: "Cancel renewal anytime after a short exit review",
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
    "Serves food on quiet midweek days too",
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
  name: "The 28-Day First-Regular Launch",
  campaignName: "The 28-Day Gastropub Mid-Week Revenue Accelerator",
  nameSafe: "The 28-Day First-Regular Launch",
  nameNote:
    "Built to encourage measurable return visits — never a promise of revenue or filled tables.",
  audience:
    "For single-site UK food-led pubs that are busy at weekends and quiet midweek.",
  riskFraming:
    "You pay for the physical launch today. The platform stays free through the 28-day pilot before recurring billing begins.",
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
 * The price-to-value maths from the offer pack, kept honest: the £25 gross
 * contribution per return visit is an illustrative example, and every page
 * that renders these lines must carry `illustrativeNote` alongside them.
 */
export const VALUE_MATH = {
  assumptionLine:
    "Say an average return visit is worth about £25 to you once costs are out.",
  coverLine:
    "After the launch year, roughly 3 additional profitable visits every 28 days cover the £69.99 subscription.",
  firstYearLine:
    "Roughly 4 additional profitable visits every 28 days cover the £299.99 launch and 12 post-pilot payments during the first 364 days.",
  ninetyDayLine:
    "18 verified return visits contribute about £450 and cover the first three £69.99 payments.",
  illustrativeNote:
    "That £25 is only an example — your margins will differ. You’ll see the real numbers in your own dashboard.",
} as const

/**
 * The one investment line, composed from `PRODUCT` so every acquisition
 * surface states the launch, pilot, recurring price, and cadence identically.
 */
export const PLAN_LINE = `${PRODUCT.launchFee} done-for-you launch today. Then a ${PRODUCT.pilot}, followed by ${PRODUCT.price}. ${PRODUCT.billingDisclosure}`

/** A genuine bespoke, enquiry-only alternative; no checkout is offered. */
export const TAKEOVER = {
  name: "The Ultimate Pub Loyalty Takeover",
  price: "£4,999.99",
  qualifier: "Bespoke scope agreed before purchase.",
  action: "Discuss a bespoke takeover",
} as const

// --- The done-for-you launch (offer pack docs 3 + 8) -------------------------

/**
 * The assembled delivery pitch: the Nabaperks team does the launch. The five steps are
 * the master doc's own sequence and drive the how-it-works page's HowTo schema.
 * `covers` is the plain description of the launch work (no fee framing).
 */
export const DFY_LAUNCH = {
  intro:
    "Instead of handing you empty software, the Nabaperks team does the launch.",
  covers:
    "We handle the whole launch: venue and card configuration, a margin-safe mystery reward pool, and your first A4 counter-poster run — generated, printed and posted to your pub.",
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

// --- The problem (offer pack doc 1 + doc 3 Step 2) ---------------------------

/**
 * The midweek problem and the objections pub owners actually raise (doc 3
 * Step 2, kept in the owner's own voice as the pack frames them). Rendered as
 * the pain section that justifies the price before it's shown. Each pain is a
 * real objection the launch answers later in the feature section.
 */
export const PROBLEM = {
  headline: "The weekend rush you can't clone into Tuesday",
  intro:
    "Strong Friday and Saturday. Then Tuesday to Thursday the rent, the staff and the kitchen are all still on — just quieter. Most loyalty fixes ask for exactly what a busy pub hasn't got.",
  pains: [
    "I've no time to set up another piece of software.",
    "I don't know what to give away without wrecking my margins.",
    "My customers won't download another app.",
    "I don't want a POS or EPOS integration project.",
    "My staff will forget anything fiddly at the till.",
    "I've no designer for posters.",
    "I'd never know if anyone actually came back.",
    "If it does nothing in month one, I don't want to keep paying.",
  ],
  turn: "Every one of those is answered below — and priced so a handful of return visits covers it.",
} as const

// --- The features (product view of the offer; docs 3 + 4) --------------------

export type MarketingFeatureKey =
  | "no-app-qr"
  | "mystery-rewards"
  | "dashboard"
  | "birthdays"
  | "referrals"
  | "posters"

export type MarketingFeature = {
  readonly key: MarketingFeatureKey
  /** Short tab label. */
  readonly tab: string
  /** Section title when the tab is open. */
  readonly title: string
  /** What the feature includes — a short checklist. */
  readonly includes: readonly string[]
  /** The obstacle it removes (the honest analogue of "time saved"). */
  readonly removes: string
}

/**
 * The launch as a product feature set for the landing-page listicle. Sourced
 * from `CORE_OFFER` + `BONUS_STACK` + `PRODUCT`; each feature names the pain it
 * removes rather than an invented time saving.
 */
export const FEATURES: readonly MarketingFeature[] = [
  {
    key: "no-app-qr",
    tab: "No-app card",
    title: "A loyalty card that opens from one venue QR",
    includes: [
      "Customers scan and collect — no app, no wallet pass",
      "One permanent venue QR, join and stamp journeys tested",
      "No POS or EPOS integration, no extra till hardware",
      "Staff keep a simple scan and one short line",
    ],
    removes: "Removes the “download our app” objection at the counter.",
  },
  {
    key: "mystery-rewards",
    tab: "Rewards",
    title: "A food-led mystery reward pool, set with you",
    includes: [
      "Weighted mystery rewards seeded with your card",
      "Free-starter, coffee-after-lunch, Sunday-roast-upgrade territory",
      "Tuned to stay margin-safe",
      "Edit it or launch with it as-is",
    ],
    removes: "Removes the “what do we give away” guesswork.",
  },
  {
    key: "dashboard",
    tab: "Dashboard",
    title: "Visits, regulars and redemptions you can actually see",
    includes: [
      "Dashboard for visits, members, stamps and returning customers",
      "Weekly digest of visits, regulars and redemptions by email",
      "Verified return visits, not guesswork",
      "Optional location checks at your venue",
    ],
    removes: "Removes the “I'd never know if it worked” doubt.",
  },
  {
    key: "birthdays",
    tab: "Birthdays",
    title: "Birthday treats that send themselves",
    includes: [
      "Birthday reward name and terms configured on your card",
      "The platform issues birthday rewards during a guest's birthday month",
      "No manual list, no monthly chasing",
    ],
    removes: "Removes the weekly job of messaging guests by hand.",
  },
  {
    key: "referrals",
    tab: "Referrals",
    title: "“Bring a Regular” invites, wired up",
    includes: [
      "Existing members invite new diners with a share link",
      "Attribution handled automatically",
      "The referrer's bonus stamps settle after a genuine first visit",
    ],
    removes: "Removes the need to buy ads to find new diners.",
  },
  {
    key: "posters",
    tab: "Posters",
    title: "Counter posters, printed and posted to you",
    includes: [
      "A first run of print-ready A4 counter posters with your venue QR",
      "Counter copy already laid out",
      "First run physically printed and posted to the pub",
    ],
    removes: "Removes the hunt for a designer and a print shop.",
  },
] as const

// --- The outcome (offer pack doc 3 Step 1 — the transformation) --------------

/**
 * Before/after from the offer pack's dream-outcome step. Concrete buckets, no
 * invented precision — each "after" item is a real thing the launch delivers.
 */
export const TRANSFORMATION = {
  heading: "From quiet-midweek guesswork to a system you can watch",
  before: [
    "Busy weekends, quiet Tuesday to Thursday",
    "No simple way to bring customers back",
    "A stamp card nobody can measure — or none at all",
    "No idea which offers actually pull people in",
  ],
  after: [
    "A live browser card customers open from your QR",
    "Printed posters on the counter, working for you",
    "Birthday treats and referrals running on their own",
    "A dashboard showing who came back, and when",
  ],
} as const

// --- Landing composition copy (structural, not offer facts) -----------------

/**
 * Structural copy for the conversion landing. These are NOT offer facts — they
 * are the page's own composition: the hero's benefit headline, the three
 * product-moment beats and the fit statement. Kept here so `/` has a single
 * source and the marketing contract can assert on the voice.
 *
 * Voice rule: publican English, never offer-framework jargon, and never a
 * revenue or filled-tables promise. The headline uses the safe framing set by
 * the closing CTA — "a reason to come back", never an outcome claim.
 */
export const LANDING = {
  hero: {
    eyebrow: BRAND.positioning,
    headline: "Give your weekend crowd a reason to come back on a Tuesday",
    support:
      "A no-app loyalty card they open from your counter QR — and we set the whole thing up for you.",
    demoLink: "or try the live card",
  },
  moment: {
    title: "This is the whole thing",
    beats: [
      {
        caption: "Scan the counter QR",
        detail: "The card opens in their browser. No app, no wallet pass.",
      },
      {
        caption: "Staff add a stamp",
        detail: "One scan at the till. Nothing to type, nothing to remember.",
      },
      {
        caption: "The mystery reward reveals",
        detail: "Drawn from a pool you set, so your margins stay yours.",
      },
    ],
    closing: "And every return visit shows up in your dashboard.",
  },
  fit: {
    title: "Built for one kind of pub",
    lines: [
      "Single-site and owner-led",
      "Serves food on quiet midweek days too",
      "Busy at weekends, with regulars worth bringing back",
    ],
    honest:
      "If you're closed most of the week, or you want a promise of full tables, we'll tell you it's not a fit.",
    link: "See the full fit checklist",
  },
} as const

// --- The guarantee stack (offer pack doc 5) ----------------------------------

/**
 * The First-Regular Guarantee — the offer's core risk reversal, owner-approved
 * 2026-07-05 and updated for the 28-day billing plan on 2026-07-31. Support
 * extends the Stripe trial. No billing code depends on this copy. Compose
 * surfaces from these parts; never fork the promise as a page literal.
 */
export const GUARANTEE = {
  name: "First-Regular Guarantee",
  line: "If your live card hasn't brought back a first regular by the end of your 28-day pilot, the platform pilot stays free until it does.",
  applies: "Applies from the day your venue QR goes live.",
  claim: "Contact the Nabaperks team and we’ll apply the extension.",
  conditions:
    "Conditions: the done-for-you setup is completed, the approved posters are displayed, rewards are honoured, and no deliberate staff gaming of the card.",
} as const

/**
 * The 90-Day ROI Extension — the offer pack's second, value risk reversal
 * (owner-approved 2026-07-18, marketing offer v3). Honoured by support as a
 * manual plan-fee relief worth £209.97; no billing code depends on this copy.
 */
export const GUARANTEE_ROI = {
  name: "90-Day ROI Extension",
  line: "If your loyalty card doesn't record 18 verified return visits within 90 days, you receive £209.97 of plan-fee relief.",
  mechanic: `${VALUE_MATH.ninetyDayLine} If your dashboard hasn't recorded them by day 90, Nabaperks provides £209.97 of plan-fee relief: three fully discounted renewal invoices on 28-day billing, or £209.97 returned from the current annual subscription payment.`,
  starts:
    "The 90 days start on the Europe/London calendar date when Nabaperks records your venue QR as live after setup.",
  claimWindow:
    "Submit a claim from day 90 through day 104, inclusive, using the support address in the merchant terms.",
  fulfilment:
    "For 28-day billing, the next three renewal invoices receive a 100% discount. For annual prepay, the equivalent £209.97 is returned from the current annual subscription payment.",
  conditions:
    "Conditions: the QR stays actively displayed at the counter for the full 90 days, rewards are honoured, and no test or staff gaming of the card.",
  claim: "Contact the Nabaperks team and we’ll apply the discount.",
} as const

/**
 * The claims boundary the whole site holds (offer pack docs 3, 5, 6 and 8).
 * What we stand behind is a measurable return signal the software can track —
 * never an uncontrollable revenue outcome.
 */
export const CLAIMS_BOUNDARY = {
  guarantee:
    "What we do promise: a completed launch and extra pilot time if the card has not brought back your first regular within 28 days — a promise tied to a number you can check on your own dashboard.",
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
 * never a fake deadline or a repackaging of something already included.
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
 * software's own guided flow — the done-for-you launch is Nabaperks driving
 * these same steps for the venue.
 */
export const SETUP = {
  line: "Review your card first. Activate it when billing is ready.",
  steps:
    "Five guided steps — share your venue, review the card, confirm your pre-filled rewards, activate billing, then approve your venue QR.",
  noFriction: "No app to build, no POS to connect, nothing to install.",
  earlyWin:
    "Approve your venue, card and rewards first. Once billing is active, your venue QR unlocks for customers to scan and collect their first stamp.",
} as const

/**
 * What the Growth Plan includes. Retained as an approved commercial fact set for
 * merchant billing and marketing pricing copy.
 */
export const PLAN_INCLUDES = [
  "Unlimited stamps and members",
  "Simple reward setup",
  "Permanent venue QR",
  "Weekly digest of visits, regulars and redemptions",
  "Optional location checks at your venue",
] as const

// --- The pub buyer's guide (the /loyalty-for-pubs hub) ----------------------

/**
 * The pub hub's own content layer — the decision a publican makes *before*
 * choosing a vendor, which no other route owns. `/` sells, `/how-it-works`
 * explains our mechanics, `/pricing` states the commercials and the three
 * `/guides/*` pages go deep on one question each; this block is the layer above
 * them all: should you run a scheme, which shape, and what does it cost you on
 * the floor.
 *
 * Voice rule (same as `LANDING`): publican English, never offer-framework
 * jargon, and never a revenue or filled-tables promise. Every option below is
 * described honestly in both directions — including the ones we don't sell and
 * the case for doing nothing — because a buyer's guide that only flatters its
 * own product isn't one.
 */

export type PubGuideSectionId =
  | "decide"
  | "options"
  | "staff-time"
  | "at-the-till"
  | "failures"
  | "questions"
  | "fit"
  | "guides"

export type PubGuideSection = {
  readonly id: PubGuideSectionId
  /** Spine label — short enough for the sticky rail. */
  readonly navLabel: string
  readonly eyebrow: string
  readonly heading: string
  /** Lead prose; each section's structured payload renders after it. */
  readonly paragraphs: readonly string[]
}

/** The ordered spine. The jump nav and the section markers both derive here. */
export const PUB_GUIDE_SECTIONS: readonly PubGuideSection[] = [
  {
    id: "decide",
    navLabel: "Should you?",
    eyebrow: "The first question",
    heading: "Should your pub run a loyalty scheme at all?",
    paragraphs: [
      "A loyalty scheme doesn't create demand. It gives the people already walking through your door a reason to choose you again sooner — so the honest test is whether you have returning faces to work with in the first place.",
      "If your weekends are full and Tuesday to Thursday is thin, you have the raw material: a crowd that already likes the place, arriving on the nights you don't need the help. That gap is the opportunity, and it's the one thing a card can act on.",
      "If you're quiet every night, or you're new enough that nobody has been in twice yet, a card is the wrong tool and any vendor telling you otherwise is selling. Fix the reason people aren't coming first — no stamp card manufactures a first visit.",
    ],
  },
  {
    id: "options",
    navLabel: "The four options",
    eyebrow: "The landscape",
    heading: "The four ways pubs run loyalty",
    paragraphs: [
      "Nearly every scheme you'll be pitched is one of four shapes. They fail in different places, and the right one depends far less on the feature list than on what your guests and your staff will genuinely do at a busy counter.",
    ],
  },
  {
    id: "staff-time",
    navLabel: "Staff time",
    eyebrow: "The real cost",
    heading: "What it actually costs your staff",
    paragraphs: [
      "The subscription is the easy number. The one that decides whether a scheme survives its first busy Friday is what it asks of the person behind the bar.",
    ],
  },
  {
    id: "at-the-till",
    navLabel: "At the till",
    eyebrow: "On the floor",
    heading: "What changes at the counter",
    paragraphs: [
      "This is the part worth picturing before you sign anything, because it's the part that happens a hundred times a week.",
    ],
  },
  {
    id: "failures",
    navLabel: "How they fail",
    eyebrow: "Before you commit",
    heading: "How pub loyalty schemes actually fail",
    paragraphs: [
      "Almost none of these are software problems — which is exactly why comparing feature lists doesn't protect you from them.",
    ],
  },
  {
    id: "questions",
    navLabel: "What to ask",
    eyebrow: "Due diligence",
    heading: "What to ask any loyalty vendor",
    paragraphs: [
      "Ask these of anyone you talk to, us included. The answers separate the products faster than a demo will.",
    ],
  },
  {
    id: "fit",
    navLabel: "Is your pub a fit?",
    eyebrow: "Check the fit",
    heading: "Built for a strong weekend and a quieter middle",
    paragraphs: [],
  },
  {
    id: "guides",
    navLabel: "Go deeper",
    eyebrow: "Keep reading",
    heading: "Go deeper on one question",
    paragraphs: [
      "Three practical guides, each on a single decision you'll face once you've picked a shape.",
    ],
  },
] as const

export type PubLoyaltyOption = {
  readonly key: "paper" | "app" | "wallet" | "qr"
  readonly name: string
  /** True only for the shape this product actually is — labelled on-page. */
  readonly ours: boolean
  readonly guestDoes: string
  readonly youBuy: string
  readonly youLearn: string
  readonly failsWhen: string
  readonly bestWhen: string
}

/**
 * The options landscape, stated honestly in all four directions. The three
 * shapes we don't sell keep their genuine strengths, and ours keeps its real
 * failure mode — a comparison that only flatters the seller is worth nothing to
 * the reader and gets treated that way.
 */
export const PUB_LOYALTY_OPTIONS: readonly PubLoyaltyOption[] = [
  {
    key: "paper",
    name: "Paper stamp card",
    ours: false,
    guestDoes: "Carries a card and remembers to bring it back",
    youBuy: "Printing, reprinted every time you run out",
    youLearn: "Nothing — no record survives the counter",
    failsWhen:
      "Cards get lost, stamps get given twice, and a year on you still can't say whether it worked",
    bestWhen:
      "You want something running this week and genuinely don't need to measure it",
  },
  {
    key: "app",
    name: "Your own branded app",
    ours: false,
    guestDoes: "Installs an app and makes an account before the first stamp",
    youBuy: "A build, then upkeep across two app stores",
    youLearn: "A great deal — from the guests who actually install it",
    failsWhen:
      "The install ask lands mid-queue with people waiting behind, and most guests quietly decline",
    bestWhen:
      "You have a large, frequent customer base and the budget to keep an app alive",
  },
  {
    key: "wallet",
    name: "A wallet pass",
    ours: false,
    guestDoes: "Adds a pass to Apple Wallet or Google Wallet",
    youBuy: "A pass platform subscription",
    youLearn: "Some — installs and pushes, less about the visit itself",
    failsWhen:
      "Stamping still needs a device and an agreed process at the till, and the two wallet platforms don't behave alike",
    bestWhen:
      "Your guests already live in their wallet app and someone owns the setup",
  },
  {
    key: "qr",
    name: "A QR browser card",
    ours: true,
    guestDoes:
      "Scans the counter code; the card opens in the browser they already have",
    youBuy: "A subscription — nothing to print again, nothing to build",
    youLearn:
      "Visits, members and returning customers, plus a weekly digest by email",
    failsWhen:
      "The code isn't displayed where people queue, or staff never mention it",
    bestWhen:
      "You want the smallest possible ask of a guest mid-queue, and you want the visits recorded",
  },
] as const

/** What the scheme asks of the people running it, split by when it's asked. */
export const PUB_STAFF_TIME = {
  perStamp: {
    when: "At the till",
    detail:
      "One scan by the guest, and one short line for staff to say. Nothing for staff to type, look up or remember about the guest.",
  },
  weekly: {
    when: "Every week after that",
    detail:
      "Keep the poster where people queue, and honour the rewards guests turn up with. That is the entire ongoing job.",
  },
  setup: {
    when: "Up front",
    detail:
      "This is where most schemes quietly cost the most — picking rewards, building the card, chasing artwork and a print shop. On a done-for-you launch, the Nabaperks team does those steps instead of handing them to you.",
  },
  warning:
    "A scheme that needs someone to run a report, chase a list or reconcile a spreadsheet creates recurring admin that is easy to defer. Judge any vendor on the till moment, not the feature list.",
} as const

/** The floor process, walked through once. Four beats, then the honest test. */
export const PUB_TILL_MOMENT = {
  steps: [
    "A guest orders. The poster is already on the counter, where they're standing anyway.",
    "Staff say one line — the same line every shift, so nobody has to improvise on a busy night.",
    "The guest scans. The card opens in their browser; nothing to install, no account to make first.",
    "The guest confirms the stamp on their phone. The visit is recorded, and they can see how close they are.",
  ],
  closing:
    "That's the whole floor process. If a vendor's version takes longer to explain than this one, you've learned something useful.",
} as const

export type PubLoyaltyFailure = {
  readonly symptom: string
  readonly why: string
  readonly fix: string
}

/**
 * The five ways these schemes die. Each maps to something the launch or the
 * qualification rules already address, so the page can be honest about the
 * failure mode without turning the section into a pitch.
 */
export const PUB_LOYALTY_FAILURES: readonly PubLoyaltyFailure[] = [
  {
    symptom: "The code is never seen",
    why: "It ends up on a table talker nobody reads, or behind the bar where only staff can reach it.",
    fix: "Put it where people already stand still — the counter, at the moment they're waiting to pay.",
  },
  {
    symptom: "Staff never mention it",
    why: "When the line isn't agreed, everyone invents their own, and on a busy night they skip it entirely.",
    fix: "One short line, briefed once, identical for every shift.",
  },
  {
    symptom: "The reward isn't worth the trip",
    why: "A few percent off doesn't move anyone off the sofa on a wet Tuesday.",
    fix: "Make it something a guest would mention to someone else — and keep your margin by drawing from a pool you set.",
  },
  {
    symptom: "Nobody ever measures it",
    why: "A paper card records nothing, so the scheme runs for a year on a feeling.",
    fix: "Pick something that records visits and returning customers, then actually look at it each week.",
  },
  {
    symptom: "It rewards the nights already busy",
    why: "A scheme stamping hardest on a packed Saturday is discounting trade you already had.",
    fix: "Point the reward at the quiet stretch you're actually trying to fill.",
  },
] as const

export type PubVendorQuestion = {
  readonly ask: string
  readonly why: string
  readonly ourAnswer: string
}

/**
 * The due-diligence list. Our own answers sit beside each question rather than
 * in a separate pitch — including the last one, where the answer has to state
 * the limit as plainly as the promise.
 */
export const PUB_VENDOR_QUESTIONS: readonly PubVendorQuestion[] = [
  {
    ask: "Does my guest have to install anything?",
    why: "Every install is a place the queue breaks down.",
    ourAnswer: `${PRODUCT.cardLine} No app, and no wallet pass.`,
  },
  {
    ask: "Does it touch my POS?",
    why: "POS work turns a small decision into an IT project with a third supplier in the middle.",
    ourAnswer: `${PRODUCT.posLine} The till process stays a scan and one short line.`,
  },
  {
    ask: "Who sets it up — me, or you?",
    why: "“Software access” and “a launched scheme” are very different purchases at a similar price.",
    ourAnswer: `${DFY_LAUNCH.intro} ${DFY_LAUNCH.covers}`,
  },
  {
    ask: "What will I actually be able to see?",
    why: "If it can't show you returning customers, you can't tell whether any of it worked.",
    ourAnswer:
      "A dashboard for visits, members, stamps and returning customers, plus a weekly digest of visits, regulars and redemptions by email.",
  },
  {
    ask: "What does it cost once the trial ends?",
    why: "The trial price is never the question. The twelfth month is.",
    ourAnswer: `${PLAN_LINE} ${PRODUCT.cancelLine}`,
  },
  {
    ask: "And what if it doesn't work?",
    why: "Ask what a vendor stands behind — then ask, just as carefully, what they don't.",
    ourAnswer: `${GUARANTEE.name}: ${GUARANTEE.line}`,
  },
] as const

/** The pub hub's own hero copy — deliberately a guide H1, never the `/` one. */
export const PUB_GUIDE_HERO = {
  eyebrow: "Buyer's guide · food-led pubs",
  headline:
    "Loyalty cards for pubs: how to choose one your regulars will actually use",
  support:
    "An honest look at the four ways pubs run loyalty — what each one asks of your guests, what it costs your staff, and how to tell which fits your pub. Written by the team that runs these launches.",
  jumpLabel: "On this page",
  /** Article dates for the byline + Article schema. ISO plus its display twin. */
  publishedOn: "2026-07-28",
  updatedOn: "2026-07-28",
  updatedLabel: "28 July 2026",
} as const

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
    offerName: OFFER.name,
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
    offerName: "The 28-Day First-Regular Launch",
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
    offerName: "The 28-Day First-Regular Launch",
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
    offerName: "The 28-Day First-Regular Launch",
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
    answer: `${PRODUCT.launchFee} pays for the done-for-you launch today. After a ${PRODUCT.pilot}, choose ${PRODUCT.price} or ${PRODUCT.annualPrice} prepaid annually. ${PRODUCT.annualSaving} ${PRODUCT.cancelLine}`,
  },
  {
    question: "Is there a launch fee?",
    answer: `Yes. The one-time ${PRODUCT.launchFee} launch fee covers configuration, bespoke printed launch materials and delivery. It is charged at checkout and is separate from the free platform pilot.`,
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
      "Is there a launch fee?",
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
  faq: "/faq",
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
  { path: ROUTES.faq, priority: 0.8, changeFrequency: "monthly" },
  { path: ROUTES.pubs, priority: 0.8, changeFrequency: "monthly" },
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
