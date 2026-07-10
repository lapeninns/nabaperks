import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { after, test } from "node:test"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

const MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20260710160000_merchant_activation_ledger.sql"
)
const AGGREGATE_KEYS = [
  "account_created",
  "email_verified",
  "onboarding_complete",
  "launch_entered",
  "venue_ready",
  "card_ready",
  "rewards_ready",
  "qr_ready",
  "poster_ready",
  "billing_reached",
  "billing_activated",
  "first_customer_stamped",
  "first_stamp_7d_yes",
  "first_stamp_7d_no",
  "first_stamp_7d_pending",
  "median_signup_to_poster_seconds",
]

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

test(
  "activation schema pins occurrence time, idempotency, FORCE RLS, and service-only RPCs",
  { skip },
  async () => {
    assert.ok(
      existsSync(MIGRATION_PATH),
      "merchant activation migration must exist (RED until implementation)"
    )

    await inRolledBackTxn(async (tx) => {
      const columns = await tx`
      select column_name, is_nullable, column_default
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'product_events'
        and column_name in ('occurred_at', 'idempotency_key')
      order by column_name`
      assert.deepEqual(
        columns.map((row) => row.column_name),
        ["idempotency_key", "occurred_at"]
      )
      assert.equal(
        columns.find((row) => row.column_name === "occurred_at")?.is_nullable,
        "NO"
      )

      const relation = await tx`
      select
        relrowsecurity,
        relforcerowsecurity,
        has_table_privilege('service_role', oid, 'select') as service_select,
        has_table_privilege('authenticated', oid, 'select') as authenticated_select,
        has_table_privilege('anon', oid, 'select') as anon_select
      from pg_class
      where oid = 'public.merchant_funnel_links'::regclass`
      assert.equal(relation.length, 1)
      assert.equal(relation[0].relrowsecurity, true)
      assert.equal(relation[0].relforcerowsecurity, true)
      assert.equal(relation[0].service_select, true)
      assert.equal(relation[0].authenticated_select, false)
      assert.equal(relation[0].anon_select, false)

      const functions = await tx`
      select
        proname,
        prosecdef,
        provolatile,
        has_function_privilege('service_role', oid, 'execute') as service_execute,
        has_function_privilege('authenticated', oid, 'execute') as authenticated_execute,
        has_function_privilege('anon', oid, 'execute') as anon_execute,
        pg_get_function_result(oid) as result_type
      from pg_proc
      where pronamespace = 'public'::regnamespace
        and proname in (
          'record_merchant_activation_event',
          'get_merchant_activation_cohort_facts'
        )
      order by proname`
      assert.equal(functions.length, 2)
      for (const fn of functions) {
        assert.equal(fn.prosecdef, true, `${fn.proname} is SECURITY DEFINER`)
        assert.equal(
          fn.service_execute,
          true,
          `${fn.proname}: service role executes`
        )
        assert.equal(
          fn.authenticated_execute,
          false,
          `${fn.proname}: authenticated denied`
        )
        assert.equal(fn.anon_execute, false, `${fn.proname}: anon denied`)
      }
      const cohort = functions.find(
        (fn) => fn.proname === "get_merchant_activation_cohort_facts"
      )
      assert.equal(cohort?.provolatile, "s", "cohort facts are STABLE")
      for (const key of AGGREGATE_KEYS) {
        assert.match(cohort?.result_type ?? "", new RegExp(`\\b${key}\\b`))
      }
      assert.doesNotMatch(
        cohort?.result_type ?? "",
        /owner|funnel|contact|customer_id|merchant_id|provider|stripe/i
      )
    })
  }
)

