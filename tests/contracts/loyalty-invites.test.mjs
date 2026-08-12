import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { test } from "node:test"

/**
 * Contract test for Bulk Two-Stamp Loyalty Invitations: proves the feature's
 * seams are wired end to end without a database or browser. Mirrors
 * tests/contracts/issued-reward-invites.test.mjs.
 */

const root = fileURLToPath(new URL("../..", import.meta.url))
const read = (relative) => readFileSync(`${root}/${relative}`, "utf8")

test("environment contract + .env.example declare the new secrets", () => {
  const contract = read("config/env-contract.json")
  assert.match(contract, /CUSTOMER_EMAIL_ENCRYPTION_KEY/)
  assert.match(contract, /RESEND_WEBHOOK_SECRET/)

  const example = read(".env.example")
  assert.match(example, /CUSTOMER_EMAIL_ENCRYPTION_KEY=/)
  assert.match(example, /RESEND_WEBHOOK_SECRET=/)
})

test("the feature is default-on for every merchant — no flag, no allowlist", () => {
  // No feature flag or allowlist gate remains.
  assert.doesNotMatch(
    read("config/env-contract.json"),
    /NABAPERKS_FEATURE_BULK_LOYALTY_INVITATIONS/
  )
  // The per-merchant allowlist column, its admin toggle and its gate are gone.
  const migration = read(
    "supabase/migrations/20260722100400_loyalty_invite_default_on.sql"
  )
  assert.match(migration, /drop column if exists loyalty_invites_enabled/)
  assert.match(
    migration,
    /drop function if exists public\.admin_set_merchant_loyalty_invites/
  )
  assert.doesNotMatch(
    read("app/app/customers/invite/actions.ts"),
    /isLoyaltyInvitesEnabled|loyalty_invites_enabled/
  )
})

test("email is stored encrypted + hashed, never raw, and scrubbed", () => {
  const codec = read("lib/customer/email-encryption-core.ts")
  assert.match(codec, /aes-256-gcm/)
  assert.match(codec, /CUSTOMER_EMAIL_ENCRYPTION_KEY/)
  const schema = read(
    "supabase/migrations/20260722100000_loyalty_invite_schema.sql"
  )
  assert.match(schema, /email_ciphertext text/)
  assert.match(schema, /email_hmac text not null/)
  assert.match(schema, /email_masked text/)
  assert.match(schema, /force row level security/)
})

test("claim + unsubscribe tokens are derived and only hashes are stored", () => {
  const tokens = read("lib/loyalty-invites/tokens.ts")
  assert.match(tokens, /claim/)
  assert.match(tokens, /unsubscribe/)
  assert.match(tokens, /hashInviteToken/)
  const schema = read(
    "supabase/migrations/20260722100000_loyalty_invite_schema.sql"
  )
  assert.match(schema, /claim_token_hash text unique/)
  assert.match(schema, /unsubscribe_token_hash text unique/)
})

