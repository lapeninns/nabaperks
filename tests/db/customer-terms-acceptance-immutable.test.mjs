import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { actAsActivatedInternalAdmin } from "./helpers/admin-auth.mjs"
import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

// QA BUG-038 (38c42a1..2c45031): the customer terms promise "an immutable copy
// of the venue terms accepted". Accepted terms rows could be rewritten (with a
// matching hash) or deleted by any service-role caller. They are now
// refused unless the customer-erasure flag is set, the delete or qr_code_id
// clearing is the foreign-key cascade from a removed parent row, or verified
// wallet linking moves or de-duplicates them (content never changes).

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => closeDb())

const ADMIN_UID = "00000000-0000-0000-0000-000000000001"
const POLICY = "2026-09-28.1"

async function joinedAcceptance(tx) {
  const [card] = await tx`
    select qr.id, qr.qr_id, merchants.id as merchant_id, merchants.business_slug
    from public.qr_codes qr
    join public.merchants merchants on merchants.id = qr.merchant_id
    where qr.is_active and qr.destination_type = 'join'
    order by qr.created_at limit 1`
  assert.ok(card)
  const [customer] = await tx`
    insert into public.customers (email, email_verified_at, created_at, updated_at)
    values (${`terms-immutable-${randomUUID()}@test.local`}, now(), now(), now())
    returning id`
  const [joined] = await tx`
    select * from public.join_customer_membership(
      ${customer.id}::uuid, ${card.business_slug}, ${card.qr_id}, false, ${POLICY})`
  const [acceptance] = await tx`
    select id, qr_code_id
    from public.customer_loyalty_terms_acceptances
    where membership_id = ${joined.membership_id}::uuid`
  assert.ok(acceptance)
  assert.equal(acceptance.qr_code_id, card.id)
  return {
    acceptanceId: acceptance.id,
    customerId: customer.id,
    membershipId: joined.membership_id,
    merchantId: card.merchant_id,
    qrCodeId: card.id,
  }
}

async function refused(tx, run) {
  await assert.rejects(
    () => tx.savepoint(run),
    (error) => {
      assert.equal(error.code, "42501")
      assert.match(error.message, /Accepted venue terms are immutable/)
      return true
    }
  )
}

async function acceptanceCount(tx, id) {
  const [row] = await tx`
    select count(*)::int as n
    from public.customer_loyalty_terms_acceptances where id = ${id}::uuid`
  return row.n
}

test(
  "Given an accepted terms row When the service role rewrites or deletes it Then the database refuses",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const { acceptanceId } = await joinedAcceptance(tx)
      const [before] = await tx`
        select terms_snapshot, terms_sha256, policy_version, accepted_at
        from public.customer_loyalty_terms_acceptances
        where id = ${acceptanceId}::uuid`

      await refused(
        tx,
        (sp) => sp`
          update public.customer_loyalty_terms_acceptances
          set terms_snapshot = '{"tampered": true}'::jsonb,
              terms_sha256 = repeat('0', 64)
          where id = ${acceptanceId}::uuid`
      )
      await refused(
        tx,
        (sp) => sp`
          update public.customer_loyalty_terms_acceptances
          set accepted_at = '2020-01-01T00:00:00Z', policy_version = '2020-01-01'
          where id = ${acceptanceId}::uuid`
      )
      // A no-op update is still a write to accepted evidence.
      await refused(
        tx,
        (sp) => sp`
          update public.customer_loyalty_terms_acceptances
          set qr_code_id = qr_code_id
          where id = ${acceptanceId}::uuid`
      )
      await refused(
        tx,
        (sp) => sp`
          delete from public.customer_loyalty_terms_acceptances
          where id = ${acceptanceId}::uuid`
      )

      // The same holds for the service_role database role itself.
      await refused(tx, async (sp) => {
        await sp`set local role service_role`
        await sp`
          update public.customer_loyalty_terms_acceptances
          set terms_sha256 = repeat('0', 64)
          where id = ${acceptanceId}::uuid`
      })
      await refused(tx, async (sp) => {
        await sp`set local role service_role`
        await sp`
          delete from public.customer_loyalty_terms_acceptances
          where id = ${acceptanceId}::uuid`
      })

      const [afterwards] = await tx`
        select terms_snapshot, terms_sha256, policy_version, accepted_at
        from public.customer_loyalty_terms_acceptances
        where id = ${acceptanceId}::uuid`
      assert.deepEqual(afterwards, before)
    })
  }
)