test(
  "valid account attribution links once while malformed and conflicting links fail closed",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const ownerOne = randomUUID()
      const ownerTwo = randomUUID()
      const funnelKey = "a".repeat(64)
      await tx`insert into auth.users (id, email) values
      (${ownerOne}::uuid, ${`owner-${ownerOne}@example.test`}),
      (${ownerTwo}::uuid, ${`owner-${ownerTwo}@example.test`})`

      await insertAccountEvent(
        tx,
        ownerOne,
        funnelKey,
        new Date().toISOString()
      )
      await insertAccountEvent(
        tx,
        ownerTwo,
        funnelKey,
        new Date().toISOString()
      )
      await tx`
      insert into public.product_events (
        event_name, actor_type, actor_id, metadata, occurred_at
      ) values (
        'merchant_account_created', 'merchant', ${ownerTwo},
        jsonb_build_object('funnel_key', 'not-a-hmac'), now()
      )`

      const links = await tx`
      select owner_user_id::text as owner_user_id, funnel_key
      from public.merchant_funnel_links
      order by linked_at, owner_user_id`
      assert.deepEqual(
        links.map((row) => ({
          owner_user_id: row.owner_user_id,
          funnel_key: row.funnel_key,
        })),
        [{ owner_user_id: ownerOne, funnel_key: funnelKey }]
      )
    })
  }
)

test(
  "activation recorder is closed-vocabulary, timestamp-bounded, and retry-idempotent",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createMerchantFixture(tx, "recorder")
      const occurredAt = new Date(Date.now() - 60_000).toISOString()

      const first = await asServiceRole(
        tx,
        (sp) =>
          sp`select public.record_merchant_activation_event(
        ${fixture.merchantId}::uuid,
        'merchant_launch_entered',
        'first-entry',
        ${occurredAt}::timestamptz,
        '{}'::jsonb
      )::text as id`
      )
      const replay = await asServiceRole(
        tx,
        (sp) =>
          sp`select public.record_merchant_activation_event(
        ${fixture.merchantId}::uuid,
        'merchant_launch_entered',
        'first-entry',
        now(),
        '{}'::jsonb
      )::text as id`
      )
      assert.equal(first[0].id, replay[0].id)

      const rows = await tx`
      select id::text as id, actor_id, idempotency_key, occurred_at::text as occurred_at
      from public.product_events
      where merchant_id = ${fixture.merchantId}::uuid
        and event_name = 'merchant_launch_entered'`
      assert.equal(rows.length, 1)
      assert.equal(rows[0].id, first[0].id)
      assert.equal(rows[0].actor_id, fixture.ownerId)
      assert.equal(rows[0].idempotency_key, "first-entry")
      assert.equal(new Date(rows[0].occurred_at).toISOString(), occurredAt)

      for (const invalidCall of [
        `select public.record_merchant_activation_event('${fixture.merchantId}'::uuid, 'not_allowed', 'x', now(), '{}'::jsonb)`,
        `select public.record_merchant_activation_event('${fixture.merchantId}'::uuid, 'merchant_launch_entered', 'bad key', now(), '{}'::jsonb)`,
        `select public.record_merchant_activation_event('${fixture.merchantId}'::uuid, 'merchant_launch_entered', 'future', now() + interval '1 hour', '{}'::jsonb)`,
        `select public.record_merchant_activation_event('${fixture.merchantId}'::uuid, 'merchant_launch_entered', 'unsafe-meta', now(), '{"email":"owner@example.test"}'::jsonb)`,
        `select public.record_merchant_activation_event('${fixture.merchantId}'::uuid, 'merchant_launch_entered', 'open-meta', now(), '{"safe_but_unknown":"value"}'::jsonb)`,
        `select public.record_merchant_activation_event('${fixture.merchantId}'::uuid, 'merchant_launch_entered', 'bad-source', now(), '{"source":"homepage"}'::jsonb)`,
      ]) {
        await assertSqlRefused(tx, invalidCall)
      }
    })
  }
)

test(
  "cohort aggregation stays exact beyond the PostgREST row cap and returns aggregate facts only",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      // Pin this scale fixture to an otherwise empty historical window so the
      // assertion is isolated from developer seed data already in the live DB.
      const cohortStart = new Date("2000-01-01T00:00:00.000Z")
      const cohortEnd = new Date("2000-01-02T00:00:00.000Z")

      await tx.unsafe(`
      insert into public.product_events (
        event_name, actor_type, actor_id, metadata, occurred_at, created_at
      )
      select
        'merchant_account_created',
        'merchant',
        '00000000-0000-4000-8000-' || lpad(series::text, 12, '0'),
        '{}'::jsonb,
        '2000-01-01T12:00:00.000Z'::timestamptz,
        '2000-01-01T12:00:00.000Z'::timestamptz
      from generate_series(1, 1005) as series
    `)

      const rows = await cohortFacts(tx, cohortStart, cohortEnd, cohortEnd)
      assert.equal(rows.length, 1)
      assert.equal(Number(rows[0].account_created), 1005)
      assert.deepEqual(Object.keys(rows[0]).sort(), [...AGGREGATE_KEYS].sort())
    })
  }
)

