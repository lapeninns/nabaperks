import { after, test } from "node:test"
import assert from "node:assert/strict"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import { ensureVerifiedCustomerEmail } from "./helpers/verified-customer-email.mjs"

/**
 * customer redeem + merchant scan pos — live-DB invariant tier.
 *
 * Proves the single-use scan-token invariant end to end: a ready reward mints a
 * token (R-1), the merchant collects it exactly once, and a second collection
 * does not re-consume it (R-4). Manufactures the ready reward
 * inside a rolled-back transaction so nothing persists.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

const PICK = /* sql */ `
  select cm.id as membership_id, cm.customer_id, cm.merchant_id,
         lc.id as loyalty_card_id, lc.stamps_required
  from public.customer_memberships cm
  join public.merchants mer on mer.id = cm.merchant_id
  join public.loyalty_cards lc on lc.merchant_id = cm.merchant_id and lc.is_active
  where mer.status in ('trial', 'active')
    and (
      mer.requires_billing = false
      or exists (
        select 1 from public.billing_customers bc
        where bc.merchant_id = mer.id and bc.status in ('trialing', 'active')
      )
    )
  order by cm.created_at
  limit 1`

test(
  "R-1/R-4: a reward scan token can be collected exactly once",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [m] = await tx.unsafe(PICK)
      assert.ok(m, "a billing-eligible seeded membership exists")

      // Make the reward genuinely redeemable: full card + complete profile.
      await tx`
        update public.customer_memberships
        set current_stamp_count = ${m.stamps_required}
        where id = ${m.membership_id}`
      // Keep the customer's existing contact (a null email would violate
      // customers_contact_present); satisfy the profile gate by marking the
      // email verified so the "email present but unverified" clause is false.
      await tx`
        update public.customers
        set full_name = 'E2E Tester', date_of_birth = '1990-01-01'
        where id = ${m.customer_id}`
      await ensureVerifiedCustomerEmail(tx, m.customer_id)

      const [reward] = await tx`
        insert into public.reward_events (
          merchant_id, customer_id, membership_id, loyalty_card_id,
          status, reward_name, reward_terms, metadata, created_at, updated_at)
        values (
          ${m.merchant_id}, ${m.customer_id}, ${m.membership_id}, ${m.loyalty_card_id},
          'unlocked', 'E2E test reward', 'E2E test terms', '{}'::jsonb, now(), now())
        returning id`
      assert.ok(reward?.id, "manufactured an unlocked reward event")

      // R-1: minting yields a live, unconsumed token.
      const [minted] = await tx`
        select * from public.create_reward_scan_token(
          ${reward.id}::uuid, ${m.customer_id}::uuid)`
      const token = minted?.scan_token
      assert.ok(token, "a scan token is minted")

      const [fresh] = await tx`
        select consumed_at, expires_at from public.reward_scan_tokens where id = ${token}`
      assert.equal(
        fresh.consumed_at,
        null,
        "freshly minted token is unconsumed"
      )
      assert.ok(
        new Date(fresh.expires_at).getTime() > Date.now(),
        "token expires in the future"
      )

      // A refresh in the final five minutes mints a replacement and retires the
      // old capability instead of leaving two usable collection forms.
      await tx`
        update public.reward_scan_tokens
        set expires_at = now() + interval '4 minutes'
        where id = ${token}::uuid`
      const [replacement] = await tx`
        select * from public.create_reward_scan_token(
          ${reward.id}::uuid, ${m.customer_id}::uuid)`
      assert.notEqual(replacement.scan_token, token)
      const [retired] = await tx`
        select consumed_at, superseded_at
        from public.reward_scan_tokens
        where id = ${token}`
      assert.equal(retired.consumed_at, null, "replacement is not a collection")
      assert.notEqual(
        retired.superseded_at,
        null,
        "replacement retires old token"
      )
      const [oldContext] = await tx`
        select * from public.get_reward_scan_context(
          ${token}::uuid, ${m.merchant_id}::uuid)`
      assert.equal(oldContext.scan_status, "expired")
      const [replacementContext] = await tx`
        select * from public.get_reward_scan_context(
          ${replacement.scan_token}::uuid, ${m.merchant_id}::uuid)`
      assert.equal(replacementContext.scan_status, "ready")
      const [{ liveTokens }] = await tx`
        select count(*)::int as "liveTokens"
        from public.reward_scan_tokens
        where reward_event_id = ${reward.id}::uuid
          and consumed_at is null
          and superseded_at is null`
      assert.equal(
        liveTokens,
        1,
        "exactly one collection capability stays live"
      )

      const [stableRefresh] = await tx`
        select * from public.create_reward_scan_token(
          ${reward.id}::uuid, ${m.customer_id}::uuid)`
      assert.equal(
        stableRefresh.scan_token,
        replacement.scan_token,
        "a sufficiently fresh token is reused"
      )

      for (const collector of [
        "collect_current_reward_scan_token",
        "collect_reward_scan_token",
      ]) {
        await assert.rejects(
          () =>
            tx.savepoint((sp) =>
              sp.unsafe(
                `select * from public.${collector}($1::uuid, $2::uuid)`,
                [token, m.merchant_id]
              )
            ),
          /superseded|expired|not found/i,
          `${collector} rejects the superseded form`
        )
      }
      const activeToken = replacement.scan_token

      const [beforeNullMerchant] = await tx`
        select consumed_at, consumed_by_merchant_id
        from public.reward_scan_tokens
        where id = ${activeToken}::uuid`
      for (const collector of [
        "collect_current_reward_scan_token",
        "collect_reward_scan_token",
      ]) {
        await assert.rejects(
          () =>
            tx.savepoint((sp) =>
              sp.unsafe(`select * from public.${collector}($1::uuid, null)`, [
                activeToken,
              ])
            ),
          /different merchant/i,
          `${collector} rejects an absent merchant identity`
        )
      }
      const [afterNullMerchant] = await tx`
        select consumed_at, consumed_by_merchant_id
        from public.reward_scan_tokens
        where id = ${activeToken}::uuid`
      assert.deepEqual(afterNullMerchant, beforeNullMerchant)

      // The merchant collects the token once, leaving it consumed and redeemed.
      await tx`
        select * from public.collect_current_reward_scan_token(
          ${activeToken}::uuid, ${m.merchant_id}::uuid)`
      const [afterFirst] = await tx`
        select consumed_at from public.reward_scan_tokens where id = ${activeToken}`
      assert.notEqual(
        afterFirst.consumed_at,
        null,
        "token consumed after first collect"
      )
      const [rewardAfter] = await tx`
        select status from public.reward_events where id = ${reward.id}`
      assert.equal(
        rewardAfter.status,
        "redeemed",
        "reward is redeemed after collection"
      )
      const [oldContextAfterCollection] = await tx`
        select * from public.get_reward_scan_context(
          ${token}::uuid, ${m.merchant_id}::uuid)`
      assert.ok(
        ["expired", "not_found"].includes(
          oldContextAfterCollection.scan_status
        ),
        "a superseded form is either retained as expired or purged; it never inherits another token's success"
      )
      const [activeContextAfterCollection] = await tx`
        select * from public.get_reward_scan_context(
          ${activeToken}::uuid, ${m.merchant_id}::uuid)`
      assert.equal(activeContextAfterCollection.scan_status, "redeemed")

      await assert.rejects(
        () =>
          tx.savepoint(
            (sp) => sp`
            select * from public.redeem_self_service_reward(
              ${reward.id}::uuid, ${m.customer_id}::uuid, null, null)`
          ),
        /already collected by merchant/i,
        "self-service cannot claim success after merchant collection"
      )

      // R-4: a second collection must not re-consume the token.
      let secondRejected = false
      try {
        await tx.savepoint(async (sp) => {
          await sp`
            select * from public.collect_current_reward_scan_token(
              ${activeToken}::uuid, ${m.merchant_id}::uuid)`
        })
      } catch {
        secondRejected = true
      }
      const [afterSecond] = await tx`
        select consumed_at from public.reward_scan_tokens where id = ${activeToken}`
      assert.ok(
        secondRejected ||
          afterSecond.consumed_at?.getTime?.() ===
            afterFirst.consumed_at?.getTime?.(),
        "second collection does not re-consume the token (single-use)"
      )
    })
  }
)

