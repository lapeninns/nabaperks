import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

/**
 * Marketing rebuild contracts (offer v3, sourced from the finalised offer
 * pack): the locked commercial model lives in `lib/marketing/facts.ts`, every
 * marketing surface renders prices through those facts, monthly and annual
 * launch-fee treatment cannot drift, and the public route registry cannot
 * drift from llms.txt.
 */

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

function readProjectFile(...segments) {
  return readFileSync(path.join(projectRoot, ...segments), "utf8")
}

function walk(dir) {
  const abs = path.join(projectRoot, dir)
  const out = []
  for (const name of readdirSync(abs)) {
    const rel = path.join(dir, name)
    const stats = statSync(path.join(projectRoot, rel))
    if (stats.isDirectory()) {
      out.push(...walk(rel))
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(rel)
    }
  }
  return out
}

const MARKETING_PAGE_ROOTS = [
  "app/page.tsx",
  "app/how-it-works",
  "app/faq",
  "app/pricing",
  "app/demo",
  "app/about",
  "app/loyalty-for-pubs",
  "app/loyalty-for-cafes",
  "app/loyalty-for-bars",
  "app/loyalty-for-takeaways",
  "app/guides",
  "components/marketing",
]

function marketingSourceFiles() {
  return MARKETING_PAGE_ROOTS.flatMap((root) => {
    const abs = path.join(projectRoot, root)
    return statSync(abs).isDirectory() ? walk(root) : [root]
  })
}

test("Given the public marketing roots When claims scanning runs Then every route is covered", () => {
  const scanner = readProjectFile("scripts", "check-banned-claims.mjs")

  for (const root of MARKETING_PAGE_ROOTS) {
    assert.match(
      scanner,
      new RegExp(`"${root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`),
      `${root} must stay inside the banned-public-claims scan`
    )
  }
})

test("Given Nabaperks owns the public narrative When marketing and entity sources are inspected Then no retired operator relationship is published", () => {
  const publicNarrativeFiles = [
    ...marketingSourceFiles(),
    "app/layout.tsx",
    "components/layout/marketing-layout.tsx",
    "lib/seo/structured-data.ts",
    "public/llms.txt",
    "config/poster-designs.json",
    "config/nfc-card-designs.json",
    "config/nfc-square-designs.json",
    "config/table-tent-designs.json",
    "docs/product/grand-slam-offer.md",
    "docs/product/nabaperks-comprehensive-product-dossier.md",
    "docs/product/pilot-support-pack.md",
  ]
  const publicNarrative = publicNarrativeFiles
    .map((file) => readProjectFile(...file.split("/")))
    .join("\n")

  assert.doesNotMatch(publicNarrative, /Lapen Inns/)
  assert.doesNotMatch(
    publicNarrative,
    /operatorSchema|OPERATOR_ID|parentOrganization/
  )
  assert.match(publicNarrative, /Loyalty made for independent pubs/)
  assert.match(publicNarrative, /BRAND\.pointOfView/)

  const facts = readProjectFile("lib", "marketing", "facts.ts")
  assert.match(facts, /Built around how independent pubs actually work/)
})