test(
  "authoritative stages, stamp exclusions, and seven-day outcomes are derived without double counting",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      // Use a historical window so independently seeded local development rows
      // cannot alter the exact three-account cohort under proof.
      const asOf = new Date("2001-07-10T12:00:00.000Z")
      const cohortStart = new Date("2001-06-20T00:00:00.000Z")
      const cohortEnd = new Date("2001-07-11T00:00:00.000Z")

      const yes = await seedActivationJourney(tx, {
        slug: "yes",
        accountAt: "2001-07-01T09:00:00.000Z",
        billingAt: "2001-07-02T09:00:00.000Z",
        stampAt: "2001-07-03T09:00:00.000Z",
        setup: true,
      })
      await seedActivationJourney(tx, {
        slug: "no",
        accountAt: "2001-06-25T09:00:00.000Z",
        billingAt: "2001-06-26T09:00:00.000Z",
        stampAt: null,
        setup: false,
      })
      await seedActivationJourney(tx, {
        slug: "pending",
        accountAt: "2001-07-09T08:00:00.000Z",
        billingAt: "2001-07-09T09:00:00.000Z",
        stampAt: null,
        setup: false,
      })
      await seedExcludedStampRows(tx, yes)

      const [facts] = await cohortFacts(tx, cohortStart, cohortEnd, asOf)
      assert.equal(Number(facts.account_created), 3)
      assert.equal(Number(facts.email_verified), 1)
      assert.equal(Number(facts.onboarding_complete), 3)
      assert.equal(Number(facts.launch_entered), 1)
      assert.equal(Number(facts.venue_ready), 1)
      assert.equal(Number(facts.card_ready), 1)
      assert.equal(Number(facts.rewards_ready), 1)
      assert.equal(Number(facts.qr_ready), 1)
      assert.equal(Number(facts.poster_ready), 1)
      assert.equal(Number(facts.billing_reached), 1)
      assert.equal(Number(facts.billing_activated), 3)
      assert.equal(Number(facts.first_customer_stamped), 1)
      assert.equal(Number(facts.first_stamp_7d_yes), 1)
      assert.equal(Number(facts.first_stamp_7d_no), 1)
      assert.equal(Number(facts.first_stamp_7d_pending), 1)
      assert.equal(Number(facts.median_signup_to_poster_seconds), 9 * 60 * 60)
    })
  }
)

test(
  "merchant activation migration replays without changing its contract",
  { skip },
  async () => {
    assert.ok(existsSync(MIGRATION_PATH))
    const sql = readFileSync(MIGRATION_PATH, "utf8")
    await inRolledBackTxn(async (tx) => {
      await tx.unsafe(sql)
      await tx.unsafe(sql)
    })
  }
)

async function insertAccountEvent(tx, ownerId, funnelKey, occurredAt) {
  await tx`
    insert into public.product_events (
      event_name, actor_type, actor_id, metadata, occurred_at, created_at
    ) values (
      'merchant_account_created', 'merchant', ${ownerId},
      jsonb_build_object('funnel_key', ${funnelKey}::text),
      ${occurredAt}::timestamptz, ${occurredAt}::timestamptz
    )`
}

async function createMerchantFixture(
  tx,
  slug,
  createdAt = new Date().toISOString()
) {
  const ownerId = randomUUID()
  const merchantId = randomUUID()
  await tx`insert into auth.users (id, email) values (${ownerId}::uuid, ${`${slug}-${ownerId}@example.test`})`
  await tx`
    insert into public.merchants (
      id, owner_user_id, business_name, business_slug, business_type,
      email, status, created_at, updated_at
    ) values (
      ${merchantId}::uuid, ${ownerId}::uuid, ${`Activation ${slug}`},
      ${`activation-${slug}-${merchantId.slice(0, 8)}`}, 'pub',
      ${`${slug}-${ownerId}@example.test`}, 'trial',
      ${createdAt}::timestamptz, ${createdAt}::timestamptz
    )`
  return { ownerId, merchantId }
}

