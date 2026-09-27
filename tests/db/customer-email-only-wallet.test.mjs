import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import postgres from "postgres"

import { actAsActivatedInternalAdmin } from "./helpers/admin-auth.mjs"
import {
  closeDb,
  db,
  dbUrl,
  inRolledBackTxn,
  isLiveDbReady,
} from "./helpers/db.mjs"
import { createRewardPoolFixture } from "./helpers/reward-pool-fixture.mjs"

/**
 * A wallet created by email holds a verified email and no phone. These prove
 * the database treats it as a first-class verified identity
 * (20261006100200..100600): it can open a session as a new or returning
 * identity, it can claim loyalty invitations addressed to it, a concurrent
 * invitation bind of a taken address is refused as 'email_conflict', joining
 * never records phone-channel consent for it, and retention and erasure reach
 * it, including its OTP trusted devices. Public offer campaigns stay
 * phone-only: one inbox can verify many aliases, so an email is not a costly
 * enough identity for an unlimited public claim.
 */

async function emailWalletDbReady() {
  if (!(await isLiveDbReady())) return false
  try {
    const [row] = await db()`
      select to_regclass('public.customers_verified_email_hmac_unique_idx') is not null
        and to_regprocedure('public.claim_loyalty_invite(uuid,text,text,boolean,text,text)') is not null
        and to_regprocedure('public.claim_offer_campaign(uuid,text,text,boolean)') is not null
        as ready`
    return row.ready
  } catch {
    return false
  }
}

const ready = await emailWalletDbReady()
const skip = ready ? false : "email-only wallet migrations not deployed"
const POLICY = "2026-10-06"
const ADMIN_UID = "00000000-0000-0000-0000-000000000001"
after(closeDb)

const hex64 = () => (randomUUID() + randomUUID()).replaceAll("-", "")

async function emailOnlyCustomer(sql, options = {}) {
  const id = randomUUID()
  const emailHmac = options.emailHmac ?? hex64()
  const email = options.email ?? `email-only-${randomUUID()}@example.test`
  await sql`
    insert into public.customers (
      id, email, email_hmac, email_verified_at, created_at, updated_at
    ) values (
      ${id}::uuid, ${email}, ${emailHmac},
      ${options.verified === false ? null : new Date()},
      ${options.at ?? new Date()}, ${options.at ?? new Date()}
    )`
  return { id, email, emailHmac }
}

async function phoneCustomer(sql, { email = null } = {}) {
  const id = randomUUID()
  await sql`
    insert into public.customers (id, email, phone_hmac, phone_verified_at)
    values (${id}::uuid, ${email}, ${hex64()}, now())`
  return id
}

async function trustDevice(sql, customerId) {
  await sql`
    insert into public.customer_otp_trusted_devices (
      customer_id, device_hash, trust_source, trusted_until
    ) values (
      ${customerId}::uuid, ${hex64()}, 'new_identity', now() + interval '90 days'
    )`
}

async function trustedDeviceCount(sql, customerId) {
  const [row] = await sql`
    select count(*)::int as n from public.customer_otp_trusted_devices
    where customer_id = ${customerId}::uuid`
  return row.n
}

async function inviteDraft(sql, merchantId, emailHmac) {
  const claimHash = hex64()
  const [draft] = await sql`
    select * from public.create_loyalty_invite_draft(
      ${merchantId}::uuid, null,
      ${[randomUUID()]}::uuid[], ${[emailHmac]}::text[], ${["v1.cipher.tag.body"]}::text[],
      ${["r***@example.test"]}::text[], ${[claimHash]}::text[], ${[hex64()]}::text[], 0, 0)`
  await sql`
    select public.confirm_loyalty_invite_campaign(
      ${merchantId}::uuid, ${draft.campaign_id}::uuid, 'venue_email_consent', 30)`
  return claimHash
}

