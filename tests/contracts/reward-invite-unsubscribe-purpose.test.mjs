import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260902128000_purpose_bind_reward_invite_unsubscribe.sql",
    import.meta.url
  ),
  "utf8"
)
const allocation = readFileSync(
  new URL(
    "../../supabase/migrations/20260902125000_enforce_reward_invite_quota.sql",
    import.meta.url
  ),
  "utf8"
)

test("reward email suppression resolves only the dedicated capability", () => {
  assert.match(
    migration,
    /where unsubscribe_token_hash = p_unsubscribe_token_hash;/
  )
  assert.doesNotMatch(migration, /or claim_token_hash/)
  assert.match(migration, /attached_customer_id/)
})

test("new email invitations cannot manufacture claim-only compatibility", () => {
  assert.match(
    allocation,
    /new\.email_hmac is not null and new\.unsubscribe_token_hash is null/
  )
  assert.match(
    allocation,
    /p_email_hmac is not null and p_unsubscribe_token_hash is null/
  )
  assert.match(
    allocation,
    /new\.unsubscribe_token_hash = new\.claim_token_hash/
  )
  assert.match(
    allocation,
    /existing\.claim_token_hash = new\.unsubscribe_token_hash/
  )
  assert.match(
    allocation,
    /existing\.unsubscribe_token_hash = new\.claim_token_hash/
  )
  assert.match(allocation, /pg_advisory_xact_lock/)
})
