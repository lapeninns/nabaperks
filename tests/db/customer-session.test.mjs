import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomBytes, randomUUID } from "node:crypto"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * customer auth wallet (session) — live-DB tier.
 *
 * The customer wallet session is a signed cookie BACKED by a revocable
 * `customer_sessions` row. Session integrity was previously grep-only. This
 * executes the real register/touch/revoke RPCs and proves:
 *   - a minted session is active and touchable,
 *   - a valid touch makes the session open-ended (sessions last until
 *     log-out), including one minted with a 30-day expiry by an older release,
 *   - server-side revocation beats a still-valid cookie (touch returns false),
 *   - "log out on all devices" revokes every session for one customer only,
 *   - an expired session is no longer active,
 *   - a session cannot be minted already-expired.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"
const deviceHash = () => randomBytes(32).toString("hex")

after(async () => {
  await closeDb()
})

test(
  "session: mint, touch makes it open-ended, revoke beats a valid cookie",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [customer] = await tx`
      insert into public.customers (email, email_verified_at, created_at, updated_at)
      values (${`sess-${randomUUID()}@test.local`}, now(), now(), now())
      returning id`
      const sessionId = randomUUID()
      const device = deviceHash()

      // ---- Mint a 30-day session, as the previous app release does.
      await tx`select public.register_customer_session(
      ${customer.id}::uuid, ${sessionId}::uuid, now() + interval '30 days',
      ${device}, 'new_identity')`
      const [row] = await tx`
      select revoked_at, expires_at = 'infinity'::timestamptz as open_ended
      from public.customer_sessions where id = ${sessionId}`
      assert.ok(row, "the session row exists")
      assert.equal(row.revoked_at, null, "a fresh session is not revoked")
      assert.equal(row.open_ended, false, "the legacy mint is still 30 days")

      // ---- A valid touch converts it to a session that lasts until log-out.
      const [{ touch_customer_session: active }] = await tx`
      select public.touch_customer_session(
        ${customer.id}::uuid, ${sessionId}::uuid, ${device}
      )`
      assert.equal(active, true, "an active session touches true")
      const [afterTouch] = await tx`
      select last_seen_at, expires_at = 'infinity'::timestamptz as open_ended
      from public.customer_sessions where id = ${sessionId}`
      assert.equal(
        afterTouch.open_ended,
        true,
        "touch makes a valid session open-ended"
      )
      assert.notEqual(afterTouch.last_seen_at, null, "touch records last-seen")

      // ---- The current app registers open-ended sessions directly.
      const openSessionId = randomUUID()
      await tx`select public.register_customer_session(
      ${customer.id}::uuid, ${openSessionId}::uuid, 'infinity',
      ${device}, 'recognised_device')`
      const [open] = await tx`
      select expires_at = 'infinity'::timestamptz as open_ended
      from public.customer_sessions where id = ${openSessionId}`
      assert.equal(open.open_ended, true, "an open-ended session registers")

      // ---- Server-side revocation beats a still-unexpired cookie.
      await tx`select public.revoke_customer_session(${customer.id}::uuid, ${sessionId}::uuid)`
      const [revoked] = await tx`
      select revoked_at from public.customer_sessions where id = ${sessionId}`
      assert.notEqual(revoked.revoked_at, null, "revoke stamps revoked_at")
      const [{ touch_customer_session: afterRevoke }] = await tx`
      select public.touch_customer_session(
        ${customer.id}::uuid, ${sessionId}::uuid, ${device}
      )`
      assert.equal(
        afterRevoke,
        false,
        "a revoked session no longer touches active"
      )
    })
  }
)

test(
  "session: an expired row is inactive, and a session cannot be minted already-expired",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [customer] = await tx`
      insert into public.customers (email, email_verified_at, created_at, updated_at)
      values (${`sess-${randomUUID()}@test.local`}, now(), now(), now())
      returning id`

      // Mint, then force expiry into the past → touch must report inactive.
      const sessionId = randomUUID()
      const device = deviceHash()
      await tx`select public.register_customer_session(
      ${customer.id}::uuid, ${sessionId}::uuid, now() + interval '30 days',
      ${device}, 'new_identity')`
      await tx`update public.customer_sessions set expires_at = now() - interval '1 minute'
             where id = ${sessionId}`
      const [{ touch_customer_session: active }] = await tx`
      select public.touch_customer_session(
        ${customer.id}::uuid, ${sessionId}::uuid, ${device}
      )`
      assert.equal(active, false, "an expired session is not active")

      // Minting an already-expired session is rejected by the RPC.
      let rejected = false
      try {
        await tx.savepoint(async () => {
          await tx`select public.register_customer_session(
          ${customer.id}::uuid, ${randomUUID()}::uuid,
          now() - interval '1 minute', ${device}, 'recognised_device')`
        })
      } catch (error) {
        rejected = /invalid customer session/i.test(String(error.message))
      }
      assert.ok(rejected, "a session cannot be registered with a past expiry")
    })
  }
)

