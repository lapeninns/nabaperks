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

test("OF-1 Given the true cancel-anytime policy When public surfaces are inspected Then no notice period survives and the FAQ states the honest mechanics", () => {
  // Given
  const facts = readProjectFile("lib", "marketing", "facts.ts")
  const pricing = readProjectFile("app", "pricing", "page.tsx")
  const signup = readProjectFile("app", "(auth)", "signup", "page.tsx")
  const legal = readProjectFile("lib", "legal", "content.ts")

  // When / Then — the constants are the policy.
  assert.match(
    facts,
    /cancelLine: "Card required — cancel anytime from your billing page\."/
  )
  assert.match(facts, /cancelChip: "Cancel anytime"/)
  assert.doesNotMatch(
    [facts, pricing, signup, legal].join("\n"),
    /month(&apos;|')s notice|notice period/i
  )
  // The cancel FAQ replaces the notice period with the real mechanics.
  assert.match(pricing, /end of your current billing month/)
  assert.match(pricing, /no regular is left holding a broken seal/)
})

test("OF-2 Given the First-Regular Guarantee When the facts module is pinned Then the constant carries name, promise, condition and claim path", () => {
  const facts = readProjectFile("lib", "marketing", "facts.ts")

  assert.match(facts, /export const GUARANTEE = \{/)
  assert.match(facts, /name: "First-Regular Guarantee"/)
  assert.match(
    facts,
    /line: "If your live card hasn't brought back a first regular by the end of your 30-day pilot, the pilot stays free until it does\."/
  )
  assert.match(
    facts,
    /applies: "Applies from the day your venue QR goes live\."/
  )
  assert.match(
    facts,
    /claim: `Email \$\{OPERATOR\.supportEmail\} and the team applies the extension\.`/
  )
})

test("OF-3 Given the guarantee is single-source When decision surfaces render it Then pricing, signup and terms use the constant and never fork the literal", () => {
  const pricing = readProjectFile("app", "pricing", "page.tsx")
  const signup = readProjectFile("app", "(auth)", "signup", "page.tsx")
  const legal = readProjectFile("lib", "legal", "content.ts")

  // Pricing presents promise, condition and claim path; signup carries the
  // promise as a trust point at the decision moment.
  assert.match(pricing, /GUARANTEE\.line/)
  assert.match(pricing, /GUARANTEE\.applies/)
  assert.match(pricing, /GUARANTEE\.claim/)
  assert.match(signup, /GUARANTEE\.line/)

  // Merchant terms keep the durable record with the definition and remedy.
  assert.match(legal, /id: "guarantee"/)
  assert.match(legal, /title: "First-Regular Guarantee"/)
  assert.match(legal, /GUARANTEE\.line/)
  assert.match(
    legal,
    /another normal visit stamp on a later Europe\/London date/
  )
  assert.match(legal, /GUARANTEE\.applies/)
  assert.match(legal, /GUARANTEE\.claim/)

  // The promise never forks off-constant on marketing surfaces.
  assert.doesNotMatch(
    [pricing, signup].join("\n"),
    /pilot stays free until it does/
  )
})

test("OF-4 Given the bonus stack When /pricing presents it Then the five inclusions come from one constant, stay claims-safe, and leave PLAN_INCLUDES untouched", () => {
  const facts = readProjectFile("lib", "marketing", "facts.ts")
  const pricing = readProjectFile("app", "pricing", "page.tsx")

  assert.match(facts, /export const OFFER_STACK = \[/)
  for (const name of [
    "Launch-ready till poster kit",
    "Done-for-you mystery reward pool",
    "Set-and-forget retention automations",
    "Privacy jobs, handled",
    "The operator's loyalty guides",
  ]) {
    assert.ok(facts.includes(`name: "${name}"`), `OFFER_STACK carries ${name}`)
  }
  assert.match(pricing, /OFFER_STACK/)

  // Included with the one price — never unbundled pricing theatre, and the
  // privacy item sells mechanisms, not compliance assurance.
  assert.doesNotMatch(
    [facts, pricing].join("\n"),
    /sold separately|normally sold|worth £/i
  )
  assert.match(facts, /consent-led marketing kept separate/i)

  // The TrustPricing teaser contract (AV-4) stays intact: PLAN_INCLUDES is
  // unchanged and the stack is additive.
  assert.match(
    facts,
    /export const PLAN_INCLUDES = \[\n  "Unlimited stamps and members",\n  "Simple reward setup",\n  "Permanent venue QR",/
  )
})