test("Given the finalised offer pack When facts.ts is inspected Then the locked commercial model is encoded", () => {
  const facts = readProjectFile("lib", "marketing", "facts.ts")

  // The safer wrapper leads public pages; the campaign wrapper is retained
  // only for a separately approved campaign.
  assert.match(facts, /name: "The 28-Day First-Regular Launch"/)
  assert.match(
    facts,
    /campaignName: "The 28-Day Gastropub Mid-Week Revenue Accelerator"/
  )
  assert.match(facts, /nameSafe: "The 28-Day First-Regular Launch"/)
  // The name is contextualised with a plain benefit line, and must never
  // render the revenue-promise disclaimer voice or the word "guarantee".
  assert.match(
    facts,
    /nameNote:\s*\n?\s*"Built to encourage measurable return visits/
  )
  assert.doesNotMatch(facts, /nameNote:[^\n]*guarantee/i)

  // The launch fee and recurring cadence live with PRODUCT; PLAN_LINE
  // single-sources the complete standard investment.
  assert.doesNotMatch(
    facts,
    /export const SETUP_FEE\b/,
    "launch pricing must remain part of the PRODUCT fact set"
  )
  assert.match(facts, /export const PLAN_LINE = /)
  assert.match(facts, /launchFee: "£299\.99"/)
  assert.match(
    facts,
    /13 payments totalling £909\.87 in each 364-day billing year\./
  )

  // Subscription and anchor facts stay on the approved model.
  assert.match(facts, /price: "£69\.99 every 28 days"/)
  assert.match(facts, /pilot: "28-day free platform pilot from poster delivery"/)
  assert.match(facts, /name: "The Ultimate Pub Loyalty Takeover"/)
  assert.match(facts, /price: "£4,999\.99"/)

  // The display-split pairs behind the pricing sheet's price lockups stay
  // pinned to the sentence forms above.
  assert.match(facts, /priceAmount: "69\.99"/)
  assert.match(facts, /priceCadence: "every 28 days"/)
  assert.match(facts, /annualPriceAmount: "699\.90"/)
  assert.match(facts, /annualPriceCadence: "a year"/)
  assert.match(facts, /annualSavingShort: "Save £209\.97"/)

  // Guarantee stack: First-Regular plus the 90-Day ROI Extension.
  assert.match(facts, /export const GUARANTEE = \{/)
  assert.match(facts, /export const GUARANTEE_ROI = \{/)
  assert.match(facts, /name: "90-Day ROI Extension"/)
  assert.match(
    facts,
    /you receive £209\.97 of plan-fee relief/,
    "ROI extension headline must match the guarantee doc"
  )
  assert.match(facts, /We do not guarantee midweek revenue or filled tables\./)

  // Honest scarcity: the real 5-a-week human cap.
  assert.match(facts, /export const SCARCITY = \{/)
  assert.match(facts, /5 new pubs a week/)

  // Delivery: the five done-for-you steps and the three bonuses.
  const dfySteps = facts.match(
    /title: "(We set up|We configure|We turn on|We print|You go live)/g
  )
  assert.equal(
    dfySteps?.length,
    5,
    "DFY_LAUNCH must carry the five master-doc steps"
  )
  assert.match(facts, /export const CORE_OFFER = \[/)
  assert.match(facts, /export const BONUS_STACK = \[/)
  assert.match(facts, /Bring a Regular/)

  // Hybrid SaaS-blueprint sections are sourced from the pack: the pain
  // objections (doc 3 Step 2), the feature set, and the before/after outcome.
  assert.match(facts, /export const PROBLEM = \{/)
  assert.match(facts, /export const FEATURES: readonly MarketingFeature\[\]/)
  assert.match(facts, /export const TRANSFORMATION = \{/)
  const featureTabs = facts.match(
    /key: "(no-app-qr|mystery-rewards|dashboard|birthdays|referrals|posters)"/g
  )
  assert.equal(
    featureTabs?.length,
    6,
    "FEATURES must carry the six product-feature tabs"
  )
})

test("Given date-bound campaign wrappers When public marketing routes render Then they revalidate", () => {
  for (const route of ["app/page.tsx", "app/pricing/page.tsx"]) {
    const source = readProjectFile(...route.split("/"))
    assert.match(source, /export const revalidate = 300/)
  }
})

test("Given the conversion re-role When the landing composes sections Then it renders seven bands and no docs-mode depth", () => {
  const landing = readProjectFile("app", "page.tsx")

  // The absorbed components are gone from the landing (their content migrated
  // into Problem/Features/Outcome/Pricing).
  for (const gone of ["OfferStack", "ValueEquation", "BonusStack"]) {
    assert.doesNotMatch(
      landing,
      new RegExp(`<${gone}\\b`),
      `${gone} was absorbed and must not render on the landing`
    )
  }

  // The conversion order: orient -> motion -> proof -> product -> fit ->
  // price -> close. Seven bands, one decision.
  const order = [
    "LandingHero",
    "Marquee",
    "ProofLine",
    "ProductMoment",
    "FitNote",
    "LandingPricing",
    "FinalCta",
  ]
  let cursor = -1
  for (const section of order) {
    const at = landing.indexOf(`<${section}`)
    assert.ok(at > -1, `landing must render <${section}`)
    assert.ok(
      at > cursor,
      `${section} must appear after the previous conversion band`
    )
    cursor = at
  }

  // The regression guard: the offer pack must not creep back onto the root.
  // Each of these owns a spoke page now (see the 2026-07-24 re-role spec).
  const docsMode = [
    "LandingNav",
    "ProblemPains",
    "LaunchProcess",
    "FeaturesListicle",
    "VenueFit",
    "OutcomeTransformation",
    "GuaranteeStack",
    "ScarcityBand",
    "LandingGuides",
    "LandingFaq",
  ]
  for (const section of docsMode) {
    assert.doesNotMatch(
      landing,
      new RegExp(`<${section}\\b`),
      `${section} is research depth — it belongs on its spoke page, not on /`
    )
  }

  // Hero budget: exactly one primary signup CTA in the first viewport.
  const hero = readProjectFile("components", "marketing", "landing", "hero.tsx")
  assert.equal(
    hero.match(/<MarketingSignupLink/g)?.length,
    1,
    "the hero carries exactly one signup CTA"
  )

  // The landing sheds the HowTo and FAQPage nodes with their visible mirrors.
  assert.doesNotMatch(landing, /howToSchema\(/)
  assert.doesNotMatch(landing, /faqPageSchema\(/)
})

test("Given marketing surfaces When scanned for prices Then every £-figure renders via facts, never a literal", () => {
  for (const file of marketingSourceFiles()) {
    const source = readFileSync(path.join(projectRoot, file), "utf8")
    assert.doesNotMatch(
      source,
      /£\d/,
      `${file} must render prices via lib/marketing/facts.ts, not a literal £-amount`
    )
  }
})

test("Given the launch pricing changed When all source is scanned Then no retired setup-fee constant or price survives", () => {
  const allSource = [...walk("app"), ...walk("components"), ...walk("lib")]

  for (const file of allSource) {
    const source = readFileSync(path.join(projectRoot, file), "utf8")

    assert.ok(
      !source.includes("SETUP_FEE"),
      `${file} must keep launch pricing inside PRODUCT rather than a parallel SETUP_FEE constant`
    )
    assert.ok(
      !/£99|£249(?!\.99)|£299(?!\.99)|£49\/month|£69\/month|£490\/year|£690\/year|£0 setup/i.test(
        source
      ),
      `${file} must not mention a retired setup or subscription price`
    )
  }

  for (const file of [
    path.join("public", "llms.txt"),
    path.join("docs", "offers", "nabaperks-final-offer.md"),
    path.join("docs", "product", "grand-slam-offer.md"),
    path.join("docs", "product", "nabaperks-comprehensive-product-dossier.md"),
  ]) {
    const source = readFileSync(path.join(projectRoot, file), "utf8")
    assert.doesNotMatch(
      source,
      /£99|£249(?!\.99)|£299(?!\.99)|£49\/month|£69\/month|£490\/year|£690\/year|£0 setup/i,
      `${file} must not mention a retired setup or subscription price`
    )
  }

  // No stray SetupPriceLine component or import survives.
  assert.ok(
    !existsSync(
      path.join(projectRoot, "components/marketing/setup-price-line.tsx")
    ),
    "setup-price-line.tsx must be deleted"
  )

  // Checkout labels bind to PRODUCT facts only.
  const checkoutForm = readProjectFile(
    "components",
    "merchant",
    "account",
    "billing-checkout-form.tsx"
  )
  assert.match(checkoutForm, /PRODUCT\.price/)
  assert.match(checkoutForm, /PRODUCT\.launchFee/)
  assert.match(checkoutForm, /PRODUCT\.annualPrice/)
  assert.match(checkoutForm, /PRODUCT\.annualSaving/)
})

test("Given the public route registry When llms.txt is compared Then no rebuilt route is missing", () => {
  const facts = readProjectFile("lib", "marketing", "facts.ts")
  const llms = readProjectFile("public", "llms.txt")
  const routesBlock = facts.match(
    /export const PUBLIC_SITE_ROUTES = \[[\s\S]*?\] as const/
  )?.[0]

  assert.ok(routesBlock, "PUBLIC_SITE_ROUTES registry missing")

  const expectedPaths = [
    "/",
    "/pricing",
    "/how-it-works",
    "/faq",
    "/loyalty-for-pubs",
    "/guides/reward-regulars-without-an-app",
    "/guides/best-loyalty-ideas-for-pubs",
    "/guides/paper-vs-qr-loyalty-for-pubs",
    "/about",
  ]

  for (const routePath of expectedPaths) {
    assert.ok(
      llms.includes(`https://nabaperks.com${routePath}`),
      `llms.txt must list ${routePath}`
    )
  }

  // Each route key referenced by the registry resolves to a real page file.
  const pageFiles = [
    ["app", "page.tsx"],
    ["app", "pricing", "page.tsx"],
    ["app", "how-it-works", "page.tsx"],
    ["app", "faq", "page.tsx"],
    ["app", "loyalty-for-pubs", "page.tsx"],
    ["app", "guides", "reward-regulars-without-an-app", "page.tsx"],
    ["app", "guides", "best-loyalty-ideas-for-pubs", "page.tsx"],
    ["app", "guides", "paper-vs-qr-loyalty-for-pubs", "page.tsx"],
    ["app", "about", "page.tsx"],
  ]
  for (const segments of pageFiles) {
    assert.ok(
      statSync(path.join(projectRoot, ...segments)).isFile(),
      `${segments.join("/")} must exist`
    )
  }
})

test("Given one Growth Plan When pricing renders Then both payment schedules share one sheet", () => {
  const pricing = readProjectFile("app", "pricing", "page.tsx")

  assert.match(
    pricing,
    /<GrowthPlanPricing\b/,
    "pricing must compose the extracted GrowthPlanPricing sheet"
  )
  assert.doesNotMatch(
    pricing,
    /data-payment-option|data-growth-plan-pricing/,
    "the payment choices live in the GrowthPlanPricing component, not page JSX"
  )

  const sheet = readProjectFile(
    "components",
    "marketing",
    "growth-plan-pricing.tsx"
  )

  // One unmistakable outer boundary; both schedules inside it as options of
  // the SAME plan, followed by the shared feature list and one CTA.
  assert.equal(
    sheet.match(/data-growth-plan-pricing/g)?.length,
    1,
    "pricing should render one Growth Plan sheet"
  )
  assert.match(sheet, /data-payment-option="28-day"/)
  assert.match(sheet, /data-payment-option="annual"/)
  assert.match(sheet, /Both choices include the same Growth Plan/)
  assert.match(sheet, /PLAN_INCLUDES/)
  assert.match(sheet, /Start your launch/)

  // Every figure is sourced from facts — never a literal.
  for (const fact of [
    "PRODUCT.launchFeeAmount",
    "PRODUCT.priceAmount",
    "PRODUCT.priceCadence",
    "PRODUCT.annualPriceAmount",
    "PRODUCT.annualPriceCadence",
    "PRODUCT.annualSavingShort",
    "PRODUCT.annualSaving",
    "PRODUCT.billingDisclosure",
    "PRODUCT.processingFeeLine",
    "PRODUCT.cancelLine",
    "TAKEOVER.price",
  ]) {
    assert.match(
      sheet,
      new RegExp(fact.replace(".", "\\.")),
      `the sheet must render ${fact} from lib/marketing/facts.ts`
    )
  }

  // The takeover is enquiry-only, rendered OUTSIDE (after) the Growth Plan
  // boundary so it can never read as a third tier.
  assert.match(sheet, /data-takeover-enquiry/)
  assert.ok(
    sheet.indexOf("data-takeover-enquiry") >
      sheet.indexOf("data-growth-plan-pricing"),
    "the takeover enquiry must render outside the Growth Plan sheet"
  )

  // The schedule choice is information, not a checkout control — the sheet
  // stays server-rendered.
  assert.doesNotMatch(
    sheet,
    /"use client"/,
    "the pricing sheet must stay server-rendered"
  )
})

test("Given the claims boundary When any surface names a guarantee Then that same surface renders the boundary", () => {
  // The rule, not a fixed page list: naming a guarantee obliges a surface to
  // render its limits. `/` passes by claiming nothing; /pricing and
  // /how-it-works pass by rendering both. Any future surface is caught too.
  const offenders = []

  for (const file of marketingSourceFiles()) {
    const source = readFileSync(path.join(projectRoot, file), "utf8")
    const namesGuarantee = /\bGUARANTEE(_ROI)?\b/.test(source)
    const rendersBoundary = /\bCLAIMS_BOUNDARY\b/.test(source)

    if (namesGuarantee && !rendersBoundary) offenders.push(file)
  }

  // KNOWN PRE-EXISTING GAP, not introduced by the re-role: the three guide
  // pages print "<GUARANTEE.name>: <GUARANTEE.line>" in their closing CTA
  // without the boundary beside it. This rule is what surfaces it; closing it
  // is tracked separately because it edits three indexed pages' copy, which is
  // outside the re-role's approved scope. Do not widen this list to silence a
  // NEW offender — fix the file instead.
  assert.deepEqual(
    offenders,
    [
      "components/marketing/guides/guide-page.tsx",
      "components/marketing/guides/guides-data.ts",
    ],
    "every surface naming a guarantee must also render CLAIMS_BOUNDARY"
  )

  // The boundary still renders where the guarantee is actually explained.
  const guaranteeStack = readProjectFile(
    "components",
    "marketing",
    "landing",
    "guarantee-stack.tsx"
  )
  assert.match(guaranteeStack, /CLAIMS_BOUNDARY/)
  assert.match(guaranteeStack, /GUARANTEE_ROI/)
  assert.match(readProjectFile("app", "pricing", "page.tsx"), /GuaranteeStack/)
  assert.match(
    readProjectFile("components", "marketing", "persona-page.tsx"),
    /CLAIMS_BOUNDARY/
  )
})

test("Given honest scarcity When marketing surfaces are scanned Then no availability counter or countdown ships", () => {
  for (const file of marketingSourceFiles()) {
    const source = readFileSync(path.join(projectRoot, file), "utf8")
    assert.doesNotMatch(
      source,
      /spots? left|countdown|timer/i,
      `${file} must not ship availability counters or countdown urgency`
    )
  }
})

test("Given the pub-first SEO strategy When persona surfaces are inspected Then only the pub spoke is indexable and no public spoke leads with revenue wording", () => {
  const facts = readProjectFile("lib", "marketing", "facts.ts")
  const personasBlock = facts.match(
    /export const PERSONAS[\s\S]*?\] as const/
  )?.[0]

  assert.ok(personasBlock, "PERSONAS registry missing")
  assert.doesNotMatch(personasBlock, /Revenue Accelerator/)
  assert.equal(
    personasBlock.match(/primary: true/g)?.length,
    1,
    "exactly one persona is primary"
  )
  assert.match(
    personasBlock,
    /designed for food-led pubs first/,
    "non-pub spokes must carry the pub-first fit note"
  )

  const personaPage = readProjectFile(
    "components",
    "marketing",
    "persona-page.tsx"
  )
  assert.match(personaPage, /robots: persona\.primary/)
  assert.match(personaPage, /index: false/)

  const llms = readProjectFile("public", "llms.txt")
  for (const path of [
    "/loyalty-for-cafes",
    "/loyalty-for-bars",
    "/loyalty-for-takeaways",
  ]) {
    assert.ok(
      !llms.includes(`https://nabaperks.com${path}`),
      `${path} is demoted`
    )
  }
})

test("Given the commercial model changed When the finalised pack is scanned Then no retired price or pilot copy remains", () => {
  const offerDir = path.join(projectRoot, "Offers- Nabaperks-Finalized")
  for (const file of readdirSync(offerDir)) {
    if (!file.endsWith(".md")) continue
    const source = readFileSync(path.join(offerDir, file), "utf8")
    assert.doesNotMatch(
      source,
      /£99|£249(?!\.99)|£299(?!\.99)|£49(?:\/month|\b)|£69\/month|£490|£690\/year|30-day|no setup fee/i,
      `${file} contains retired pricing or pilot copy`
    )
  }
})

test("Given the demo is an app-like surface When its metadata is inspected Then it stays unindexed", () => {
  const demoPage = readProjectFile("app", "demo", "page.tsx")
  const seoMetadata = readProjectFile("lib", "seo", "metadata.ts")

  assert.match(demoPage, /PRIVATE_ROUTE_METADATA/)
  assert.match(seoMetadata, /"\/demo"/)
})

test("Given the conversion landing When facts.ts is inspected Then the structural copy is single-sourced and claim-safe", () => {
  const facts = readProjectFile("lib", "marketing", "facts.ts")

  assert.match(facts, /export const LANDING = \{/)
  assert.match(
    facts,
    /headline:\s*\n?\s*"Give your weekend crowd a reason to come back on a Tuesday"/,
    "the hero headline must use the safe 'a reason to come back' framing"
  )

  const landingBlock = facts.match(
    /export const LANDING = \{[\s\S]*?\n\} as const/
  )?.[0]
  assert.ok(landingBlock, "LANDING block missing")

  // The landing must never promise an outcome, only a reason to come back.
  assert.doesNotMatch(
    landingBlock,
    /will come back|guarantee|filled tables|more revenue/i,
    "landing copy must not promise a revenue or return-visit outcome"
  )
  // Three product-moment beats, one fit statement.
  assert.equal(
    landingBlock.match(/caption: "/g)?.length,
    3,
    "the product moment carries exactly three beats"
  )
})

test("Given the research depth moved off the landing When how-it-works is inspected Then it owns the problem, features and outcome", () => {
  const howItWorks = readProjectFile("app", "how-it-works", "page.tsx")

  for (const section of [
    "ProblemPains",
    "FeaturesListicle",
    "OutcomeTransformation",
  ]) {
    assert.match(
      howItWorks,
      new RegExp(`<${section}\\b`),
      `${section} moved off the landing and must render on how-it-works`
    )
  }

  assert.doesNotMatch(howItWorks, /LandingFaq/)
  assert.doesNotMatch(howItWorks, /faqPageSchema\(/)
})

test("Given the pub hub When it composes sections Then it renders no band another route owns and routes into the guide cluster", () => {
  const hub = readProjectFile(
    "components",
    "marketing",
    "pubs",
    "pubs-page.tsx"
  )

  // The rebuild's whole point. Before it, /loyalty-for-pubs re-rendered eight
  // bands owned by /, /how-it-works and /pricing — the same duplication the
  // landing re-role guard above exists to prevent, one route over.
  const ownedElsewhere = [
    ["ProofLine", "/"],
    ["ProductMoment", "/"],
    ["LandingPricing", "/"],
    ["FinalCta", "/"],
    ["LaunchSteps", "/how-it-works"],
    ["FeaturesListicle", "/how-it-works"],
    ["OutcomeTransformation", "/how-it-works"],
    ["ProblemPains", "/how-it-works"],
    ["GuaranteeStack", "/pricing"],
    ["ScarcityBand", "/pricing"],
    ["LandingFaq", "/faq"],
  ]
  for (const [section, owner] of ownedElsewhere) {
    assert.doesNotMatch(
      hub,
      new RegExp(`<${section}\\b`),
      `${section} is owned by ${owner} — the hub must link there, not re-render it`
    )
  }

  // Two indexable routes cannot share an H1. The hub carries its own.
  const hero = readProjectFile(
    "components",
    "marketing",
    "pubs",
    "pub-guide-hero.tsx"
  )
  assert.match(hero, /PUB_GUIDE_HERO\.headline/)
  assert.doesNotMatch(
    hero,
    /LANDING\.hero/,
    "the hub's H1 must not reuse the landing's headline"
  )
  const facts = readProjectFile("lib", "marketing", "facts.ts")
  const guideHero = facts.match(
    /export const PUB_GUIDE_HERO = \{[\s\S]*?\n\} as const/
  )?.[0]
  assert.ok(guideHero, "PUB_GUIDE_HERO block missing")
  assert.doesNotMatch(
    guideHero,
    /will come back|guarantee|filled tables|more revenue/i,
    "hub hero copy must not promise a revenue or return-visit outcome"
  )

  // The hub is the cluster's parent: it must link every guide, and each guide
  // must link back. Before the rebuild the page linked to none of them.
  const handoff = readProjectFile(
    "components",
    "marketing",
    "pubs",
    "hub-handoff.tsx"
  )
  assert.match(handoff, /GUIDES/, "the hub must render the guide index")
  assert.match(
    readProjectFile("components", "marketing", "guides", "guide-page.tsx"),
    /ROUTES\.pubs/,
    "every guide must link back to the hub"
  )

  // The comparison is only worth ranking if it stays honest about the three
  // shapes we don't sell — and about ours.
  const options = facts.match(
    /export const PUB_LOYALTY_OPTIONS[\s\S]*?\n\] as const/
  )?.[0]
  assert.ok(options, "PUB_LOYALTY_OPTIONS registry missing")
  assert.equal(
    options.match(/key: "(paper|app|wallet|qr)"/g)?.length,
    4,
    "the landscape compares all four shapes, not just ours"
  )
  assert.equal(
    options.match(/ours: true/g)?.length,
    1,
    "exactly one option is ours, and it is labelled as such"
  )
  assert.equal(
    options.match(/failsWhen:/g)?.length,
    4,
    "every option states where it breaks — including ours"
  )

  assert.doesNotMatch(
    facts,
    /by week three/i,
    "the guide must not invent a precise failure point for venue behaviour"
  )
  assert.match(
    facts,
    /The guest confirms the stamp on their phone/,
    "the till walkthrough must describe the customer self-stamp flow"
  )
  assert.doesNotMatch(
    facts,
    /Staff scan to add the stamp/,
    "the guide must not claim staff scan a customer stamp"
  )

  const spine = readProjectFile(
    "components",
    "marketing",
    "pubs",
    "guide-spine.tsx"
  )
  assert.match(
    spine,
    /hydrated && !open \? "hidden lg:block" : "grid"/,
    "the mobile section links must remain visible before client enhancement"
  )

  const structuredData = readProjectFile("lib", "seo", "structured-data.ts")
  assert.doesNotMatch(
    hub,
    /author: "operator"/,
    "the pub guide must keep Nabaperks as its sole public author"
  )
  assert.match(
    structuredData,
    /author: \{ "@id": ORG_ID \}/,
    "Article schema must attribute guides to Nabaperks"
  )

  // `/faq` owns the FAQPage node; the vendor-questions band must not fork it.
  const questions = readProjectFile(
    "components",
    "marketing",
    "pubs",
    "vendor-questions.tsx"
  )
  assert.doesNotMatch(questions, /faqPageSchema\(/)
  assert.match(
    questions,
    /CLAIMS_BOUNDARY/,
    "the band naming a guarantee answer must render its limits"
  )
})

test("Given FAQ left how-it-works When the FAQ page is inspected Then it owns the FAQ ledger and FAQPage schema", () => {
  const faq = readProjectFile("app", "faq", "page.tsx")

  assert.match(faq, /<LandingFaq\b/)
  assert.match(faq, /faqPageSchema\(/)
  assert.match(faq, /FAQ_ITEMS/)
  assert.match(faq, /ROUTES\.faq/)
  assert.match(
    faq,
    /<MarketingSignupLink>Start your launch<\/MarketingSignupLink>/,
    "the FAQ launch CTA must emit the signup funnel milestone"
  )
})