test(
  "session: phone-only continuity mints on an unknown device without granting device trust",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      // No verified recovery email: exactly the wallet the old gate stranded.
      const [customer] = await tx`
      insert into public.customers (email, created_at, updated_at)
      values (${`sess-${randomUUID()}@test.local`}, now(), now())
      returning id`
      const knownDevice = deviceHash()
      const unknownDevice = deviceHash()

      // An established wallet: one device already trusted the strong way.
      await tx`select public.register_customer_session(
      ${customer.id}::uuid, ${randomUUID()}::uuid, now() + interval '30 days',
      ${knownDevice}, 'new_identity')`

      // A brand-new browser presents no trust at all.
      const [{ customer_auth_device_is_trusted: trustedBefore }] = await tx`
      select public.customer_auth_device_is_trusted(
        ${customer.id}::uuid, ${unknownDevice}
      )`
      assert.equal(trustedBefore, false, "the new device starts untrusted")

      // Phone possession alone is now sufficient to mint there.
      const sessionId = randomUUID()
      await tx`select public.register_customer_session(
      ${customer.id}::uuid, ${sessionId}::uuid, now() + interval '30 days',
      ${unknownDevice}, 'verified_phone')`
      const [{ touch_customer_session: active }] = await tx`
      select public.touch_customer_session(
        ${customer.id}::uuid, ${sessionId}::uuid, ${unknownDevice}
      )`
      assert.equal(active, true, "the phone-only session is live")

      // But it must not count as device trust when the control is restored.
      const [{ customer_auth_device_is_trusted: trustedAfter }] = await tx`
      select public.customer_auth_device_is_trusted(
        ${customer.id}::uuid, ${unknownDevice}
      )`
      assert.equal(
        trustedAfter,
        false,
        "phone possession does not promote a device to trusted"
      )
    })
  }
)

test(
  "session: a copied cookie cannot move to another device or use an unbound overload",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [customer] = await tx`
      insert into public.customers (email, email_verified_at, created_at, updated_at)
      values (${`sess-${randomUUID()}@test.local`}, now(), now(), now())
      returning id`
      const sessionId = randomUUID()
      const originalDevice = deviceHash()
      const attackerDevice = deviceHash()

      await tx`select public.register_customer_session(
      ${customer.id}::uuid, ${sessionId}::uuid, now() + interval '30 days',
      ${originalDevice}, 'new_identity')`

      const [{ touch_customer_session: moved }] = await tx`
      select public.touch_customer_session(
        ${customer.id}::uuid, ${sessionId}::uuid, ${attackerDevice}
      )`
      assert.equal(
        moved,
        false,
        "the session remains bound to its minting device"
      )

      await assert.rejects(
        () =>
          tx.savepoint(
            (sp) => sp`select public.register_customer_session(
          ${customer.id}::uuid,
          ${randomUUID()}::uuid,
          now() + interval '30 days'
        )`
          ),
        /does not exist/i,
        "the legacy unbound registration overload is unavailable"
      )
    })
  }
)

test(
  "session: continuity RPCs are executable only by service_role",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const rows = await tx`
        select
          signature,
          has_function_privilege('public', signature, 'execute') as public_execute,
          has_function_privilege('anon', signature, 'execute') as anon_execute,
          has_function_privilege('authenticated', signature, 'execute') as authenticated_execute,
          has_function_privilege('service_role', signature, 'execute') as service_execute
        from unnest(array[
          'public.customer_auth_device_is_trusted(uuid,text)',
          'public.register_customer_session(uuid,uuid,timestamp with time zone,text,text)',
          'public.touch_customer_session(uuid,uuid,text)',
          'public.touch_customer_session_and_load(uuid,uuid,text)',
          'public.revoke_all_customer_sessions(uuid)'
        ]) as functions(signature)
      `

      assert.equal(rows.length, 5)
      for (const row of rows) {
        assert.equal(row.public_execute, false, `${row.signature}: PUBLIC`)
        assert.equal(row.anon_execute, false, `${row.signature}: anon`)
        assert.equal(
          row.authenticated_execute,
          false,
          `${row.signature}: authenticated`
        )
        assert.equal(
          row.service_execute,
          true,
          `${row.signature}: service_role`
        )
      }
    })
  }
)

test(
  "session: log out on all devices revokes every session for that customer only",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [customer, other] = await tx`
      insert into public.customers (email, email_verified_at, created_at, updated_at)
      values
        (${`sess-${randomUUID()}@test.local`}, now(), now(), now()),
        (${`sess-${randomUUID()}@test.local`}, now(), now(), now())
      returning id`
      const phone = { id: randomUUID(), device: deviceHash() }
      const laptop = { id: randomUUID(), device: deviceHash() }
      const otherSession = { id: randomUUID(), device: deviceHash() }
      for (const session of [phone, laptop]) {
        await tx`select public.register_customer_session(
        ${customer.id}::uuid, ${session.id}::uuid, 'infinity',
        ${session.device}, 'verified_phone')`
      }
      await tx`select public.register_customer_session(
      ${other.id}::uuid, ${otherSession.id}::uuid, 'infinity',
      ${otherSession.device}, 'verified_phone')`

      const [{ revoke_all_customer_sessions: revokedCount }] = await tx`
      select public.revoke_all_customer_sessions(${customer.id}::uuid)`
      assert.equal(revokedCount, 2, "both of the customer's sessions revoke")

      for (const session of [phone, laptop]) {
        const [{ touch_customer_session: active }] = await tx`
        select public.touch_customer_session(
          ${customer.id}::uuid, ${session.id}::uuid, ${session.device}
        )`
        assert.equal(active, false, "a revoked open-ended session is inactive")
      }
      const [{ touch_customer_session: otherActive }] = await tx`
      select public.touch_customer_session(
        ${other.id}::uuid, ${otherSession.id}::uuid, ${otherSession.device}
      )`
      assert.equal(otherActive, true, "another customer's session is untouched")

      // Only the service role may call it; the app passes the id from the
      // caller's own verified session.
      await assert.rejects(
        () =>
          tx.savepoint(async (sp) => {
            await sp`select set_config('request.jwt.claim.role', 'authenticated', true)`
            await sp`select public.revoke_all_customer_sessions(${other.id}::uuid)`
          }),
        /service role required/i
      )
    })
  }
)
