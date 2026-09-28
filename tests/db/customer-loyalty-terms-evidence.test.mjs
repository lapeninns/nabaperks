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
          false, '2026-07-19'
        )`
      assert.equal(joined.created_membership, true)

      const [evidence] = await tx`
        select policy_version, terms_snapshot, length(terms_sha256)::int as hash_length
        from public.customer_loyalty_terms_acceptances
        where membership_id = ${joined.membership_id}`
      assert.equal(evidence.policy_version, "2026-07-19")
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
          false, '2026-07-19'
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

test(
  "Given the 2026-09-26 venue terms are submitted When a customer joins Then the immutable database snapshot matches the displayed policy inputs",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [fixture] = await tx`
        select qr.qr_id, cards.id as card_id, cards.location_id,
               merchants.id as merchant_id, merchants.business_slug,
               merchants.business_name, merchants.email, merchants.phone,
               cards.card_name, cards.reward_terms, cards.stamps_required
        from public.qr_codes qr
        join public.merchants merchants on merchants.id = qr.merchant_id
        join public.loyalty_cards cards on cards.id = qr.loyalty_card_id
        where qr.is_active and qr.destination_type = 'join'
          and exists (
            select 1 from public.reward_pool_items items
            where items.loyalty_card_id = cards.id and items.is_active
          )
        order by qr.created_at limit 1`
      assert.ok(fixture)

      await tx`
        update public.loyalty_cards
        set stamps_required = 4,
            reward_expires_after_days = 56,
            minimum_spend_pence = 725,
            one_transaction_per_stamp = true
        where id = ${fixture.card_id}::uuid`
      await tx`
        update public.merchant_locations
        set trading_day_starts_at = time '05:00'
        where id = ${fixture.location_id}::uuid`
      const [upgrade] = await tx`
        select id, reward_name, reward_terms, requires_age_check
        from public.reward_pool_items
        where loyalty_card_id = ${fixture.card_id}::uuid and is_active
        order by display_order, created_at, id limit 1`
      await tx`
        delete from public.venue_collection_windows
        where location_id = ${fixture.location_id}::uuid`
      await tx`
        insert into public.venue_collection_windows (
          merchant_id, location_id, isodow, starts_at, ends_at,
          upgrade_pool_item_id, is_active
        ) values (
          ${fixture.merchant_id}::uuid, ${fixture.location_id}::uuid,
          2, time '14:00', time '16:30', ${upgrade.id}::uuid, true
        )`

      const [customer] = await tx`
        insert into public.customers (email, email_verified_at, created_at, updated_at)
        values (${`terms-v20260926-${randomUUID()}@test.local`}, now(), now(), now())
        returning id`
      const [joined] = await tx`
        select * from public.join_customer_membership(
          ${customer.id}::uuid, ${fixture.business_slug}, ${fixture.qr_id},
          false, '2026-09-26'
        )`

      const [evidence] = await tx`
        select policy_version, terms_snapshot,
               terms_sha256 = encode(
                 extensions.digest(terms_snapshot::text, 'sha256'), 'hex'
               ) as hash_matches
        from public.customer_loyalty_terms_acceptances
        where membership_id = ${joined.membership_id}::uuid
          and policy_version = '2026-09-26'`
      assert.equal(evidence.policy_version, "2026-09-26")
      assert.equal(evidence.hash_matches, true)
      assert.equal(evidence.terms_snapshot.merchant_name, fixture.business_name)
      assert.equal(evidence.terms_snapshot.card_name, fixture.card_name)

      const poolRows = await tx`
        select id, reward_name, reward_terms, requires_age_check
        from public.reward_pool_items
        where loyalty_card_id = ${fixture.card_id}::uuid and is_active
        order by display_order, created_at, id`
      const poolBody = poolRows
        .map(
          (item) =>
            `${item.reward_name}: ${item.reward_terms || "No additional exclusions configured."}${item.requires_age_check ? " Photo ID needed (18+)." : ""}`
        )
        .join("\n")
      const windowBody = `Tuesday 14:00–16:30 Europe/London. Upgrade: ${upgrade.reward_name}. ${upgrade.reward_terms}${upgrade.requires_age_check ? " Photo ID needed (18+)." : ""}`
      const contactBody =
        [fixture.email, fixture.phone].filter(Boolean).join(" · ") ||
        "Ask the venue team"

      assert.deepEqual(evidence.terms_snapshot.sections, [
        {
          id: "joining",
          title: "Joining the card",
          body: "Join by verifying your mobile phone number and accepting these venue terms and the Nabaperks customer terms after being shown the privacy notice. Marketing is optional and is not required to keep the card, collect stamps, or redeem an eligible reward.",
        },
        {
          id: "earning-rule",
          title: "Earning rule",
          body: "Collect 4 normal visit stamps using a valid venue QR. One stamp per visit, one transaction per stamp. Minimum spend £7.25. These are the venue’s earning terms; Nabaperks does not check spend or transaction totals. Only one normal visit stamp can be earned for this venue location on each venue trading day, using the venue’s Europe/London daily reset. The daily reset is 05:00 Europe/London time. A valid QR join normally attempts to add the first eligible stamp.",
        },
        {
          id: "reward",
          title: "Reward selection",
          body: "When you earn the final stamp, your first completed cycle receives the venue's first active configured reward. Later completed cycles use the venue's configured reward weightings. The final stamp issues the reward and immediately opens a fresh card; an uncollected reward does not lock earning. The assigned reward, earning terms and age-check policy are fixed when it is issued. Existing issued rewards retain their recorded terms.",
        },
        {
          id: "redemption",
          title: "Redemption",
          body: "Cycle rewards are collectable from the next venue trading day, including weekends when the venue trades. One standard reward can be collected per venue trading day. A configured collection window may offer a displayed bonus or upgrade; eligibility and the collection deadline are shown on the reward. Cycle rewards use the expiry configured when issued; use the displayed expiry for each reward. Provide your full name and date of birth and be at least 18. A verified email address is required before reward collection. Photo ID is required only for rewards marked as age checked. Show the reward QR for the venue team to scan. New cycle rewards expire after 56 days.",
        },
        {
          id: "reward-pool",
          title: "Current reward pool",
          body: poolBody,
          items: [...poolRows],
        },
        {
          id: "collection-windows",
          title: "Collection windows",
          body: windowBody,
        },
        {
          id: "exclusions",
          title: "Exclusions",
          body: fixture.reward_terms,
        },
        {
          id: "referrals-and-additional-rewards",
          title: "Referrals and additional rewards",
          body: "Where referrals are available, a referral qualifies only after a genuinely new member receives a normal venue visit stamp. A qualifying referral can add one bonus stamp to the referrer's card, subject to a limit of two referral bonus stamps on one Europe/London date and availability, capacity, and fraud checks. The venue may also issue birthday or direct rewards with their own displayed terms and expiry.",
        },
        {
          id: "fraud-and-abuse",
          title: "Location, fraud, and corrections",
          body: "The venue may enable a soft location check. Refusing location, receiving an inaccurate result, or encountering a timeout does not by itself stop the stamp. Nabaperks and the venue may review QR misuse, duplicate claims, unusual stamp speed, out-of-range location evidence, manual adjustments, or concentrated referral activity. Audited support actions may correct the ledger.",
        },
        {
          id: "availability",
          title: "Availability",
          body: "New joins, stamps and reward issue may pause when the venue, card, QR or subscription is inactive. Rewards issued before suspension remain collectable for a 30-day grace period from suspension, with their deadline extended to the end of that period; collection rules still apply. Check the reward for its current availability.",
        },
        {
          id: "merchant-contact",
          title: "Merchant contact",
          body: contactBody,
        },
      ])
    })
  }
)

test(
  "Given the 2026-09-28 terms When an email-only customer joins Then the snapshot describes phone or email verification and changes nothing else",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [fixture] = await tx`
        select qr.qr_id, merchants.business_slug
        from public.qr_codes qr
        join public.merchants merchants on merchants.id = qr.merchant_id
        where qr.is_active and qr.destination_type = 'join'
        order by qr.created_at limit 1`
      assert.ok(fixture)

      const joinAs = async (policyVersion) => {
        const email = `terms-v${policyVersion.replaceAll("-", "")}-${randomUUID()}@test.local`
        const [customer] = await tx`
          insert into public.customers (
            email, email_hmac, email_verified_at, created_at, updated_at
          )
          values (
            ${email}, encode(extensions.digest(${email}, 'sha256'), 'hex'),
            now(), now(), now()
          )
          returning id, phone_hmac`
        assert.equal(customer.phone_hmac, null)
        const [joined] = await tx`
          select * from public.join_customer_membership(
            ${customer.id}::uuid, ${fixture.business_slug}, ${fixture.qr_id},
            false, ${policyVersion}
          )`
        assert.equal(joined.created_membership, true)
        const [evidence] = await tx`
          select policy_version, terms_snapshot,
                 terms_sha256 = encode(
                   extensions.digest(terms_snapshot::text, 'sha256'), 'hex'
                 ) as hash_matches
          from public.customer_loyalty_terms_acceptances
          where membership_id = ${joined.membership_id}::uuid`
        assert.equal(evidence.policy_version, policyVersion)
        assert.equal(evidence.hash_matches, true)
        return evidence.terms_snapshot
      }

      const previous = await joinAs("2026-09-26")
      const current = await joinAs("2026-09-28")

      const joining = current.sections.find(
        (section) => section.id === "joining"
      )
      assert.deepEqual(joining, {
        id: "joining",
        title: "Joining the card",
        body: "Join by verifying your mobile phone number or, where offered, your email address with a one-time code, and accepting these venue terms and the Nabaperks customer terms after being shown the privacy notice. Marketing is optional and is not required to keep the card, collect stamps, or redeem an eligible reward.",
      })
      assert.match(
        current.sections.find((section) => section.id === "redemption").body,
        /A verified email address is required before reward collection\./
      )

      // Only the joining section differs from the corrected 2026-09-26 snapshot.
      assert.deepEqual(
        current.sections.filter((section) => section.id !== "joining"),
        previous.sections.filter((section) => section.id !== "joining")
      )
      assert.equal(current.merchant_name, previous.merchant_name)
      assert.equal(current.card_name, previous.card_name)
      assert.notDeepEqual(
        previous.sections.find((section) => section.id === "joining"),
        joining
      )
      const revised = await joinAs("2026-09-28.1")
      assert.match(
        revised.sections.find((section) => section.id === "redemption").body,
        /A verified email address and verified mobile phone number are required before reward collection/
      )
      assert.deepEqual(
        revised.sections.filter((section) => section.id !== "redemption"),
        current.sections.filter((section) => section.id !== "redemption")
      )
    })
  }
)

test(
  "Given a terms version with no snapshot trigger When a customer joins Then the join is refused and nothing is recorded",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [fixture] = await tx`
        select qr.qr_id, merchants.business_slug
        from public.qr_codes qr
        join public.merchants merchants on merchants.id = qr.merchant_id
        where qr.is_active and qr.destination_type = 'join'
        order by qr.created_at limit 1`
      assert.ok(fixture)

      const [customer] = await tx`
        insert into public.customers (email, email_verified_at, created_at, updated_at)
        values (${`terms-unknown-${randomUUID()}@test.local`}, now(), now(), now())
        returning id`

      // A build that sends a newer version than the database knows must fail
      // loudly instead of storing the join function's built-in snapshot.
      await assert.rejects(
        () =>
          tx.savepoint(
            (sp) => sp`
              select * from public.join_customer_membership(
                ${customer.id}::uuid, ${fixture.business_slug}, ${fixture.qr_id},
                false, '2099-01-01'
              )`
          ),
        (error) => {
          assert.equal(error.code, "55000")
          assert.match(
            error.message,
            /No venue terms snapshot is defined for policy version 2099-01-01/
          )
          return true
        }
      )
      const [{ memberships, acceptances }] = await tx`
        select
          (select count(*)::int from public.customer_memberships
            where customer_id = ${customer.id}::uuid) as memberships,
          (select count(*)::int from public.customer_loyalty_terms_acceptances
            where customer_id = ${customer.id}::uuid) as acceptances`
      await assert.rejects(
        () =>
          tx.savepoint(
            (sp) => sp`
        select * from public.join_customer_membership(
          ${customer.id}::uuid, ${fixture.business_slug}, ${fixture.qr_id},
          false, '2026-09-28.99'
        )`
          ),
        (error) => error.code === "55000"
      )
      const [afterUnknownRevision] = await tx`
        select
          (select count(*)::int from public.customer_memberships
            where customer_id = ${customer.id}::uuid) as memberships,
          (select count(*)::int from public.customer_loyalty_terms_acceptances
            where customer_id = ${customer.id}::uuid) as acceptances`
      assert.equal(memberships, 0)
      assert.equal(acceptances, 0)
      assert.deepEqual(afterUnknownRevision, { memberships: 0, acceptances: 0 })

      // Versions with a snapshot trigger and versions before 2026-09-26 are
      // unaffected.
      for (const version of [
        "2026-09-28.1",
        "2026-09-28",
        "2026-09-26",
        "2026-06-06",
      ]) {
        const [other] = await tx`
          insert into public.customers (email, email_verified_at, created_at, updated_at)
          values (${`terms-known-${randomUUID()}@test.local`}, now(), now(), now())
          returning id`
        const [joined] = await tx`
          select * from public.join_customer_membership(
            ${other.id}::uuid, ${fixture.business_slug}, ${fixture.qr_id},
            false, ${version}
          )`
        assert.equal(joined.created_membership, true, version)
      }
    })
  }
)