async function seedActivationJourney(tx, options) {
  const fixture = await createMerchantFixture(
    tx,
    options.slug,
    new Date(
      new Date(options.accountAt).getTime() + 2 * 60 * 60 * 1_000
    ).toISOString()
  )
  await insertAccountEvent(
    tx,
    fixture.ownerId,
    options.slug[0].repeat(64),
    options.accountAt
  )

  const billingAt = options.billingAt
  await tx`
    insert into public.product_events (
      event_name, merchant_id, actor_type, actor_id, metadata,
      idempotency_key, occurred_at, created_at
    ) values (
      'merchant_billing_activated', ${fixture.merchantId}::uuid, 'merchant',
      ${fixture.ownerId}, '{}'::jsonb, 'first-activation',
      ${billingAt}::timestamptz, ${billingAt}::timestamptz
    )`

  if (!options.setup) return fixture

  const at = (hours) =>
    new Date(
      new Date(options.accountAt).getTime() + hours * 60 * 60 * 1_000
    ).toISOString()
  const locationId = randomUUID()
  const cardId = randomUUID()
  const qrId = randomUUID()
  await tx`
    insert into public.product_events (
      event_name, actor_type, actor_id, metadata, occurred_at, created_at
    ) values (
      'merchant_email_verified', 'merchant', ${fixture.ownerId}, '{}',
      ${at(1)}::timestamptz, ${at(1)}::timestamptz
    )`
  await tx`
    insert into public.product_events (
      event_name, merchant_id, actor_type, actor_id, metadata,
      idempotency_key, occurred_at, created_at
    ) values
      ('merchant_launch_entered', ${fixture.merchantId}::uuid, 'merchant', ${fixture.ownerId}, '{}', 'first-entry', ${at(3)}::timestamptz, ${at(3)}::timestamptz),
      ('merchant_billing_reached', ${fixture.merchantId}::uuid, 'merchant', ${fixture.ownerId}, '{}', 'first-entry', ${at(8)}::timestamptz, ${at(8)}::timestamptz),
      ('qr_poster_emailed', ${fixture.merchantId}::uuid, 'merchant', ${fixture.ownerId}, '{}', 'first-success', ${at(9)}::timestamptz, ${at(9)}::timestamptz)
    `
  await tx`
    insert into public.merchant_locations (
      id, merchant_id, name, address, latitude, longitude,
      require_geofence, is_primary, created_at, updated_at
    ) values (
      ${locationId}::uuid, ${fixture.merchantId}::uuid, 'Activation venue',
      '1 Market Street, Cambridge', 52.2, 0.12, false, true,
      ${at(2)}::timestamptz, ${at(3)}::timestamptz
    )`
  await tx`
    insert into public.loyalty_cards (
      id, merchant_id, location_id, card_name, stamps_required,
      reward_name, reward_terms, is_active, created_at, updated_at
    ) values (
      ${cardId}::uuid, ${fixture.merchantId}::uuid, ${locationId}::uuid,
      'Activation card', 3, 'Surprise reward',
      'A surprise reward after three visits.', true,
      ${at(4)}::timestamptz, ${at(4)}::timestamptz
    )`
  for (let index = 0; index < 4; index += 1) {
    await tx`
      insert into public.reward_pool_items (
        merchant_id, location_id, loyalty_card_id, reward_name, reward_terms,
        weight, is_active, display_order, created_at, updated_at
      ) values (
        ${fixture.merchantId}::uuid, ${locationId}::uuid, ${cardId}::uuid,
        ${`Reward ${index}`}, 'A valid activation reward for this fixture.',
        1, ${index !== 0}, ${index}, ${at(4 + index)}::timestamptz,
        ${at(4 + index)}::timestamptz
      )`
  }
  await tx`
    insert into public.qr_codes (
      id, qr_id, merchant_id, location_id, loyalty_card_id,
      destination_type, is_active, created_at, updated_at
    ) values (
      ${qrId}::uuid, ${`activation-${qrId}`}, ${fixture.merchantId}::uuid,
      ${locationId}::uuid, ${cardId}::uuid, 'join', true,
      ${at(8)}::timestamptz, ${at(8)}::timestamptz
    )`

  const customer = await createStampFixture(
    tx,
    fixture,
    locationId,
    cardId,
    "real"
  )
  await tx`
    insert into public.stamp_events (
      merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
      event_type, stamps_delta, earned_business_date, metadata, created_at
    ) values (
      ${fixture.merchantId}::uuid, ${customer.customerId}::uuid,
      ${customer.membershipId}::uuid, ${cardId}::uuid, ${locationId}::uuid,
      'earned', 1, (${options.stampAt}::timestamptz at time zone 'Europe/London')::date,
      '{"source":"self_service_qr"}'::jsonb, ${options.stampAt}::timestamptz
    )`
  return { ...fixture, locationId, cardId }
}

