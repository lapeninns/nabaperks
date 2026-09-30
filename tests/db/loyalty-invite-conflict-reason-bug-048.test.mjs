import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import { createRewardPoolFixture } from "./helpers/reward-pool-fixture.mjs"

/**
 * QA BUG-048 (38c42a1..2c45031): an invitation claim refused as
 * 'email_conflict' says which conflict it was, so the join page can tell a
 * wallet with no email that the address belongs to another wallet, instead
 * of saying its own account "uses a different email". The status itself is
 * unchanged for the deployed app, and nothing is bound, joined or claimed.
 */
const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"
const POLICY = "2026-09-28"
after(closeDb)

const hex64 = () => (randomUUID() + randomUUID()).replaceAll("-", "")

async function emailWallet(sql, emailHmac = hex64()) {
  const id = randomUUID()
  await sql`
    insert into public.customers (id, email, email_hmac, email_verified_at)
    values (${id}::uuid, ${`wallet-${randomUUID()}@example.test`}, ${emailHmac}, now())`
  return { id, emailHmac }
}

async function phoneOnlyWallet(sql) {
  const id = randomUUID()
  await sql`
    insert into public.customers (id, phone_hmac, phone_verified_at)
    values (${id}::uuid, ${hex64()}, now())`
  return id
}

async function invitation(sql, merchantId, emailHmac) {
  const claimHash = hex64()
  const [draft] = await sql`
    select * from public.create_loyalty_invite_draft(
      ${merchantId}::uuid, null,
      ${[randomUUID()]}::uuid[], ${[emailHmac]}::text[], ${["v1.cipher.tag.body"]}::text[],
      ${["i***@example.test"]}::text[], ${[claimHash]}::text[], ${[hex64()]}::text[], 0, 0)`
  await sql`
    select public.confirm_loyalty_invite_campaign(
      ${merchantId}::uuid, ${draft.campaign_id}::uuid, 'venue_email_consent', 30)`
  return claimHash
}

function claim(sql, customerId, claimHash, emailHmac) {
  return sql`
    select * from public.claim_loyalty_invite(
      ${customerId}::uuid, ${claimHash}, ${POLICY}, false,
      ${"invited@example.test"}, ${emailHmac})`
}

async function nothingChanged(sql, customerId, merchantId) {
  const [row] = await sql`
    select
      (select count(*)::int from public.customer_memberships
        where customer_id = ${customerId}::uuid and merchant_id = ${merchantId}::uuid) as memberships,
      (select email_hmac from public.customers where id = ${customerId}::uuid) as email_hmac`
  return row
}

test(
  "a phone-only wallet refused because another wallet holds the invited email is told so",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      const holder = await emailWallet(tx)
      const claimant = await phoneOnlyWallet(tx)
      const claimHash = await invitation(tx, fx.merchantId, holder.emailHmac)

      const [res] = await claim(tx, claimant, claimHash, holder.emailHmac)

      assert.equal(res.status, "email_conflict")
      assert.equal(res.conflict_reason, "email_held_elsewhere")
      assert.equal(res.membership_id, null)
      assert.deepEqual(await nothingChanged(tx, claimant, fx.merchantId), {
        memberships: 0,
        email_hmac: null,
      })
    })
  }
)

test(
  "a wallet whose own verified email differs keeps the existing reason",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      const claimant = await emailWallet(tx)
      const invitedHmac = hex64()
      const claimHash = await invitation(tx, fx.merchantId, invitedHmac)

      const [res] = await claim(tx, claimant.id, claimHash, invitedHmac)

      assert.equal(res.status, "email_conflict")
      assert.equal(res.conflict_reason, "wallet_email_differs")
      assert.deepEqual(await nothingChanged(tx, claimant.id, fx.merchantId), {
        memberships: 0,
        email_hmac: claimant.emailHmac,
      })
    })
  }
)

test("a successful claim carries no conflict reason", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fx = await createRewardPoolFixture(tx)
    const claimant = await phoneOnlyWallet(tx)
    const invitedHmac = hex64()
    const claimHash = await invitation(tx, fx.merchantId, invitedHmac)

    const [res] = await claim(tx, claimant, claimHash, invitedHmac)

    assert.equal(res.status, "claimed")
    assert.equal(res.conflict_reason, null)
    assert.equal(res.stamps_awarded, 2)
  })
})

test(
  "claim_loyalty_invite stays executable by the service role only",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const signature =
        "public.claim_loyalty_invite(uuid,text,text,boolean,text,text)"
      const [row] = await tx`select
        has_function_privilege('anon', ${signature}, 'execute') as anon_can,
        has_function_privilege('authenticated', ${signature}, 'execute') as authenticated_can,
        has_function_privilege('service_role', ${signature}, 'execute') as service_can,
        (select prosecdef from pg_proc where oid = ${signature}::regprocedure) as definer`
      assert.deepEqual(
        { ...row },
        {
          anon_can: false,
          authenticated_can: false,
          service_can: true,
          definer: true,
        }
      )
    })
  }
)
