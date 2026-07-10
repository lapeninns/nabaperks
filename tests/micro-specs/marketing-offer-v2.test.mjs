import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

function readProjectFile(...segments) {
  return readFileSync(path.join(projectRoot, ...segments), "utf8")
}

test("OV2-1 Given the offer name When facts + pricing are inspected Then OFFER.name is the single-source wrapper and the hero product headline is untouched", () => {
  const facts = readProjectFile("lib", "marketing", "facts.ts")
  const pricing = readProjectFile("app", "pricing", "page.tsx")
  const hero = readProjectFile(
    "components",
    "marketing",
    "landing",
    "hero.tsx"
  )

  assert.match(facts, /export const OFFER = \{/)
  assert.match(facts, /name: "The 30-Day First-Regular Launch"/)
  assert.match(pricing, /OFFER\.name/)
  // The name is the offer wrapper — the product headline stays as-is.
  assert.match(hero, /The loyalty card that just opens\./)
  assert.doesNotMatch(hero, /The 30-Day First-Regular Launch/)
})

test("OV2-2 Given the activation path When SETUP renders Then billing is the fifth single-sourced step shown on pricing", () => {
  const facts = readProjectFile("lib", "marketing", "facts.ts")
  const pricing = readProjectFile("app", "pricing", "page.tsx")

  assert.match(facts, /export const SETUP = \{/)
  assert.match(facts, /line: "Build your card first\. Activate it when billing is ready\."/)
  assert.match(
    facts,
    /Five guided steps — add your venue, build the card, confirm your pre-filled rewards, prepare your QR, and activate billing\./
  )
  assert.match(
    facts,
    /noFriction: "No app to build, no POS to connect, nothing to install\."/
  )
  assert.match(
    facts,
    /Once billing is active, customers can scan your live venue QR to join and collect their first stamp\./
  )
  assert.match(pricing, /SETUP\./)
})

test("OV2-3 Given the bonus stack When enriched Then each item carries an obstacle, anchors are justified external comparisons, and privacy stays mechanism-only", () => {
  const facts = readProjectFile("lib", "marketing", "facts.ts")
  const pricing = readProjectFile("app", "pricing", "page.tsx")

  // Every item gained an obstacle; the poster + automation items carry
  // real, justified external anchors.
  assert.match(facts, /obstacle:/)
  assert.match(facts, /you'd pay a freelance designer £150\+ to make/)
  assert.match(facts, /you'd otherwise chase by hand every week/)
  // Pricing renders the obstacle and the anchor.
  assert.match(pricing, /bonus\.obstacle/)
  assert.match(pricing, /bonus\.anchor/)
  // No invented reference/RRP price or unbundling theatre anywhere.
  assert.doesNotMatch(
    [facts, pricing].join("\n"),
    /sold separately|normally sold|worth £|\bRRP\b|was £/i
  )
  // Privacy item still sells mechanisms, never a price or compliance claim.
  assert.match(facts, /consent-led marketing kept separate/i)
})

test("OV2-4 Given the guarantee When surfaced under the offer Then the best/worst framing is single-sourced and pricing never forks the promise literal", () => {
  const facts = readProjectFile("lib", "marketing", "facts.ts")
  const pricing = readProjectFile("app", "pricing", "page.tsx")

  assert.match(facts, /riskFraming:/)
  assert.match(
    facts,
    /Best case, your regulars come back and the £49 pays for itself\. Worst case, you pay nothing more until one does\./
  )
  assert.match(pricing, /OFFER\.riskFraming/)
  assert.match(pricing, /GUARANTEE\.line/)
  // Best/worst copy is not forked as a literal on the page.
  assert.doesNotMatch(pricing, /Best case, your regulars come back/)
})

test("OV2-5 Given the rolling monthly promo When enabled Then it is single-sourced and rendered on pricing, signup and the hero via getActivePromo", () => {
  const promoModule = readProjectFile("lib", "marketing", "promo.ts")
  const pricing = readProjectFile("app", "pricing", "page.tsx")
  const signup = readProjectFile("app", "(auth)", "signup", "page.tsx")
  const hero = readProjectFile(
    "components",
    "marketing",
    "landing",
    "hero.tsx"
  )

  assert.match(promoModule, /export const PROMO_CONFIG = \{/)
  assert.match(promoModule, /enabled: true/)
  assert.doesNotMatch(promoModule, /monthlyCap|spotsRemaining|claimedThisMonth/)
  assert.match(promoModule, /export function getActivePromo\(/)
  assert.match(promoModule, /First-Regular promo/)
  assert.match(promoModule, /print and post your first counter-poster run — free/)
  // Rendered from getActivePromo on all three surfaces.
  assert.match(pricing, /getActivePromo\(/)
  assert.match(signup, /getActivePromo\(/)
  assert.match(hero, /promo\.name/)
  assert.match(pricing, /promo\.claim/)
  assert.match(signup, /promo\.claim/)
})

test("OV2-6 Given promo honesty When terms + surfaces are checked Then /terms records the promo and no acquisition surface forks the promo perk off-constant", () => {
  const promoModule = readProjectFile("lib", "marketing", "promo.ts")
  const legal = readProjectFile("lib", "legal", "content.ts")
  const pricing = readProjectFile("app", "pricing", "page.tsx")
  const signup = readProjectFile("app", "(auth)", "signup", "page.tsx")
  const hero = readProjectFile(
    "components",
    "marketing",
    "landing",
    "hero.tsx"
  )

  // Terms carry a durable plain-English promo record.
  assert.match(legal, /id: "monthly-first-regular-promo"/)
  assert.doesNotMatch(legal, /monthly print-run capacity|spots? left/)
  // The staleness helper exists so a lapsed promo can still be checked in tests.
  assert.match(promoModule, /export function isPromoStale\(/)
  // The perk is only ever composed inside getActivePromo — not forked on pages.
  assert.doesNotMatch(
    [pricing, signup, hero].join("\n"),
    /print and post your first counter-poster run/
  )
})
