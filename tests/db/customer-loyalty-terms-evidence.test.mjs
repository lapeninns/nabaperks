import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => closeDb())

test(
  "Given marketing is declined When a customer joins Then authoritative terms evidence commits and replays idempotently",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [fixture] = await tx`
        select qr.qr_id, qr.id as qr_code_id, qr.loyalty_card_id,
               merchants.id as merchant_id, merchants.business_slug,
               merchants.business_name, cards.card_name, cards.reward_terms,
               cards.stamps_required
        from public.qr_codes qr
        join public.merchants merchants on merchants.id = qr.merchant_id
        join public.loyalty_cards cards on cards.id = qr.loyalty_card_id
        where qr.is_active and qr.destination_type = 'join'
        order by qr.created_at limit 1`
      assert.ok(fixture)

      const [customer] = await tx`
        insert into public.customers (email, email_verified_at, created_at, updated_at)
        values (${`terms-${randomUUID()}@test.local`}, now(), now(), now())
        returning id`

      const [joined] = await tx`
        select * from public.join_customer_membership(
          ${customer.id}::uuid, ${fixture.business_slug}, ${fixture.qr_id},
          false, '2026-07-15'
        )`
      assert.equal(joined.created_membership, true)

      const [evidence] = await tx`
        select policy_version, terms_snapshot, length(terms_sha256)::int as hash_length
        from public.customer_loyalty_terms_acceptances
        where membership_id = ${joined.membership_id}`
      assert.equal(evidence.policy_version, "2026-07-15")
      assert.equal(evidence.hash_length, 64)
      assert.equal(evidence.terms_snapshot.merchant_name, fixture.business_name)
      assert.equal(evidence.terms_snapshot.card_name, fixture.card_name)
      assert.deepEqual(
        evidence.terms_snapshot.sections.map((section) => section.id),
        [
          "joining",
          "earning-rule",
          "reward",
          "redemption",
          "exclusions",
          "referrals-and-additional-rewards",
          "fraud-and-abuse",
          "availability",
          "merchant-contact",
        ]
      )
      assert.match(
        evidence.terms_snapshot.sections[1].body,
        new RegExp(String(fixture.stamps_required))
      )
      assert.equal(
        evidence.terms_snapshot.sections.at(-1).body,
        "Ask the venue team"
      )

      const [{ marketing_consents: marketingConsents }] = await tx`
        select count(*)::int as marketing_consents
        from public.consent_records
        where customer_id = ${customer.id}::uuid
          and source = 'customer_join'`
      assert.equal(marketingConsents, 0)

      await tx`
        select * from public.join_customer_membership(
          ${customer.id}::uuid, ${fixture.business_slug}, ${fixture.qr_id},
          false, '2026-07-15'
        )`
      await tx`
        select * from public.join_customer_membership(
          ${customer.id}::uuid, ${fixture.business_slug}, ${fixture.qr_id},
          false, '2026-08-01'
        )`
      const [{ versions }] = await tx`
        select count(*)::int as versions
        from public.customer_loyalty_terms_acceptances
        where membership_id = ${joined.membership_id}`
      assert.equal(versions, 2)
    })
  }
)
