import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * MS-customer-home / MS-customer-auth-wallet (profile) — live-DB tier.
 *
 * Profile invariants were previously grep-only. This executes two DB-enforced
 * rules the app depends on:
 *   1. a VERIFIED email/phone is immutable — the
 *      `prevent_verified_customer_contact_change` trigger blocks any change
 *      unless the `app.customer_erasure` GUC is set (the erasure bypass);
 *   2. the redemption PROFILE GATE — a reward cannot be collected until the
 *      customer has full_name + date_of_birth (and a verified email if present),
 *      enforced inside `create_reward_scan_token`.
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
    and (mer.requires_billing = false
         or exists (select 1 from public.billing_customers bc
                    where bc.merchant_id = mer.id and bc.status in ('trial', 'active')))
  order by cm.created_at
  limit 1`

test(
  "profile: a verified email/phone is immutable except under the erasure GUC",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [customer] = await tx`
        insert into public.customers
          (email, email_verified_at, phone_last4, phone_verified_at, created_at, updated_at)
        values (${`lock-${randomUUID()}@test.local`}, now(), '7777', now(), now(), now())
        returning id`

      // Changing a verified email is blocked.
      let emailBlocked = false
      try {
        await tx.savepoint(async (sp) => {
          await sp`update public.customers set email = ${`new-${randomUUID()}@test.local`}
                   where id = ${customer.id}`
        })
      } catch (error) {
        emailBlocked = /verified customer email cannot be changed/i.test(String(error.message))
      }
      assert.ok(emailBlocked, "a verified email cannot be changed via a profile update")

      // Changing verified phone fields is blocked.
      let phoneBlocked = false
      try {
        await tx.savepoint(async (sp) => {
          await sp`update public.customers set phone_last4 = '0000' where id = ${customer.id}`
        })
      } catch (error) {
        phoneBlocked = /verified customer phone cannot be changed/i.test(String(error.message))
      }
      assert.ok(phoneBlocked, "verified phone fields cannot be changed via a profile update")

      // The erasure GUC is the single sanctioned bypass.
      await tx`select set_config('app.customer_erasure', 'true', true)`
      await tx`update public.customers set email = 'erased+test@privacy.invalid'
               where id = ${customer.id}`
      await tx`select set_config('app.customer_erasure', 'false', true)`
      const [after] = await tx`select email from public.customers where id = ${customer.id}`
      assert.equal(
        after.email,
        "erased+test@privacy.invalid",
        "the erasure GUC bypasses the immutability trigger"
      )
    })
  }
)

test(
  "profile gate: a reward cannot be collected until name + DOB are set",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [m] = await tx.unsafe(PICK)
      assert.ok(m, "a billing-eligible seeded membership exists")

      // Manufacture a ready reward (this test isolates the profile gate, not the
      // earning of the reward — the lifecycle test covers earning).
      await tx`update public.customer_memberships
               set current_stamp_count = ${m.stamps_required} where id = ${m.membership_id}`
      // Start with an INCOMPLETE profile: clear name + DOB, keep verified email.
      await tx`update public.customers
               set full_name = null, date_of_birth = null, email_verified_at = now()
               where id = ${m.customer_id}`
      const [reward] = await tx`
        insert into public.reward_events
          (merchant_id, customer_id, membership_id, loyalty_card_id, status,
           reward_name, reward_terms, redeemable_from, metadata, created_at, updated_at)
        values (${m.merchant_id}, ${m.customer_id}, ${m.membership_id}, ${m.loyalty_card_id},
                'unlocked', 'Profile-gate reward', 'terms',
                (now() at time zone 'Europe/London')::date, '{}'::jsonb, now(), now())
        returning id`

      // Incomplete profile → minting a scan token is refused.
      let gated = false
      try {
        await tx.savepoint(async (sp) => {
          await sp`select public.create_reward_scan_token(${reward.id}::uuid, ${m.customer_id}::uuid)`
        })
      } catch (error) {
        gated = /complete your profile/i.test(String(error.message))
      }
      assert.ok(gated, "an incomplete profile blocks reward collection")

      // Completing the profile opens collection.
      await tx`update public.customers
               set full_name = 'Now Complete', date_of_birth = '1991-03-03'
               where id = ${m.customer_id}`
      const [minted] = await tx`
        select scan_token from public.create_reward_scan_token(
          ${reward.id}::uuid, ${m.customer_id}::uuid)`
      assert.ok(minted?.scan_token, "a complete profile can mint a collection token")
    })
  }
)