test(
  "Given an accepted terms row When its membership or customer is deleted Then the row still cascades away",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const first = await joinedAcceptance(tx)
      await tx`
        delete from public.customer_memberships
        where id = ${first.membershipId}::uuid`
      assert.equal(await acceptanceCount(tx, first.acceptanceId), 0)

      const second = await joinedAcceptance(tx)
      await tx`delete from public.customers where id = ${second.customerId}::uuid`
      assert.equal(await acceptanceCount(tx, second.acceptanceId), 0)
    })
  }
)

test(
  "Given an accepted terms row When its QR code is deleted Then only the QR link is cleared",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const { acceptanceId, qrCodeId } = await joinedAcceptance(tx)
      const [before] = await tx`
        select terms_snapshot, terms_sha256, policy_version, accepted_at
        from public.customer_loyalty_terms_acceptances
        where id = ${acceptanceId}::uuid`
      await tx`delete from public.qr_codes where id = ${qrCodeId}::uuid`
      const [afterwards] = await tx`
        select terms_snapshot, terms_sha256, policy_version, accepted_at, qr_code_id
        from public.customer_loyalty_terms_acceptances
        where id = ${acceptanceId}::uuid`
      assert.equal(afterwards.qr_code_id, null)
      delete afterwards.qr_code_id
      assert.deepEqual(afterwards, before)
    })
  }
)

test(
  "Given an accepted terms row When an admin erases the customer Then erasure still completes and keeps the evidence",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const { acceptanceId, customerId, merchantId } =
        await joinedAcceptance(tx)
      await actAsActivatedInternalAdmin(tx, ADMIN_UID)
      const [{ result }] = await tx`
        select public.admin_erase_customer_pii(
          ${customerId}::uuid, ${merchantId}::uuid, 'email',
          'Terms immutability suite: erasure must keep working.') as result`
      assert.equal(result.ok, true)
      assert.equal(await acceptanceCount(tx, acceptanceId), 1)
    })
  }
)

test(
  "Given the customer-erasure flag When a privileged erasure path deletes the row Then it is allowed",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const { acceptanceId } = await joinedAcceptance(tx)
      await tx`select set_config('app.customer_erasure', 'true', true)`
      await tx`
        delete from public.customer_loyalty_terms_acceptances
        where id = ${acceptanceId}::uuid`
      await tx`select set_config('app.customer_erasure', '', true)`
      assert.equal(await acceptanceCount(tx, acceptanceId), 0)
    })
  }
)

test(
  "Given the wallet-link flag When terms content or acceptance time changes Then it is still refused",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const { acceptanceId } = await joinedAcceptance(tx)
      await refused(tx, async (sp) => {
        await sp`select set_config('app.customer_wallet_link','true',true)`
        await sp`update public.customer_loyalty_terms_acceptances
          set terms_sha256 = 'tampered' where id = ${acceptanceId}::uuid`
      })
      await refused(tx, async (sp) => {
        await sp`select set_config('app.customer_wallet_link','true',true)`
        await sp`update public.customer_loyalty_terms_acceptances
          set accepted_at = accepted_at - interval '1 year'
          where id = ${acceptanceId}::uuid`
      })
    })
  }
)

test(
  "Given no wallet-link flag When an acceptance is moved to another customer Then it is refused",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const { acceptanceId } = await joinedAcceptance(tx)
      const other = await joinedAcceptance(tx)
      await refused(tx, async (sp) => {
        await sp`update public.customer_loyalty_terms_acceptances
          set customer_id = ${other.customerId}::uuid,
              membership_id = ${other.membershipId}::uuid
          where id = ${acceptanceId}::uuid`
      })
      await refused(tx, async (sp) => {
        await sp`delete from public.customer_loyalty_terms_acceptances
          where id = ${acceptanceId}::uuid`
      })
      assert.equal(await acceptanceCount(tx, acceptanceId), 1)
    })
  }
)
