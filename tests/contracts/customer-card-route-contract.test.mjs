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
  // One hop: the RPC takes the SESSION's customer id, never request input.
  assert.match(
    loader,
    /\.rpc\("get_customer_card_state", \{\s*p_membership_id: membershipId,\s*p_customer_id: currentCustomer\.id,?\s*\}\)/
  )
  assert.doesNotMatch(loader, /\.from\("/)
  assert.match(
    loader,
    /if \(membership\.customer_id !== currentCustomer\.id\) \{[\s\S]*status: "unauthorized"/
  )
  assert.ok(
    loader.indexOf("membership.customer_id !== currentCustomer.id") <
      loader.indexOf("pickStampBlockingUnlockedReward"),
    "membership ownership must be re-checked before card, reward, or billing detail is used"
  )
  assert.doesNotMatch(loader, /searchParams|request|customerId:\s*string/)
  // The legacy multi-query read survives one release, reachable only when the
  // RPC is absent.
  assert.ok(
    loader.indexOf("isMissingRpcError(error)") <
      loader.indexOf("legacyGetCustomerCardState("),
    "the legacy read is a missing-RPC fallback, not a parallel path"
  )

  // The database proves ownership before it reads any card, reward or billing
  // detail, and a non-owner receives a bare status.
  const migration = readProjectFile(
    "supabase",
    "migrations",
    "20260909110000_customer_session_and_card_read_rpcs.sql"
  )
  const cardRpc = migration.slice(
    migration.indexOf(
      "create or replace function public.get_customer_card_state"
    )
  )
  const notFoundAt = cardRpc.indexOf(
    "jsonb_build_object('status', 'not_found')"
  )
  const unauthorizedAt = cardRpc.indexOf(
    "jsonb_build_object('status', 'unauthorized')"
  )
  const cardReadAt = cardRpc.indexOf("from public.loyalty_cards")
  assert.ok(
    notFoundAt > -1 &&
      unauthorizedAt > notFoundAt &&
      cardReadAt > unauthorizedAt
  )
  assert.match(
    cardRpc,
    /v_membership\.customer_id <> p_customer_id then\s*return jsonb_build_object\('status', 'unauthorized'\);/
  )
  assert.match(cardRpc, /p_customer_id is null or/)
  assert.doesNotMatch(
    cardRpc,
    /grant execute on function public\.get_customer_card_state[^;]*to authenticated/i
  )
  assert.match(
    cardRpc,
    /grant execute on function public\.get_customer_card_state\(uuid, uuid\)\s+to service_role;/
  )
  assert.match(cardRpc, /is_service_role_request\(\)/)
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
  // The reward read now lives in the RPC. Scope to its reward block: the card
  // block legitimately keeps `limit 1` (one active card per merchant), so a
  // whole-function `limit` check would false-positive on that unrelated query.
  const migration = readProjectFile(
    "supabase",
    "migrations",
    "20260909110000_customer_session_and_card_read_rpcs.sql"
  )
  const rewardBlock = migration.slice(
    migration.indexOf("jsonb_agg("),
    migration.indexOf("from public.billing_customers b")
  )

  assert.match(rewardBlock, /r\.membership_id = v_membership\.id/)
  assert.match(rewardBlock, /r\.status = 'unlocked'/)
  assert.match(rewardBlock, /order by r\.created_at desc/)
  assert.doesNotMatch(rewardBlock, /limit/)
  assert.doesNotMatch(rewardBlock, /status in \(/)
  for (const column of [
    "id",
    "status",
    "reward_name",
    "reward_terms",
    "redeemable_from",
    "expires_at",
    "source",
    "created_at",
  ]) {
    assert.match(migration, new RegExp(`'${column}', r\\.${column}`))
  }
  // The card face keys off the stamp-cycle reward; issued rewards ride the gift
  // rail. Both pickers must feed the loader so the two rails stay separate.
  assert.match(loader, /pickStampBlockingUnlockedReward\(unlockedRewards\)/)
  assert.match(loader, /pickIssuedUnlockedReward\(unlockedRewards\)/)
})

test("Given merchant, card, and billing status can block loyalty When the card loader returns facts Then availability is centralized", () => {
  const card = readProjectFile("lib", "customer", "card.ts")
  const loader = card.slice(
    card.indexOf("const unavailableReason = unavailableMessage"),
    card.indexOf("return {", card.indexOf("const unavailableReason"))
  )

  assert.match(loader, /merchant\.status/)
  assert.match(loader, /loyaltyCard\?\.is_active \?\? false/)
  assert.match(loader, /billingStatus/)
  assert.match(loader, /merchant\.requires_billing/)
})

test("Given the home dashboard and the card page both pick a merchant's card When their selection is inspected Then the ordering is identical", () => {
  const migration = readProjectFile(
    "supabase",
    "migrations",
    "20260909110000_customer_session_and_card_read_rpcs.sql"
  )
  const home = readProjectFile("lib", "customer", "home.ts")

  assert.match(
    migration,
    /order by c\.is_active desc, c\.created_at asc\s+limit 1/
  )
  assert.match(
    home,
    /\.order\("is_active", \{ ascending: false \}\)\s*\.order\("created_at", \{ ascending: true \}\)/
  )
})