function claimInvite(sql, customerId, claimHash, email, emailHmac) {
  return sql`
    select * from public.claim_loyalty_invite(
      ${customerId}::uuid, ${claimHash}, ${POLICY}, false, ${email}, ${emailHmac})`
}

async function liveOfferCampaign(sql, merchantId) {
  const claimHash = hex64()
  const [{ d: today }] =
    await sql`select public.uk_business_date(now())::text as d`
  const [draft] = await sql`
    select * from public.create_offer_campaign_draft(
      ${merchantId}::uuid, null, 2::integer, null::integer,
      ${today}::date, (${today}::date + 30), false, null, null, null,
      null::text, null::text)`
  await sql`
    select public.rotate_offer_campaign_token(
      ${merchantId}::uuid, ${draft.campaign_id}::uuid,
      ${claimHash}, ${"v1.iv.body.tag"}, null)`
  const [published] = await sql`
    select public.publish_offer_campaign(
      ${merchantId}::uuid, ${draft.campaign_id}::uuid, null) as status`
  assert.equal(published.status, "live")
  return claimHash
}

async function merchantSlug(sql, merchantId) {
  const [row] = await sql`
    select business_slug from public.merchants where id = ${merchantId}::uuid`
  return row.business_slug
}

async function joinConsentChannels(sql, customerId, slug) {
  await sql`
    select * from public.join_customer_membership(
      ${customerId}::uuid, ${slug}, null, true, ${POLICY})`
  const rows = await sql`
    select channel from public.consent_records
    where customer_id = ${customerId}::uuid and source = 'customer_join'
    order by channel`
  return rows.map((row) => row.channel)
}

async function registerSession(sql, customerId, source) {
  const sessionId = randomUUID()
  const deviceHash = hex64()
  const [row] = await sql`
    select public.register_customer_session(
      ${customerId}::uuid, ${sessionId}::uuid, 'infinity'::timestamptz,
      ${deviceHash}, ${source}) as session_id`
  return { sessionId, deviceHash, registered: row.session_id }
}

async function trustSourceOf(sql, customerId, deviceHash) {
  const rows = await sql`
    select trust_source from public.customer_otp_trusted_devices
    where customer_id = ${customerId}::uuid and device_hash = ${deviceHash}`
  return rows.map((row) => row.trust_source)
}

test(
  "an email-only wallet opens sessions as a new and as a returning identity",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      // Just created by email sign-up: no session, membership or device yet.
      const fresh = await emailOnlyCustomer(tx)
      const created = await registerSession(tx, fresh.id, "new_identity")
      assert.equal(created.registered, created.sessionId)
      assert.deepEqual(await trustSourceOf(tx, fresh.id, created.deviceHash), [
        "new_identity",
      ])

      // An established email-only wallet signing back in on a new device.
      const established = await emailOnlyCustomer(tx, {
        at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      })
      const [merchant] =
        await tx`select id from public.merchants order by created_at limit 1`
      await tx`
        insert into public.customer_memberships (merchant_id, customer_id)
        values (${merchant.id}::uuid, ${established.id}::uuid)`
      const returning = await registerSession(
        tx,
        established.id,
        "verified_email"
      )
      assert.equal(returning.registered, returning.sessionId)
      assert.deepEqual(
        await trustSourceOf(tx, established.id, returning.deviceHash),
        ["verified_email"]
      )
    })
  }
)

test(
  "an unverified email-only row cannot open a verified_email session",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const unverified = await emailOnlyCustomer(tx, { verified: false })
      await assert.rejects(
        tx.savepoint((sp) =>
          registerSession(sp, unverified.id, "verified_email")
        ),
        /Customer continuity proof required/
      )
      assert.equal(await trustedDeviceCount(tx, unverified.id), 0)
    })
  }
)