async function seedExcludedStampRows(tx, fixture) {
  const cases = [
    ["referral", "earned", 1, "referral_bonus", "2001-06-28T09:00:00.000Z"],
    [
      "manual",
      "manual_adjustment",
      2,
      "self_service_qr",
      "2001-06-29T09:00:00.000Z",
    ],
    ["reversed", "reversed", -1, "self_service_qr", "2001-06-30T09:00:00.000Z"],
    ["other", "earned", 1, "merchant_manual", "2001-07-01T10:00:00.000Z"],
  ]
  for (const [slug, eventType, delta, source, createdAt] of cases) {
    const customer = await createStampFixture(
      tx,
      fixture,
      fixture.locationId,
      fixture.cardId,
      slug
    )
    await tx`
      insert into public.stamp_events (
        merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
        event_type, stamps_delta, earned_business_date, metadata, created_at
      ) values (
        ${fixture.merchantId}::uuid, ${customer.customerId}::uuid,
        ${customer.membershipId}::uuid, ${fixture.cardId}::uuid,
        ${fixture.locationId}::uuid, ${eventType}, ${delta},
        (${createdAt}::timestamptz at time zone 'Europe/London')::date,
        jsonb_build_object('source', ${source}::text), ${createdAt}::timestamptz
      )`
  }
}

async function createStampFixture(tx, fixture, locationId, cardId, slug) {
  const authId = randomUUID()
  const customerId = randomUUID()
  const membershipId = randomUUID()
  await tx`insert into auth.users (id, email) values (${authId}::uuid, ${`${slug}-${authId}@example.test`})`
  await tx`
    insert into public.customers (id, auth_user_id, email)
    values (${customerId}::uuid, ${authId}::uuid, ${`${slug}-${authId}@example.test`})`
  await tx`
    insert into public.customer_memberships (
      id, merchant_id, customer_id, current_stamp_count, total_stamps_earned
    ) values (
      ${membershipId}::uuid, ${fixture.merchantId}::uuid,
      ${customerId}::uuid, 0, 0
    )`
  return { customerId, membershipId, locationId, cardId }
}

async function cohortFacts(tx, start, end, asOf) {
  return asServiceRole(
    tx,
    (sp) =>
      sp`select * from public.get_merchant_activation_cohort_facts(
      ${start.toISOString()}::timestamptz,
      ${end.toISOString()}::timestamptz,
      ${asOf.toISOString()}::timestamptz
    )`
  )
}

async function asServiceRole(tx, fn) {
  return tx.savepoint(async (sp) => {
    await sp`set local role service_role`
    await sp`select set_config('request.jwt.claim.role', 'service_role', true)`
    try {
      return await fn(sp)
    } finally {
      await sp`reset role`
    }
  })
}

async function assertSqlRefused(tx, sql) {
  let refused = false
  try {
    await tx.savepoint((sp) => sp.unsafe(sql))
  } catch (error) {
    refused = /invalid|not allowed|required|future|metadata|idempotency/i.test(
      String(error.message)
    )
  }
  assert.equal(refused, true, `expected SQL refusal: ${sql}`)
}
