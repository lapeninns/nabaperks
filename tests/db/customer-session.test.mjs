import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * MS-customer-auth-wallet (session) — live-DB tier.
 *
 * The customer wallet session is a signed cookie BACKED by a revocable
 * `customer_sessions` row. Session integrity was previously grep-only. This
 * executes the real register/touch/revoke RPCs and proves:
 *   - a minted session is active and touchable,
 *   - touch records last-seen but does NOT slide expiry (a hard 30-day window),
 *   - server-side revocation beats a still-valid cookie (touch returns false),
 *   - an expired session is no longer active,
 *   - a session cannot be minted already-expired.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

test("session: mint, touch (no slide), revoke beats a valid cookie, expiry deactivates", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [customer] = await tx`
      insert into public.customers (email, email_verified_at, created_at, updated_at)
      values (${`sess-${randomUUID()}@test.local`}, now(), now(), now())
      returning id`
    const sessionId = randomUUID()

    // ---- Mint a 30-day session.
    await tx`select public.register_customer_session(
      ${customer.id}::uuid, ${sessionId}::uuid, now() + interval '30 days')`
    const [row] = await tx`
      select expires_at, revoked_at from public.customer_sessions where id = ${sessionId}`
    assert.ok(row, "the session row exists")
    assert.equal(row.revoked_at, null, "a fresh session is not revoked")
    assert.ok(new Date(row.expires_at).getTime() > Date.now(), "session expires in the future")
    const expiresAtMinted = new Date(row.expires_at).getTime()

    // ---- Touch is valid and does NOT extend expiry.
    const [{ touch_customer_session: active }] = await tx`
      select public.touch_customer_session(${customer.id}::uuid, ${sessionId}::uuid)`
    assert.equal(active, true, "an active session touches true")
    const [afterTouch] = await tx`
      select expires_at, last_seen_at from public.customer_sessions where id = ${sessionId}`
    assert.equal(
      new Date(afterTouch.expires_at).getTime(),
      expiresAtMinted,
      "touch does NOT slide the expiry (hard 30-day window)"
    )
    assert.notEqual(afterTouch.last_seen_at, null, "touch records last-seen")

    // ---- Server-side revocation beats a still-unexpired cookie.
    await tx`select public.revoke_customer_session(${customer.id}::uuid, ${sessionId}::uuid)`
    const [revoked] = await tx`
      select revoked_at from public.customer_sessions where id = ${sessionId}`
    assert.notEqual(revoked.revoked_at, null, "revoke stamps revoked_at")
    const [{ touch_customer_session: afterRevoke }] = await tx`
      select public.touch_customer_session(${customer.id}::uuid, ${sessionId}::uuid)`
    assert.equal(afterRevoke, false, "a revoked session no longer touches active")
  })
})

test("session: an expired row is inactive, and a session cannot be minted already-expired", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [customer] = await tx`
      insert into public.customers (email, email_verified_at, created_at, updated_at)
      values (${`sess-${randomUUID()}@test.local`}, now(), now(), now())
      returning id`

    // Mint, then force expiry into the past → touch must report inactive.
    const sessionId = randomUUID()
    await tx`select public.register_customer_session(
      ${customer.id}::uuid, ${sessionId}::uuid, now() + interval '30 days')`
    await tx`update public.customer_sessions set expires_at = now() - interval '1 minute'
             where id = ${sessionId}`
    const [{ touch_customer_session: active }] = await tx`
      select public.touch_customer_session(${customer.id}::uuid, ${sessionId}::uuid)`
    assert.equal(active, false, "an expired session is not active")

    // Minting an already-expired session is rejected by the RPC.
    let rejected = false
    try {
      await tx.savepoint(async () => {
        await tx`select public.register_customer_session(
          ${customer.id}::uuid, ${randomUUID()}::uuid, now() - interval '1 minute')`
      })
    } catch (error) {
      rejected = /invalid customer session/i.test(String(error.message))
    }
    assert.ok(rejected, "a session cannot be registered with a past expiry")
  })
})