test(
  "an email-only wallet claims a loyalty invitation sent to its email",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      const wallet = await emailOnlyCustomer(tx)
      const claimHash = await inviteDraft(tx, fx.merchantId, wallet.emailHmac)

      const [res] = await claimInvite(
        tx,
        wallet.id,
        claimHash,
        wallet.email,
        wallet.emailHmac
      )
      assert.equal(res.status, "claimed")
      assert.equal(res.stamps_awarded, 2)

      // A different verified email is still a conflict, never a merge.
      const otherVenue = await createRewardPoolFixture(tx)
      const other = await emailOnlyCustomer(tx)
      const invitedHmac = hex64()
      const otherHash = await inviteDraft(
        tx,
        otherVenue.merchantId,
        invitedHmac
      )
      const [conflict] = await claimInvite(
        tx,
        other.id,
        otherHash,
        "someone-else@example.test",
        invitedHmac
      )
      assert.equal(conflict.status, "email_conflict")
    })
  }
)

test("an unverified email alone still claims nothing", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fx = await createRewardPoolFixture(tx)
    const unverified = await emailOnlyCustomer(tx, { verified: false })
    const claimHash = await inviteDraft(tx, fx.merchantId, unverified.emailHmac)
    const [invite] = await claimInvite(
      tx,
      unverified.id,
      claimHash,
      unverified.email,
      unverified.emailHmac
    )
    assert.equal(invite.status, "invalid")

    const offerHash = await liveOfferCampaign(tx, fx.merchantId)
    const [offer] = await tx`
        select * from public.claim_offer_campaign(
          ${unverified.id}::uuid, ${offerHash}, ${POLICY}, false)`
    assert.equal(offer.status, "invalid")
  })
})

test(
  "an email-only wallet is refused a public offer campaign; a phone wallet claims it",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      const wallet = await emailOnlyCustomer(tx)
      const claimHash = await liveOfferCampaign(tx, fx.merchantId)

      const [refused] = await tx`
        select * from public.claim_offer_campaign(
          ${wallet.id}::uuid, ${claimHash}, ${POLICY}, false)`
      assert.equal(refused.status, "invalid")
      assert.equal(refused.membership_id, null)
      const [{ n }] = await tx`
        select count(*)::int as n from public.customer_memberships
        where customer_id = ${wallet.id}::uuid`
      assert.equal(n, 0, "nothing was created for the email-only wallet")

      const phoneWallet = await phoneCustomer(tx)
      const [claimed] = await tx`
        select * from public.claim_offer_campaign(
          ${phoneWallet}::uuid, ${claimHash}, ${POLICY}, false)`
      assert.equal(claimed.status, "claimed")
      assert.equal(claimed.stamps_awarded, 2)
    })
  }
)

test(
  "an invitation bind racing another wallet's verification returns email_conflict",
  { skip },
  async () => {
    const claimer = postgres(dbUrl(), { max: 1, idle_timeout: 2 })
    const rival = postgres(dbUrl(), { max: 1, idle_timeout: 2 })
    const observer = postgres(dbUrl(), { max: 1, idle_timeout: 2 })
    const emailHmac = hex64()
    const rivalId = randomUUID()
    let releaseRival
    const rivalMayCommit = new Promise((resolve) => {
      releaseRival = resolve
    })
    let rivalInserted
    const rivalReady = new Promise((resolve) => {
      rivalInserted = resolve
    })
    const ROLLBACK = Symbol("rollback")

    try {
      // The rival verifies the address in a transaction that stays open, so
      // the claimer's pre-bind lookup cannot see it yet.
      const rivalTxn = rival.begin(async (tx) => {
        await tx`
          insert into public.customers (id, email, email_hmac, email_verified_at)
          values (${rivalId}::uuid, ${`rival-${rivalId}@example.test`},
                  ${emailHmac}, now())`
        rivalInserted()
        await rivalMayCommit
      })
      await rivalReady

      let claimStatus
      const claimTxn = claimer
        .begin(async (tx) => {
          await tx`set local statement_timeout = '10s'`
          await tx`select set_config('request.jwt.claim.role', 'service_role', true)`
          const fx = await createRewardPoolFixture(tx)
          const customerId = await phoneCustomer(tx)
          const claimHash = await inviteDraft(tx, fx.merchantId, emailHmac)
          const [res] = await claimInvite(
            tx,
            customerId,
            claimHash,
            "invited@example.test",
            emailHmac
          )
          claimStatus = res.status
          const [bound] = await tx`
            select email_hmac from public.customers where id = ${customerId}::uuid`
          assert.equal(bound.email_hmac, null, "the bind was undone")
          throw ROLLBACK
        })
        .catch((error) => {
          if (error !== ROLLBACK) throw error
        })

      // Wait until the claimer's bind is blocked on the rival's index entry.
      let blocked = false
      for (let attempt = 0; attempt < 100 && !blocked; attempt++) {
        const [row] = await observer`
          select count(*)::int as n from pg_stat_activity
          where wait_event_type = 'Lock' and query ilike '%claim_loyalty_invite%'`
        blocked = row.n > 0
        if (!blocked) await new Promise((resolve) => setTimeout(resolve, 50))
      }
      assert.ok(
        blocked,
        "the claimer's bind waited on the rival's verified row"
      )

      releaseRival()
      await rivalTxn
      await claimTxn
      assert.equal(claimStatus, "email_conflict")
    } finally {
      releaseRival()
      await observer`delete from public.customers where id = ${rivalId}::uuid`
      await Promise.all(
        [claimer, rival, observer].map((sql) => sql.end({ timeout: 5 }))
      )
    }
  }
)

