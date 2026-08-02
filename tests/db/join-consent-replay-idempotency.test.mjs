import assert from "node:assert/strict"
import { after, test } from "node:test"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import { createRewardPoolFixture } from "./helpers/reward-pool-fixture.mjs"

/**
 * Join replay must not append unbounded consent evidence.
 *
 * Membership and the terms snapshot were already idempotent; the marketing
 * consent insert beside them was not, so every re-submission of the same join
 * appended another row. Withdrawals must stay append-only, so only the GRANT is
 * keyed.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"
const POLICY = "2026-07-19"

after(async () => {
  await closeDb()
})

test("replaying the same join records consent once", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = await joinable(tx)

    await join(tx, fixture)
    await join(tx, fixture)
    await join(tx, fixture)

    assert.equal(
      await joinConsentCount(tx, fixture),
      1,
      "three identical joins are one consent decision, not three"
    )
  })
})

test(
  "a new policy version records a fresh consent decision",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await joinable(tx)

      await join(tx, fixture)
      await join(tx, fixture, { policyVersion: "2026-09-01" })

      assert.equal(
        await joinConsentCount(tx, fixture),
        2,
        "re-consenting to new terms is a real, separate decision"
      )
    })
  }
)

test(
  "a join without marketing opt-in records no consent at all",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await joinable(tx)

      await join(tx, fixture, { marketingOptIn: false })

      assert.equal(await joinConsentCount(tx, fixture), 0)
    })
  }
)

test(
  "an explicit opt-out is still appended after a join consent",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await joinable(tx)
      await join(tx, fixture)

      // The key includes consent_status, so a withdrawal is never swallowed by
      // the grant's uniqueness — the audit trail must keep both rows.
      await tx`
        insert into public.consent_records
          (merchant_id, customer_id, channel, consent_status, source, policy_version)
        values
          (${fixture.merchantId}::uuid, ${fixture.customerId}::uuid, 'email',
           'opted_out', 'customer_join', ${POLICY})`

      const [row] = await tx`
        select count(*)::int as n from public.consent_records
        where customer_id = ${fixture.customerId}::uuid
          and consent_status = 'opted_out'`
      assert.equal(row.n, 1, "withdrawals stay append-only")
    })
  }
)

test(
  "a customer cannot mint their own consent evidence",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await joinable(tx)

      const refusal = await tx
        .savepoint(async (sp) => {
          const claims = JSON.stringify({
            sub: fixture.authUserId,
            role: "authenticated",
          })
          await sp`select set_config('request.jwt.claims', ${claims}, true)`
          await sp`select set_config('request.jwt.claim.role', '', true)`
          await sp`
            insert into public.consent_records
              (merchant_id, customer_id, channel, consent_status, source, policy_version)
            values
              (${fixture.merchantId}::uuid, ${fixture.customerId}::uuid, 'email',
               'opted_in', 'customer_join', ${POLICY})`
          return null
        })
        .catch((error) => error)

      await tx`select set_config('request.jwt.claims', '', true)`
      await tx`select set_config('request.jwt.claim.role', 'service_role', true)`

      assert.match(
        String(refusal?.message),
        /recorded by the server/,
        "consent evidence is server-owned"
      )
    })
  }
)

async function joinable(tx) {
  const fixture = await createRewardPoolFixture(tx)
  const [customer] = await tx`
    select auth_user_id from public.customers
    where id = ${fixture.customerId}::uuid`
  const [merchant] = await tx`
    select business_slug from public.merchants
    where id = ${fixture.merchantId}::uuid`
  return {
    merchantId: fixture.merchantId,
    customerId: fixture.customerId,
    authUserId: customer.auth_user_id,
    slug: merchant.business_slug,
  }
}

function join(
  tx,
  fixture,
  { marketingOptIn = true, policyVersion = POLICY } = {}
) {
  return tx`
    select * from public.join_customer_membership(
      ${fixture.customerId}::uuid,
      ${fixture.slug},
      null,
      ${marketingOptIn},
      ${policyVersion}
    )`
}

async function joinConsentCount(tx, fixture) {
  const [row] = await tx`
    select count(*)::int as n from public.consent_records
    where customer_id = ${fixture.customerId}::uuid
      and source = 'customer_join'
      and consent_status = 'opted_in'`
  return row.n
}

test(
  "re-consenting after an opt-out is recorded, not swallowed",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await joinable(tx)

      await join(tx, fixture)
      await tx`
        insert into public.consent_records
          (merchant_id, customer_id, channel, consent_status, source, policy_version)
        values
          (${fixture.merchantId}::uuid, ${fixture.customerId}::uuid, 'email',
           'opted_out', 'customer_join', ${POLICY})`

      // The customer changes their mind and joins again. Deduping purely on the
      // key swallowed this, leaving opted_out as the newest row — so a fresh,
      // explicit consent was silently discarded.
      await join(tx, fixture)

      const [latest] = await tx`
        select consent_status from public.consent_records
        where customer_id = ${fixture.customerId}::uuid
          and source = 'customer_join'
        order by created_at desc, id desc
        limit 1`
      assert.equal(
        latest.consent_status,
        "opted_in",
        "renewed consent is recorded"
      )
    })
  }
)

test("replay is still bounded while consent stands", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = await joinable(tx)
    for (let i = 0; i < 4; i += 1) await join(tx, fixture)
    assert.equal(await joinConsentCount(tx, fixture), 1)
  })
})
