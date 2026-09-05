import assert from "node:assert/strict"
import { after, test } from "node:test"

import postgres from "postgres"

import { dbUrl, isLiveDbReady } from "./helpers/db.mjs"
import { createRewardPoolFixture } from "./helpers/reward-pool-fixture.mjs"

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

let privilegedDb = null

function dbAsSupabaseAdmin() {
  if (privilegedDb) return privilegedDb
  const url = new URL(dbUrl())
  url.username = "supabase_admin"
  privilegedDb = postgres(url.toString(), { max: 1, idle_timeout: 5 })
  return privilegedDb
}

after(async () => {
  if (privilegedDb) await privilegedDb.end({ timeout: 5 })
})

async function inPrivilegedRolledBackTxn(fn) {
  const rollback = Symbol("rollback")
  try {
    await dbAsSupabaseAdmin().begin(async (tx) => {
      await fn(tx)
      throw rollback
    })
  } catch (error) {
    if (error !== rollback) throw error
  }
}

async function asPostgrestRole(tx, role, claims, fn) {
  await tx.unsafe("set session authorization authenticator")
  await tx.unsafe(`set local role ${role}`)
  try {
    await tx`select set_config('request.jwt.claim.role', ${role}, true)`
    await tx`select set_config('request.jwt.claim.sub', ${claims.sub ?? ""}, true)`
    await tx`select set_config('request.jwt.claim.aal', ${claims.aal ?? ""}, true)`
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ role, ...claims })}, true)`
    return await fn(tx)
  } finally {
    await tx.unsafe("reset role")
    await tx.unsafe("reset session authorization")
  }
}

async function makeBirthdayEligible(tx, fixture) {
  await tx`
    update public.customer_memberships
    set last_visit_at = now()
    where id = ${fixture.membershipId}::uuid`
  await tx`
    update public.loyalty_cards
    set birthday_reward_enabled = true,
        birthday_reward_name = 'Birthday drink',
        birthday_reward_terms = 'Subject to availability.'
    where id = ${fixture.cardId}::uuid`
}

async function insertUnlockedReward(tx, fixture) {
  const [reward] = await tx`
    insert into public.reward_events (
      merchant_id,
      customer_id,
      membership_id,
      loyalty_card_id,
      status,
      reward_name,
      reward_terms,
      redeemable_from,
      metadata
    ) values (
      ${fixture.merchantId}::uuid,
      ${fixture.customerId}::uuid,
      ${fixture.membershipId}::uuid,
      ${fixture.cardId}::uuid,
      'unlocked',
      'Verified DOB test reward',
      'Subject to availability.',
      public.uk_business_date(now()),
      '{}'::jsonb
    )
    returning id`
  return reward.id
}

test(
  "a customer-asserted birthday cannot issue a birthday reward",
  { skip },
  async () => {
    await inPrivilegedRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      await makeBirthdayEligible(tx, fixture)

      await asPostgrestRole(tx, "service_role", {}, async (serviceTx) => {
        await serviceTx`
          update public.customers
          set date_of_birth = make_date(
            extract(year from now())::int - 30,
            extract(month from now() at time zone 'Europe/London')::int,
            15
          )
          where id = ${fixture.customerId}::uuid`

        const [customer] = await serviceTx`
          select date_of_birth_verified_at, date_of_birth_verification_source
          from public.customers
          where id = ${fixture.customerId}::uuid`
        assert.equal(customer.date_of_birth_verified_at, null)
        assert.equal(customer.date_of_birth_verification_source, null)

        const [{ issued }] = await serviceTx`
          select public.issue_birthday_rewards(
            now(), ${fixture.customerId}::uuid
          ) as issued`
        assert.equal(
          issued,
          0,
          "self-asserted profile data creates no birthday entitlement"
        )
      })

      const [{ count }] = await tx`
        select count(*)::int as count
        from public.reward_events
        where customer_id = ${fixture.customerId}::uuid
          and source = 'birthday_month'`
      assert.equal(count, 0)
    })
  }
)

test(
  "service-role callers cannot spoof verification or redeem through an alternate reward path",
  { skip },
  async () => {
    await inPrivilegedRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      const rewardId = await insertUnlockedReward(tx, fixture)
      const [previouslyMinted] = await tx`
        select * from public.create_reward_scan_token(
          ${rewardId}::uuid, ${fixture.customerId}::uuid
        )`

      await asPostgrestRole(tx, "service_role", {}, async (serviceTx) => {
        await assert.rejects(
          () =>
            serviceTx.savepoint(
              (sp) => sp`
              update public.customers
              set date_of_birth_verified_at = now(),
                  date_of_birth_verification_source = 'trusted_database'
              where id = ${fixture.customerId}::uuid`
            ),
          /verification provenance cannot be changed/i
        )

        await serviceTx`
          update public.customers
          set date_of_birth = date '1991-02-03'
          where id = ${fixture.customerId}::uuid`

        const [retired] = await serviceTx`
          select consumed_at, superseded_at, expires_at <= now() as expired
          from public.reward_scan_tokens
          where id = ${previouslyMinted.scan_token}::uuid`
        assert.equal(retired.consumed_at, null)
        assert.notEqual(retired.superseded_at, null)
        assert.equal(retired.expired, true)

        const [context] = await serviceTx`
          select * from public.get_reward_scan_context(
            ${previouslyMinted.scan_token}::uuid,
            ${fixture.merchantId}::uuid
          )`
        assert.notEqual(
          context.scan_status,
          "ready",
          "a token minted before provenance invalidation is no longer merchant-ready"
        )

        const [reviewToken] = await serviceTx`
          select * from public.create_reward_scan_token(
            ${rewardId}::uuid, ${fixture.customerId}::uuid
          )`
        assert.ok(
          reviewToken.scan_token,
          "an adult can present a QR for owner ID review"
        )
        await assert.rejects(
          () =>
            serviceTx.savepoint(
              (sp) => sp`
            select * from public.collect_reward_scan_token(
              ${reviewToken.scan_token}::uuid, ${fixture.merchantId}::uuid
            )`
            ),
          /verified adult date of birth required/i
        )
        await assert.rejects(
          () =>
            serviceTx.savepoint(
              (sp) => sp`
              select * from public.collect_reward_scan_token(
                ${previouslyMinted.scan_token}::uuid,
                ${fixture.merchantId}::uuid
              )`
            ),
          /expired|superseded/i
        )
        await assert.rejects(
          () =>
            serviceTx.savepoint(
              (sp) => sp`
              select * from public.redeem_self_service_reward(
                ${rewardId}::uuid, ${fixture.customerId}::uuid, null, null
              )`
            ),
          /verified adult date of birth required/i
        )
      })

      const [reward] = await tx`
        select status from public.reward_events where id = ${rewardId}::uuid`
      assert.equal(
        reward.status,
        "unlocked",
        "rejected redemption leaves the reward intact"
      )
    })
  }
)

test(
  "an active single-factor internal admin can verify DOB while non-admins remain denied",
  { skip },
  async () => {
    await inPrivilegedRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      await makeBirthdayEligible(tx, fixture)

      await asPostgrestRole(
        tx,
        "authenticated",
        { sub: fixture.ownerUserId, aal: "aal1" },
        async (authenticatedTx) => {
          await assert.rejects(
            () =>
              authenticatedTx.savepoint(
                (sp) => sp`
                select * from public.admin_verify_customer_date_of_birth(
                  ${fixture.customerId}::uuid,
                  date '1990-01-01',
                  'Checked reliable evidence'
                )`
              ),
            (error) => error?.code === "42501"
          )
        }
      )

      await asPostgrestRole(
        tx,
        "authenticated",
        { sub: fixture.adminUserId, aal: "aal1" },
        async (authenticatedTx) => {
          await authenticatedTx`
            select * from public.admin_verify_customer_date_of_birth(
              ${fixture.customerId}::uuid,
              make_date(
                extract(year from now())::int - 30,
                extract(month from now() at time zone 'Europe/London')::int,
                15
              ),
              'Checked reliable evidence'
            )`
        }
      )

      const [verified] = await tx`
        select date_of_birth_verified_at,
               date_of_birth_verification_source,
               date_of_birth_verified_by
        from public.customers
        where id = ${fixture.customerId}::uuid`
      assert.notEqual(verified.date_of_birth_verified_at, null)
      assert.equal(verified.date_of_birth_verification_source, "internal_admin")
      assert.equal(verified.date_of_birth_verified_by, fixture.adminUserId)

      const [audit] = await tx`
        select action, actor_id, metadata
        from public.audit_logs
        where customer_id = ${fixture.customerId}::uuid
          and action = 'customer_date_of_birth_verified'
        order by created_at desc
        limit 1`
      assert.equal(audit.actor_id, fixture.adminUserId)
      assert.equal(audit.metadata.verification_source, "internal_admin")

      const [{ issued }] = await tx`
        select public.issue_birthday_rewards(
          now(), ${fixture.customerId}::uuid
        ) as issued`
      assert.equal(
        issued,
        1,
        "verified adult receives the legitimate birthday reward"
      )

      const [birthdayReward] = await tx`
        select id
        from public.reward_events
        where customer_id = ${fixture.customerId}::uuid
          and source = 'birthday_month'`
      const [minted] = await tx`
        select * from public.create_reward_scan_token(
          ${birthdayReward.id}::uuid, ${fixture.customerId}::uuid
        )`
      assert.ok(
        minted.scan_token,
        "verified adult can mint a reward collection token"
      )
    })
  }
)
