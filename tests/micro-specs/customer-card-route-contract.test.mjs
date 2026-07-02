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

test("Given a customer card URL contains a membership id When the loader runs Then ownership is proven before card detail is loaded", () => {
  const card = readProjectFile("lib", "customer", "card.ts")
  const loader = card.slice(
    card.indexOf("export async function getCustomerCardState"),
    card.indexOf("export function unavailableMessage")
  )

  assert.match(loader, /getCurrentCustomer\(\)/)
  assert.match(loader, /createSupabaseServiceRoleClient\(\)/)
  assert.match(loader, /\.from\("customer_memberships"\)/)
  assert.match(loader, /customer_id/)
  assert.match(loader, /\.eq\("id", membershipId\)/)
  assert.match(loader, /\.maybeSingle\(\)/)
  assert.match(
    loader,
    /if \(membership\.customer_id !== currentCustomer\.id\) \{[\s\S]*status: "unauthorized"/
  )
  assert.ok(
    loader.indexOf("membership.customer_id !== currentCustomer.id") <
      loader.indexOf("Promise.all"),
    "membership ownership must be checked before card, reward, or billing detail loads"
  )
  assert.doesNotMatch(loader, /searchParams|request|customerId:\s*string/)
})

test("Given the card route renders customer state When source is inspected Then it stays private and delegates to the card loader", () => {
  const page = readProjectFile("app", "card", "[membershipId]", "page.tsx")

  // The route stays private (robots noindex via PRIVATE_ROUTE_METADATA); the
  // customer tab title added by the production-polish pass (CUS-P2-03) rides
  // on top through a spread.
  assert.match(
    page,
    /export const metadata: Metadata = \{\s*\.\.\.PRIVATE_ROUTE_METADATA,/
  )
  assert.match(page, /const \{ membershipId \} = await params/)
  assert.match(page, /loadCardExperienceContext\([\s\S]*membershipId/)
  assert.match(page, /deriveCustomerExperience\(\{ entry: "card", context \}\)/)
  assert.doesNotMatch(page, /createSupabase|from\("|customerId/)
})

test("Given a card membership is owned When card detail is loaded Then only active unlocked rewards can drive the card footer", () => {
  const card = readProjectFile("lib", "customer", "card.ts")
  const loader = card.slice(
    card.indexOf("export async function getCustomerCardState"),
    card.indexOf("export function unavailableMessage")
  )

  assert.match(loader, /\.from\("reward_events"\)/)
  assert.match(
    loader,
    /\.select\(\s*"id, status, reward_name, reward_terms, redeemable_from, expires_at"\s*\)/
  )
  assert.match(loader, /\.eq\("membership_id", membership\.id\)/)
  assert.match(loader, /\.eq\("status", "unlocked"\)/)
  assert.match(loader, /\.order\("created_at", \{ ascending: false \}\)/)
  assert.match(loader, /\.limit\(1\)/)
  assert.doesNotMatch(loader, /\.in\("status"/)
})

test("Given merchant, card, and billing status can block loyalty When the card loader returns facts Then availability is centralized", () => {
  const card = readProjectFile("lib", "customer", "card.ts")
  const loader = card.slice(
    card.indexOf("const unavailableReason = unavailableMessage"),
    card.indexOf("return {", card.indexOf("const unavailableReason"))
  )

  assert.match(loader, /merchant\.status/)
  assert.match(loader, /loyaltyCard\?\.is_active \?\? false/)
  assert.match(loader, /billing\?\.status \?\? null/)
  assert.match(loader, /merchant\.requires_billing/)
})