test(
  "joining records only the consent channels the customer holds",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      const slug = await merchantSlug(tx, fx.merchantId)

      const wallet = await emailOnlyCustomer(tx)
      assert.deepEqual(await joinConsentChannels(tx, wallet.id, slug), [
        "email",
      ])

      const phoneWithEmail = await phoneCustomer(tx, {
        email: `phone-email-${randomUUID()}@example.test`,
      })
      assert.deepEqual(await joinConsentChannels(tx, phoneWithEmail, slug), [
        "email",
        "sms",
        "whatsapp",
      ])

      const phoneOnly = await phoneCustomer(tx)
      assert.deepEqual(await joinConsentChannels(tx, phoneOnly, slug), [
        "sms",
        "whatsapp",
      ])
    })
  }
)

test(
  "abandoned-identity retention anonymises an email-only wallet and its devices",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const old = new Date("2000-01-01T00:00:00Z")
      const abandoned = await emailOnlyCustomer(tx, { at: old })
      await trustDevice(tx, abandoned.id)
      const unverified = await emailOnlyCustomer(tx, {
        at: old,
        verified: false,
      })
      const member = await emailOnlyCustomer(tx, { at: old })
      const [merchant] =
        await tx`select id from public.merchants order by created_at limit 1`
      await tx`
        insert into public.customer_memberships (merchant_id, customer_id)
        values (${merchant.id}::uuid, ${member.id}::uuid)`
      await tx`update public.customers set updated_at = ${old}
               where id = ${member.id}::uuid`

      const [purged] = await tx`
        select public.admin_purge_abandoned_customer_identities('2000-01-02') as count`
      assert.equal(purged.count, 1)

      const [erased] = await tx`
        select email, email_hmac, email_verified_at from public.customers
        where id = ${abandoned.id}::uuid`
      assert.match(erased.email, /^erased\+[0-9a-f]+@privacy\.invalid$/)
      assert.equal(erased.email_hmac, null)
      assert.equal(erased.email_verified_at, null)
      assert.equal(await trustedDeviceCount(tx, abandoned.id), 0)

      for (const kept of [unverified, member]) {
        const [row] = await tx`
          select email from public.customers where id = ${kept.id}::uuid`
        assert.equal(row.email, kept.email)
      }

      const [replayed] = await tx`
        select public.admin_purge_abandoned_customer_identities('2000-01-02') as count`
      assert.equal(replayed.count, 0)
    })
  }
)

