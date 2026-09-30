import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * The 365-day stale-PII purge (`admin_purge_stale_customer_pii`) must not
 * anonymise a customer who is using the app (QA BUG-059).
 *
 * Signing in, opening /home or viewing a card moves only
 * `customer_sessions.last_seen_at`; no customer, membership, stamp or reward
 * timestamp changes. The purge used to read only those, so a customer signed
 * in today whose last stamp was over a year old was anonymised, signed out
 * and left without their card. It now skips a customer with a live session
 * (not revoked, not expired) used since the cutoff, the rule the abandoned
 * identity purge already applies. A customer without such a session is still
 * purged as before.
 *
 * Fixtures are dated 2000-01-01 and the cutoff is 2000-06-01, so the global
 * purge only reaches rows made here; everything is rolled back.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => closeDb())

const OLD = "2000-01-01"
const CUTOFF = "2000-06-01"

const hex64 = () => (randomUUID() + randomUUID()).replaceAll("-", "")

async function staleMember(tx, label) {
  const [customer] = await tx`
    insert into public.customers (
      email, email_hmac, email_verified_at, full_name,
      phone_hmac, phone_ciphertext, phone_last4, phone_country, phone_verified_at,
      created_at, updated_at
    ) values (
      ${`stale-${label}-${randomUUID()}@test.local`}, ${hex64()}, ${OLD}, 'Stale Member',
      ${hex64()}, ${`v1.${randomUUID()}`}, '4321', 'GB', ${OLD},
      ${OLD}, ${OLD}
    ) returning id::text as id`
  const [merchant] =
    await tx`select id from public.merchants order by created_at limit 1`
  await tx`
    insert into public.customer_memberships (
      merchant_id, customer_id, current_stamp_count, total_stamps_earned,
      last_visit_at, created_at, updated_at
    ) values (
      ${merchant.id}::uuid, ${customer.id}::uuid, 2, 2, ${OLD}, ${OLD}, ${OLD}
    )`
  // Direct inserts and the membership write can move updated_at; put the
  // loyalty history back to its old date with triggers bypassed.
  await tx`set local session_replication_role = replica`
  await tx`update public.customers set updated_at = ${OLD} where id = ${customer.id}::uuid`
  await tx`
    update public.customer_memberships set updated_at = ${OLD}
    where customer_id = ${customer.id}::uuid`
  await tx`set local session_replication_role = origin`
  return customer.id
}

/**
 * lastSeen and expires are timestamps; "now" means the database clock.
 * expiresInDays is relative to now (negative for an expired session).
 */
async function addSession(
  tx,
  customerId,
  { lastSeen, expiresInDays = 30, revoked = false }
) {
  const seenNow = lastSeen === "now"
  await tx`
    insert into public.customer_sessions (
      id, customer_id, created_at, last_seen_at, expires_at, revoked_at, device_hash
    ) values (
      ${randomUUID()}::uuid, ${customerId}::uuid, ${OLD},
      case when ${seenNow} then now() else ${seenNow ? OLD : lastSeen}::timestamptz end,
      now() + make_interval(days => ${expiresInDays}),
      case when ${revoked} then now() end,
      ${hex64()}
    )`
}

async function state(tx, customerId) {
  const [row] = await tx`
    select email like 'erased+%@privacy.invalid' as erased,
           phone_hmac is not null as has_phone,
           full_name is not null as has_name,
           (select count(*)::int from public.customer_sessions s
             where s.customer_id = customers.id and s.revoked_at is null) as live_sessions,
           (select count(*)::int from public.customer_memberships m
             where m.customer_id = customers.id) as memberships
    from public.customers where id = ${customerId}::uuid`
  return row
}

test(
  "Given a stale member signed in and using the app When the stale purge runs Then they keep their wallet and session",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const active = await staleMember(tx, "active")
      await addSession(tx, active, { lastSeen: "now" })

      const [purged] = await tx`
        select public.admin_purge_stale_customer_pii(${CUTOFF}) as count`

      assert.equal(purged.count, 0)
      assert.deepEqual(await state(tx, active), {
        erased: false,
        has_phone: true,
        has_name: true,
        live_sessions: 1,
        memberships: 1,
      })
    })
  }
)

test(
  "Given stale members without a live session used since the cutoff When the stale purge runs Then each is still anonymised and signed out",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      // No session at all.
      const idle = await staleMember(tx, "idle")
      // A live session, but last used before the cutoff.
      const oldSession = await staleMember(tx, "old-session")
      await addSession(tx, oldSession, { lastSeen: OLD })
      // Used recently, but revoked (signed out).
      const revoked = await staleMember(tx, "revoked")
      await addSession(tx, revoked, { lastSeen: "now", revoked: true })
      // Used after the cutoff, but already expired.
      const expired = await staleMember(tx, "expired")
      await addSession(tx, expired, {
        lastSeen: "2000-07-01",
        expiresInDays: -1,
      })

      const [purged] = await tx`
        select public.admin_purge_stale_customer_pii(${CUTOFF}) as count`

      assert.equal(purged.count, 4)
      for (const customerId of [idle, oldSession, revoked, expired]) {
        assert.deepEqual(await state(tx, customerId), {
          erased: true,
          has_phone: false,
          has_name: false,
          live_sessions: 0,
          // The loyalty ledger stays on the anonymised row.
          memberships: 1,
        })
      }
    })
  }
)

test(
  "Given the stale purge When it is redefined Then it keeps its service-role guard and grants",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [definition] = await tx`
        select p.prosecdef as security_definer,
               p.proconfig as config,
               has_function_privilege('anon', p.oid, 'execute') as anon_exec,
               has_function_privilege('authenticated', p.oid, 'execute') as auth_exec,
               has_function_privilege('service_role', p.oid, 'execute') as service_exec
        from pg_proc p
        where p.oid = 'public.admin_purge_stale_customer_pii(timestamp with time zone)'::regprocedure`
      assert.equal(definition.security_definer, true)
      assert.deepEqual(definition.config, ["search_path=public"])
      assert.equal(definition.anon_exec, false)
      assert.equal(definition.auth_exec, false)
      assert.equal(definition.service_exec, true)

      await tx`select set_config('request.jwt.claim.role', 'authenticated', true)`
      await assert.rejects(
        tx`select public.admin_purge_stale_customer_pii(${CUTOFF})`,
        /requires the service role/
      )
    })
  }
)
