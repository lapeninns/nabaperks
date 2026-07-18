import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

/**
 * Marketing rebuild contracts (offer v3, sourced from the finalised offer
 * pack): the locked commercial model lives in `lib/marketing/facts.ts`, every
 * marketing surface renders prices through those facts, the £99 setup fee
 * stays copy-only (never wired into checkout), and the public route registry
 * cannot drift from llms.txt.
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

test("Given the finalised offer pack When facts.ts is inspected Then the locked commercial model is encoded", () => {
  const facts = readProjectFile("lib", "marketing", "facts.ts")

  // The offer wrapper and its ASA-safer alternate.
  assert.match(
    facts,
    /name: "The 30-Day Gastropub Mid-Week Revenue Accelerator"/
  )
  assert.match(facts, /nameSafe: "The 30-Day First-Regular Launch"/)
  assert.match(facts, /names the offer, not a revenue promise/)

  // £99 setup — copy-only, invoiced at onboarding.
  assert.match(facts, /export const SETUP_FEE = \{/)
  assert.match(facts, /amount: "£99"/)
  assert.match(facts, /Invoiced when your done-for-you onboarding is booked/)
  assert.match(facts, /not charged through the online checkout/)

  // Subscription facts stay the surviving £49/£490 model.
  assert.match(facts, /price: "£49\/month"/)
  assert.match(facts, /priceAnnual: "£490\/year"/)
  assert.match(facts, /pilot: "30-day free pilot"/)

  // Guarantee stack: First-Regular plus the 90-Day ROI Extension.
  assert.match(facts, /export const GUARANTEE = \{/)
  assert.match(facts, /export const GUARANTEE_ROI = \{/)
  assert.match(facts, /name: "90-Day ROI Extension"/)
  assert.match(
    facts,
    /your next 3 months are completely free/,
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

test("Given the £99 setup fee is copy-only When billing code is scanned Then nothing in the checkout path references it", () => {
  const marketingSurfaceSet = new Set(marketingSourceFiles())
  const allSource = [...walk("app"), ...walk("components"), ...walk("lib")]

  for (const file of allSource) {
    const source = readFileSync(path.join(projectRoot, file), "utf8")

    // The literal figure lives in exactly one source file: the facts module.
    if (file !== path.join("lib", "marketing", "facts.ts")) {
      assert.ok(
        !source.includes("£99"),
        `${file} must not hardcode the setup fee — it renders via SETUP_FEE in lib/marketing/facts.ts`
      )
    }

    // SETUP_FEE is a marketing-copy constant: marketing surfaces + the facts
    // module may read it; billing/checkout/API code must never touch it.
    const allowedSetupFeeReader =
      marketingSurfaceSet.has(file) || file.startsWith("lib/marketing/")
    if (!allowedSetupFeeReader) {
      assert.ok(
        !source.includes("SETUP_FEE"),
        `${file} must not reference SETUP_FEE — the £99 setup is invoiced at onboarding, never charged in checkout`
      )
    }
  }

  // The surviving £49/£490 checkout binds to PRODUCT facts only.
  const checkoutForm = readProjectFile(
    "components",
    "merchant",
    "account",
    "billing-checkout-form.tsx"
  )
  assert.match(checkoutForm, /PRODUCT\.price/)
  assert.match(checkoutForm, /PRODUCT\.priceAnnual/)
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
    "/loyalty-for-pubs",
    "/loyalty-for-cafes",
    "/loyalty-for-bars",
    "/loyalty-for-takeaways",
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
    ["app", "loyalty-for-pubs", "page.tsx"],
    ["app", "loyalty-for-cafes", "page.tsx"],
    ["app", "loyalty-for-bars", "page.tsx"],
    ["app", "loyalty-for-takeaways", "page.tsx"],
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

test("Given the claims boundary When key surfaces are inspected Then the guarantee stack and boundary render from shared facts", () => {
  const landing = readProjectFile("app", "page.tsx")
  const pricing = readProjectFile("app", "pricing", "page.tsx")
  const guaranteeStack = readProjectFile(
    "components",
    "marketing",
    "landing",
    "guarantee-stack.tsx"
  )
  const personaPage = readProjectFile(
    "components",
    "marketing",
    "persona-page.tsx"
  )

  assert.match(landing, /GuaranteeStack/)
  assert.match(pricing, /GuaranteeStack/)
  assert.match(guaranteeStack, /CLAIMS_BOUNDARY/)
  assert.match(guaranteeStack, /GUARANTEE_ROI/)
  assert.match(personaPage, /CLAIMS_BOUNDARY/)
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

test("Given the persona spokes When the registry is inspected Then only pubs carry the gastropub wrapper", () => {
  const facts = readProjectFile("lib", "marketing", "facts.ts")
  const personasBlock = facts.match(
    /export const PERSONAS[\s\S]*?\] as const/
  )?.[0]

  assert.ok(personasBlock, "PERSONAS registry missing")
  const accelerator = personasBlock.match(/Revenue Accelerator/g)
  assert.equal(
    accelerator?.length,
    1,
    "exactly one persona (pubs) may lead with the Revenue Accelerator wrapper"
  )
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
})

test("Given the demo is an app-like surface When its metadata is inspected Then it stays unindexed", () => {
  const demoPage = readProjectFile("app", "demo", "page.tsx")
  const seoMetadata = readProjectFile("lib", "seo", "metadata.ts")

  assert.match(demoPage, /PRIVATE_ROUTE_METADATA/)
  assert.match(seoMetadata, /"\/demo"/)
})