test(
  "admin erasure removes an email-only wallet's trusted devices",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      const wallet = await emailOnlyCustomer(tx)
      await tx`
        insert into public.customer_memberships (merchant_id, customer_id)
        values (${fx.merchantId}::uuid, ${wallet.id}::uuid)`
      await trustDevice(tx, wallet.id)

      await actAsActivatedInternalAdmin(tx, ADMIN_UID)
      const [{ result }] = await tx`
        select public.admin_erase_customer_pii(
          ${wallet.id}::uuid, ${fx.merchantId}::uuid, 'email',
          'Customer-requested erasure of an email-only wallet.') as result`
      assert.equal(result.ok, true)
      assert.equal(await trustedDeviceCount(tx, wallet.id), 0)
      const [row] = await tx`
        select email_hmac, email_verified_at from public.customers
        where id = ${wallet.id}::uuid`
      assert.equal(row.email_hmac, null)
      assert.equal(row.email_verified_at, null)
    })
  }
)

test(
  "stale-PII retention removes an email-only wallet's trusted devices",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const old = new Date("2000-01-01T00:00:00Z")
      const stale = await emailOnlyCustomer(tx, { at: old })
      await trustDevice(tx, stale.id)
      const [purged] = await tx`
        select public.admin_purge_stale_customer_pii('2000-01-02') as count`
      assert.ok(purged.count >= 1)
      assert.equal(await trustedDeviceCount(tx, stale.id), 0)
      const [row] = await tx`
        select email from public.customers where id = ${stale.id}::uuid`
      assert.match(row.email, /^erased\+/)
    })
  }
)

test(
  "a live wallet without a phone cannot strip delivery digits; an erased one can",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const wallet = await emailOnlyCustomer(tx)
      const [merchant] =
        await tx`select id from public.merchants order by created_at limit 1`
      const [event] = await tx`
        insert into public.notification_events
          (event_type, category, customer_id, merchant_id, dedupe_key, status)
        values ('reward_ready', 'transactional', ${wallet.id}::uuid,
                ${merchant.id}::uuid, ${randomUUID()}, 'delivering')
        returning id`
      // A delivery row written before the phone was removed (legacy history).
      const [delivery] = await tx`
        insert into public.notification_deliveries
          (notification_event_id, customer_id, channel, status, attempt_number, recipient_last4)
        values (${event.id}::uuid, ${wallet.id}::uuid, 'sms', 'sent', 1, '0123')
        returning id`

      await assert.rejects(
        tx.savepoint(
          (sp) =>
            sp`update public.notification_deliveries set recipient_last4 = null
               where id = ${delivery.id}::uuid`
        ),
        /append-only/
      )

      await tx`select set_config('app.customer_erasure', 'true', true)`
      await tx`
        update public.customers
        set email = ${`erased+${wallet.id.replaceAll("-", "")}@privacy.invalid`},
            email_hmac = null, email_verified_at = null
        where id = ${wallet.id}::uuid`
      await tx`select set_config('app.customer_erasure', '', true)`
      await tx`update public.notification_deliveries set recipient_last4 = null
               where id = ${delivery.id}::uuid`
    })
  }
)

test(
  "SMS code admission accepts the attach scope and still refuses unknown scopes",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [admitted] = await tx`
        select public.admit_customer_otp_dispatch(
          'attach', ${hex64()}, ${hex64()}, ${hex64()}, ${hex64()}, null) as trusted`
      assert.equal(admitted.trusted, false)
      const [{ n }] = await tx`
        select count(*)::int as n from public.rate_limit_buckets
        where bucket_key like 'customer-otp:dispatch:attach:%'`
      assert.ok(n >= 3, "attach debits its own global buckets")

      await assert.rejects(
        tx.savepoint(
          (sp) =>
            sp`select public.admit_customer_otp_dispatch(
              'profile', ${hex64()}, ${hex64()}, ${hex64()}, ${hex64()}, null)`
        ),
        /Invalid customer OTP admission input/
      )
    })
  }
)