test("the claim transaction awards exactly two loyalty_invite stamps atomically", () => {
  const sql = read(
    "supabase/migrations/20260722100200_loyalty_invite_claim.sql"
  )
  assert.match(sql, /join_customer_membership\(/)
  assert.match(sql, /'source', 'loyalty_invite'/)
  assert.match(sql, /generate_series\(1, 2\)/)
  assert.match(sql, /total_stamps_earned = total_stamps_earned \+ 2/)
  assert.match(sql, /earned_business_date/)
  // Guards: expiry, existing membership, email conflict, >=3-stamp card.
  assert.match(sql, /email_conflict/)
  assert.match(sql, /already_member/)
  assert.match(sql, /stamps_required.*< 3|< 3/)
  assert.match(sql, /for update/)
})

test("the delivery worker + cron drain are wired with idempotency + retries", () => {
  const worker = read("lib/loyalty-invites/delivery-worker.ts")
  assert.match(worker, /claim_due_loyalty_invite_recipients/)
  assert.match(worker, /settle_loyalty_invite_send/)
  assert.match(worker, /Idempotency-Key/)
  assert.match(worker, /decryptCustomerEmail/)
  const cron = read("app/api/cron/loyalty-invite-drain/route.ts")
  assert.match(cron, /isAuthorizedCronRequest/)
  assert.match(cron, /runLoyaltyInviteDrain/)
  const vercel = read("vercel.json")
  assert.match(vercel, /loyalty-invite-drain/)
  assert.match(vercel, /\*\/5 \* \* \* \*/)
})

test("the Resend webhook verifies signatures and suppresses bounces", () => {
  const route = read("app/api/resend/webhook/route.ts")
  assert.match(route, /verifyStandardWebhook/)
  assert.match(route, /RESEND_WEBHOOK_SECRET/)
  assert.match(route, /apply_loyalty_invite_delivery_event/)

  // Bound the body before hashing it. Ordering is asserted by index because a
  // [\s\S]* regex is satisfied by the import statement alone.
  assert.match(route, /readSignedWebhookBody\(request\)/)
  assert.match(route, /body === null[\s\S]{0,200}status: 413/)
  assert.doesNotMatch(route, /request\.text\(\)/)
  const boundedReadAt = route.indexOf("await readSignedWebhookBody(request)")
  const verifyAt = route.indexOf("verifyStandardWebhook({")
  assert.ok(boundedReadAt > -1, "the route reads through the bounded reader")
  assert.ok(
    verifyAt > boundedReadAt,
    "the bounded read must precede HMAC verification"
  )
  const rpc = read(
    "supabase/migrations/20260722100100_loyalty_invite_campaign_rpcs.sql"
  )
  assert.match(rpc, /loyalty_invite_email_suppressions/)
  assert.match(rpc, /'bounced', 'complained'/)
})

test("the join flow consumes the invite cookie at terms acceptance", () => {
  const actions = read("app/m/[merchantSlug]/join/actions.ts")
  assert.match(actions, /claimLoyaltyInviteIfPresent/)
  assert.match(actions, /claim_loyalty_invite/)
  assert.match(actions, /readInviteCookie/)
  const claimPage = read("app/invite/[token]/page.tsx")
  assert.match(claimPage, /resolveInviteClaimContext/)
  const startAction = read("app/invite/[token]/actions.ts")
  assert.match(startAction, /setInviteCookie/)
})

test("the merchant UI exposes Invite customers to every merchant", () => {
  const members = read("app/app/customers/page.tsx")
  assert.match(members, /Invite customers/)
  assert.doesNotMatch(members, /isLoyaltyInvitesEnabled/)
  const page = read("app/app/customers/invite/page.tsx")
  assert.doesNotMatch(page, /isLoyaltyInvitesEnabled/)
  assert.match(page, /InviteCustomersForm/)
})

test("retention, export and erasure cover the new data", () => {
  const retention = read(
    "supabase/migrations/20260722100300_loyalty_invite_retention.sql"
  )
  assert.match(retention, /expire_and_purge_loyalty_invites/)
  assert.match(retention, /interval '24 hours'/)
  assert.match(retention, /interval '365 days'/)
  assert.match(retention, /admin_erase_loyalty_invitations_for_customer/)
  assert.match(retention, /loyalty_invitations_export_for_customer/)
  const cron = read("app/api/cron/privacy-retention/route.ts")
  assert.match(cron, /expire_and_purge_loyalty_invites/)
  const adminAction = read("app/admin/actions.ts")
  assert.match(adminAction, /admin_erase_customer_pii/)
})

test("the OpenAPI contract documents the Resend webhook", () => {
  const openapi = read("docs/api/openapi.json")
  assert.match(openapi, /\/api\/resend\/webhook/)
  assert.match(openapi, /app\/api\/resend\/webhook\/route\.ts/)
})

test("legal documentation discloses the invitation data flow", () => {
  const legal = read("lib/legal/content.ts")
  assert.match(legal, /two welcome stamps/)
  assert.match(legal, /unsubscribe/)
  assert.match(legal, /encrypted/)
})

test("review hardening: Svix headers, actor audit, revocable completed, atomic erasure", () => {
  const route = read("app/api/resend/webhook/route.ts")
  assert.match(route, /svix-id/)
  assert.match(route, /svix-signature/)

  const rpcs = read(
    "supabase/migrations/20260722100100_loyalty_invite_campaign_rpcs.sql"
  )
  assert.match(
    rpcs,
    /'draft', 'sending', 'completed'/,
    "completed stays revocable"
  )
  assert.match(rpcs, /p_actor_user_id/, "actor is recorded")
  assert.match(
    rpcs,
    /perform public\.complete_loyalty_invite_campaign_if_drained\(p_campaign_id\)/,
    "a zero-recipient campaign self-completes at confirmation"
  )

  const inviteActions = read("app/app/customers/invite/actions.ts")
  assert.match(inviteActions, /p_actor_user_id: gate\.actorUserId/)
  assert.match(inviteActions, /p_created_by: gate\.actorUserId/)

  const adminAction = read("app/admin/actions.ts")
  assert.match(adminAction, /admin_erase_customer_pii/)
  assert.doesNotMatch(
    adminAction,
    /admin_erase_loyalty_invitations_for_customer/
  )
})
