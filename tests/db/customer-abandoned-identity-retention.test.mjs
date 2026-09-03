import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => closeDb())

test(
  "Given an old history-free verified identity When retention runs Then PII is anonymized and sessions are revoked without touching a member",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const suffix = randomUUID().replaceAll("-", "")
      const [abandoned] = await tx`
        insert into public.customers (
          email, phone_hmac, phone_ciphertext, phone_last4, phone_country,
          phone_verified_at, created_at, updated_at
        ) values (
          ${`abandoned-${suffix}@test.local`}, ${suffix.padEnd(64, "0").slice(0, 64)},
          ${`v1.${suffix}`}, '1234', 'GB', now(), '2000-01-01', '2000-01-01'
        ) returning id`
      const [protectedCustomer] = await tx`
        insert into public.customers (
          email, phone_hmac, phone_ciphertext, phone_last4, phone_country,
          phone_verified_at, created_at, updated_at
        ) values (
          ${`protected-${suffix}@test.local`}, ${suffix.padStart(64, "1").slice(0, 64)},
          ${`v1.${suffix}.protected`}, '5678', 'GB', now(), '2000-01-01', '2000-01-01'
        ) returning id`
      const [activeCustomer] = await tx`
        insert into public.customers (
          email, phone_hmac, phone_ciphertext, phone_last4, phone_country,
          phone_verified_at, created_at, updated_at
        ) values (
          ${`active-${suffix}@test.local`}, ${`2${suffix}`.padEnd(64, "2").slice(0, 64)},
          ${`v1.${suffix}.active`}, '9012', 'GB', now(), '2000-01-01', '2000-01-01'
        ) returning id`
      const [merchant] =
        await tx`select id from public.merchants order by created_at limit 1`
      await tx`
        insert into public.customer_memberships (merchant_id, customer_id)
        values (${merchant.id}::uuid, ${protectedCustomer.id}::uuid)`
      await tx`
        insert into public.customer_sessions (
          id, customer_id, created_at, last_seen_at, expires_at, device_hash
        )
        values
          (${randomUUID()}::uuid, ${abandoned.id}::uuid, '2000-01-01', '2000-01-01', now() + interval '30 days', ${"a".repeat(64)}),
          (${randomUUID()}::uuid, ${protectedCustomer.id}::uuid, now(), now(), now() + interval '30 days', ${"b".repeat(64)}),
          (${randomUUID()}::uuid, ${activeCustomer.id}::uuid, now(), now(), now() + interval '30 days', ${"c".repeat(64)})`

      const [purged] = await tx`
        select public.admin_purge_abandoned_customer_identities('2000-01-02') as count`
      assert.equal(purged.count, 1)

      const [abandonedAfter] = await tx`
        select phone_hmac, email, full_name from public.customers
        where id = ${abandoned.id}::uuid`
      assert.equal(abandonedAfter.phone_hmac, null)
      assert.match(abandonedAfter.email, /^erased\+/)

      const [abandonedSession] = await tx`
        select revoked_at from public.customer_sessions
        where customer_id = ${abandoned.id}::uuid`
      assert.ok(abandonedSession.revoked_at)

      const [joinMerchant] = await tx`
        select business_slug from public.merchants order by created_at limit 1`
      await tx`select set_config('test.abandoned_customer_id', ${abandoned.id}::text, true)`
      await tx`select set_config('test.join_merchant_slug', ${joinMerchant.business_slug}, true)`
      await tx`
        do $$
        begin
          begin
            perform public.join_customer_membership(
              current_setting('test.abandoned_customer_id')::uuid,
              current_setting('test.join_merchant_slug'),
              null,
              false,
              'retention-race-regression'
            );
            raise exception 'tombstoned customer unexpectedly joined';
          exception when insufficient_privilege then
            null;
          end;
        end
        $$`
      const [{ abandonedMemberships }] = await tx`
        select count(*)::int as "abandonedMemberships"
        from public.customer_memberships
        where customer_id = ${abandoned.id}::uuid`
      assert.equal(abandonedMemberships, 0)

      const [protectedAfter] = await tx`
        select phone_hmac from public.customers
        where id = ${protectedCustomer.id}::uuid`
      assert.notEqual(protectedAfter.phone_hmac, null)
      const [activeAfter] = await tx`
        select phone_hmac from public.customers
        where id = ${activeCustomer.id}::uuid`
      assert.notEqual(activeAfter.phone_hmac, null)

      const [replayed] = await tx`
        select public.admin_purge_abandoned_customer_identities('2000-01-02') as count`
      assert.equal(replayed.count, 0)
    })
  }
)