test(
  "a stale token cannot report success after another path redeemed the reward",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [m] = await tx.unsafe(PICK)
      await tx`
        update public.customer_memberships
        set current_stamp_count = ${m.stamps_required}
        where id = ${m.membership_id}`
      await tx`
        update public.customers
        set full_name = 'E2E Tester', date_of_birth = '1990-01-01'
        where id = ${m.customer_id}`
      await ensureVerifiedCustomerEmail(tx, m.customer_id)

      const [reward] = await tx`
        insert into public.reward_events (
          merchant_id, customer_id, membership_id, loyalty_card_id,
          status, reward_name, reward_terms, metadata, created_at, updated_at)
        values (
          ${m.merchant_id}, ${m.customer_id}, ${m.membership_id}, ${m.loyalty_card_id},
          'unlocked', 'Stale form reward', 'Stale form reward terms', '{}'::jsonb,
          now(), now())
        returning id`
      const [minted] = await tx`
        select * from public.create_reward_scan_token(
          ${reward.id}::uuid, ${m.customer_id}::uuid)`

      await tx`
        select * from public.redeem_self_service_reward(
          ${reward.id}::uuid, ${m.customer_id}::uuid, null, null)`

      const [beforeRejectedCollections] = await tx`
        select consumed_at, consumed_by_merchant_id
        from public.reward_scan_tokens
        where id = ${minted.scan_token}::uuid`

      for (const collector of [
        "collect_current_reward_scan_token",
        "collect_reward_scan_token",
      ]) {
        await assert.rejects(
          () =>
            tx.savepoint((sp) =>
              sp.unsafe(
                `select * from public.${collector}($1::uuid, $2::uuid)`,
                [minted.scan_token, m.merchant_id]
              )
            ),
          /already collected/i,
          `${collector} cannot claim a self-service redemption`
        )
      }

      const [afterRejectedCollections] = await tx`
        select consumed_at, consumed_by_merchant_id
        from public.reward_scan_tokens
        where id = ${minted.scan_token}::uuid`
      assert.deepEqual(
        afterRejectedCollections,
        beforeRejectedCollections,
        "rejected collectors leave the token's consumption evidence unchanged"
      )
      const [staleContext] = await tx`
        select * from public.get_reward_scan_context(
          ${minted.scan_token}::uuid, ${m.merchant_id}::uuid)`
      assert.equal(
        staleContext.scan_status,
        "blocked",
        "an unconsumed token never reports another path's redemption as its own"
      )
    })
  }
)
