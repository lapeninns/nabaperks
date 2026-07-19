import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { after, test } from "node:test"

import postgres from "postgres"

const DEFAULT_LOCAL_DB_URL =
  "postgres://postgres:postgres@127.0.0.1:54322/postgres"
const dbUrl = process.env.SUPABASE_DB_URL ?? DEFAULT_LOCAL_DB_URL
const BILLING_SERIALIZATION_MIGRATION = join(
  process.cwd(),
  "supabase/migrations/20260713190000_serialize_billing_entitlement.sql"
)

const fixtures = new Set()

after(async () => {
  const sql = createSqlClient()
  try {
    for (const fixture of fixtures) {
      await cleanupFixture(sql, fixture)
    }
  } finally {
    await sql.end({ timeout: 5 })
  }
})

test("Given two QR stamp attempts When they race for one membership Then only one stamp is issued for the UK business day", async () => {
  const setupSql = createSqlClient()
  const firstSql = createSqlClient()
  const secondSql = createSqlClient()

  try {
    const fixture = await createFixture(setupSql, {
      billingStatus: "active",
      membershipStampCount: 0,
      rewardToken: false,
    })

    await Promise.all([setServiceRole(firstSql), setServiceRole(secondSql)])

    const attempts = await Promise.allSettled([
      issueStamp(firstSql, fixture),
      issueStamp(secondSql, fixture),
    ])

    assertOneSuccessOneFailure(attempts, /Stamp already issued/)

    const [{ stampCount, currentStampCount }] = await setupSql`
        select
          (
            select count(*)::integer
            from public.stamp_events
            where membership_id = ${fixture.membershipId}
              and event_type = 'earned'
              and earned_business_date = public.uk_business_date(now())
          ) as stamp_count,
          (
            select current_stamp_count
            from public.customer_memberships
            where id = ${fixture.membershipId}
          ) as current_stamp_count
      `

    assert.equal(stampCount, 1)
    assert.equal(currentStampCount, 1)
  } finally {
    await Promise.all([
      setupSql.end({ timeout: 5 }),
      firstSql.end({ timeout: 5 }),
      secondSql.end({ timeout: 5 }),
    ])
  }
})

test("Given two reward collection scans When they race for one token Then only one collection advances the cycle", async () => {
  const setupSql = createSqlClient()
  const firstSql = createSqlClient()
  const secondSql = createSqlClient()

  try {
    const fixture = await createFixture(setupSql, {
      billingStatus: "active",
      membershipStampCount: 3,
      rewardToken: true,
    })

    await Promise.all([setServiceRole(firstSql), setServiceRole(secondSql)])

    const attempts = await Promise.allSettled([
      collectReward(firstSql, fixture),
      collectReward(secondSql, fixture),
    ])

    assertOneSuccessOneFailure(attempts, /Reward scan token already used/)

    const [
      {
        rewardStatus,
        consumedCount,
        currentStampCount,
        activeCycleNumber,
        totalRewardsRedeemed,
      },
    ] = await setupSql`
      select
        (
          select status
          from public.reward_events
          where id = ${fixture.rewardEventId}
        ) as reward_status,
        (
          select count(*)::integer
          from public.reward_scan_tokens
          where id = ${fixture.scanTokenId}
            and consumed_at is not null
        ) as consumed_count,
        current_stamp_count,
        active_cycle_number,
        total_rewards_redeemed
      from public.customer_memberships
      where id = ${fixture.membershipId}
    `

    assert.equal(rewardStatus, "redeemed")
    assert.equal(consumedCount, 1)
    assert.equal(currentStampCount, 0)
    assert.equal(activeCycleNumber, 2)
    assert.equal(totalRewardsRedeemed, 1)
  } finally {
    await Promise.all([
      setupSql.end({ timeout: 5 }),
      firstSql.end({ timeout: 5 }),
      secondSql.end({ timeout: 5 }),
    ])
  }
})

test("Given a merchant that requires billing When no billing row exists Then stamp issuance fails closed inside the RPC", async () => {
  const sql = createSqlClient()

  try {
    const fixture = await createFixture(sql, {
      billingStatus: null,
      membershipStampCount: 0,
      rewardToken: false,
    })

    await setServiceRole(sql)

    await assert.rejects(() => issueStamp(sql, fixture), /not active yet/)

    const [{ stampCount, currentStampCount }] = await sql`
        select
          (
            select count(*)::integer
            from public.stamp_events
            where membership_id = ${fixture.membershipId}
          ) as stamp_count,
          (
            select current_stamp_count
            from public.customer_memberships
            where id = ${fixture.membershipId}
          ) as current_stamp_count
      `

    assert.equal(stampCount, 0)
    assert.equal(currentStampCount, 0)
  } finally {
    await sql.end({ timeout: 5 })
  }
})

test("Given billing is past due When a retained venue QR is stamped Then the RPC fails closed without writing a stamp", async () => {
  const sql = createSqlClient()

  try {
    const fixture = await createFixture(sql, {
      billingStatus: "active",
      membershipStampCount: 0,
      rewardToken: false,
    })

    await setServiceRole(sql)
    await sql`
      update public.billing_customers
      set status = 'past_due'
      where merchant_id = ${fixture.merchantId}::uuid`

    await assert.rejects(() => issueStamp(sql, fixture), /billing|unavailable/i)

    const [{ stampCount, currentStampCount }] = await sql`
      select
        (
          select count(*)::integer
          from public.stamp_events
          where membership_id = ${fixture.membershipId}
        ) as stamp_count,
        (
          select current_stamp_count
          from public.customer_memberships
          where id = ${fixture.membershipId}
        ) as current_stamp_count`

    assert.equal(stampCount, 0)
    assert.equal(currentStampCount, 0)
  } finally {
    await sql.end({ timeout: 5 })
  }
})

test("Given billing is past due When a merchant sends a direct reward Then no reward or ledger row is written", async () => {
  const sql = createSqlClient()

  try {
    const fixture = await createFixture(sql, {
      billingStatus: "active",
      membershipStampCount: 0,
      rewardToken: false,
    })

    await setServiceRole(sql)
    await sql`
      update public.billing_customers
      set status = 'past_due'
      where merchant_id = ${fixture.merchantId}::uuid`

    await assert.rejects(
      () => issueDirectReward(sql, fixture),
      /billing|unavailable/i
    )

    const [{ rewardCount, eventCount }] = await sql`
      select
        (
          select count(*)::integer
          from public.reward_events
          where merchant_id = ${fixture.merchantId}::uuid
            and source = 'merchant_direct'
        ) as reward_count,
        (
          select count(*)::integer
          from public.product_events
          where merchant_id = ${fixture.merchantId}::uuid
            and event_name = 'reward_sent'
        ) as event_count`

    assert.equal(rewardCount, 0)
    assert.equal(eventCount, 0)
  } finally {
    await sql.end({ timeout: 5 })
  }
})

test("Given billing lapses after token mint When collection is attempted Then reward and token remain untouched", async () => {
  const sql = createSqlClient()

  try {
    const fixture = await createFixture(sql, {
      billingStatus: "active",
      membershipStampCount: 3,
      rewardToken: true,
    })

    await setServiceRole(sql)
    await sql`
      update public.billing_customers
      set status = 'past_due'
      where merchant_id = ${fixture.merchantId}::uuid`

    await assert.rejects(
      () => collectReward(sql, fixture),
      /billing|unavailable/i
    )

    const [{ rewardStatus, consumedAt, currentStampCount, activeCycleNumber }] =
      await sql`
        select
          (
            select status
            from public.reward_events
            where id = ${fixture.rewardEventId}::uuid
          ) as reward_status,
          (
            select consumed_at
            from public.reward_scan_tokens
            where id = ${fixture.scanTokenId}::uuid
          ) as consumed_at,
          current_stamp_count,
          active_cycle_number
        from public.customer_memberships
        where id = ${fixture.membershipId}::uuid`

    assert.equal(rewardStatus, "unlocked")
    assert.equal(consumedAt, null)
    assert.equal(currentStampCount, 3)
    assert.equal(activeCycleNumber, 1)
  } finally {
    await sql.end({ timeout: 5 })
  }
})

registerBillingLapseRace({
  title:
    "Given a billing lapse owns the merchant lock When a stamp races Then the stamp waits and fails closed",
  fixtureOptions: {
    billingStatus: "active",
    membershipStampCount: 0,
    rewardToken: false,
  },
  attempt: issueStamp,
  assertUntouched: async (sql, fixture) => {
    const [{ stampCount, currentStampCount }] = await sql`
      select
        (
          select count(*)::integer
          from public.stamp_events
          where membership_id = ${fixture.membershipId}::uuid
        ) as stamp_count,
        (
          select current_stamp_count
          from public.customer_memberships
          where id = ${fixture.membershipId}::uuid
        ) as current_stamp_count`

    assert.equal(stampCount, 0)
    assert.equal(currentStampCount, 0)
  },
})

registerBillingLapseRace({
  title:
    "Given a billing lapse owns the merchant lock When a direct reward races Then the reward waits and fails closed",
  fixtureOptions: {
    billingStatus: "active",
    membershipStampCount: 0,
    rewardToken: false,
  },
  attempt: issueDirectReward,
  assertUntouched: async (sql, fixture) => {
    const [{ rewardCount, eventCount }] = await sql`
      select
        (
          select count(*)::integer
          from public.reward_events
          where merchant_id = ${fixture.merchantId}::uuid
            and source = 'merchant_direct'
        ) as reward_count,
        (
          select count(*)::integer
          from public.product_events
          where merchant_id = ${fixture.merchantId}::uuid
            and event_name = 'reward_sent'
        ) as event_count`

    assert.equal(rewardCount, 0)
    assert.equal(eventCount, 0)
  },
})

registerBillingLapseRace({
  title:
    "Given a billing lapse owns the merchant lock When redemption races Then redemption waits and fails closed",
  fixtureOptions: {
    billingStatus: "active",
    membershipStampCount: 3,
    rewardToken: true,
  },
  attempt: collectReward,
  assertUntouched: async (sql, fixture) => {
    const [{ rewardStatus, consumedAt, currentStampCount, activeCycleNumber }] =
      await sql`
        select
          (
            select status
            from public.reward_events
            where id = ${fixture.rewardEventId}::uuid
          ) as reward_status,
          (
            select consumed_at
            from public.reward_scan_tokens
            where id = ${fixture.scanTokenId}::uuid
          ) as consumed_at,
          current_stamp_count,
          active_cycle_number
        from public.customer_memberships
        where id = ${fixture.membershipId}::uuid`

    assert.equal(rewardStatus, "unlocked")
    assert.equal(consumedAt, null)
    assert.equal(currentStampCount, 3)
    assert.equal(activeCycleNumber, 1)
  },
})

test("Given a direct reward owns the merchant lock When billing lapses Then billing waits and both commit in serial order", async () => {
  const setupSql = createSqlClient()
  const billingSql = createSqlClient()
  const loyaltySql = createSqlClient()
  let loyaltyTransactionOpen = false
  let billingAttempt

  try {
    const fixture = await createFixture(setupSql, {
      billingStatus: "active",
      membershipStampCount: 0,
      rewardToken: false,
    })

    await setServiceRole(loyaltySql)
    await loyaltySql`begin`
    loyaltyTransactionOpen = true
    await issueDirectReward(loyaltySql, fixture)

    const billingBackendPid = await getBackendPid(billingSql)

    billingAttempt = settle(
      billingSql.begin(async (transaction) => {
        await lockBillingState(transaction, fixture.merchantId)
        await transaction`
          update public.billing_customers
          set status = 'past_due'
          where merchant_id = ${fixture.merchantId}::uuid`
      })
    )

    const lockObservation = waitForAdvisoryLockWait(
      setupSql,
      billingBackendPid
    ).then(() => ({ status: "waiting" }))
    const beforeCommit = await Promise.race([billingAttempt, lockObservation])

    assert.equal(
      beforeCommit.status,
      "waiting",
      "billing state must wait behind the loyalty transaction lock"
    )

    await loyaltySql`commit`
    loyaltyTransactionOpen = false

    const outcome = await billingAttempt
    assert.equal(outcome.status, "fulfilled")

    const [{ rewardCount, billingStatus }] = await setupSql`
      select
        (
          select count(*)::integer
          from public.reward_events
          where merchant_id = ${fixture.merchantId}::uuid
            and source = 'merchant_direct'
        ) as reward_count,
        (
          select status
          from public.billing_customers
          where merchant_id = ${fixture.merchantId}::uuid
        ) as billing_status`

    assert.equal(rewardCount, 1)
    assert.equal(billingStatus, "past_due")
  } finally {
    if (loyaltyTransactionOpen) await loyaltySql`rollback`
    await billingAttempt
    await Promise.all([
      setupSql.end({ timeout: 5 }),
      billingSql.end({ timeout: 5 }),
      loyaltySql.end({ timeout: 5 }),
    ])
  }
})

test("Given the billing serialization migration When it replays Then both trigger functions keep the exact lock and privilege contract", async () => {
  const sql = createSqlClient()

  try {
    const migrationSql = readFileSync(BILLING_SERIALIZATION_MIGRATION, "utf8")
    await sql.unsafe(migrationSql)
    await sql.unsafe(migrationSql)

    const functions = await sql`
      select
        proname,
        prosecdef,
        coalesce(array_to_string(proconfig, ','), '') as function_config,
        pg_get_functiondef(pg_proc.oid) as definition,
        has_function_privilege('anon', pg_proc.oid, 'execute') as anon_execute,
        has_function_privilege('authenticated', pg_proc.oid, 'execute') as authenticated_execute,
        has_function_privilege('service_role', pg_proc.oid, 'execute') as service_role_execute
      from pg_proc
      join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
      where pg_namespace.nspname = 'public'
        and proname in (
          'enforce_stamp_billing_entitlement',
          'enforce_reward_billing_entitlement'
        )
      order by proname`

    assert.equal(functions.length, 2)
    for (const fn of functions) {
      assert.equal(fn.prosecdef, true)
      assert.match(fn.functionConfig, /search_path=public, auth, extensions/)
      assert.match(fn.definition, /pg_advisory_xact_lock/)
      assert.match(fn.definition, /billing-state:/)
      assert.equal(fn.anonExecute, false)
      assert.equal(fn.authenticatedExecute, false)
      assert.equal(fn.serviceRoleExecute, true)
    }

    const [{ triggerCount }] = await sql`
      select count(*)::integer as trigger_count
      from pg_trigger
      where not tgisinternal
        and tgname in (
          'enforce_stamp_billing_entitlement',
          'enforce_reward_billing_entitlement_insert',
          'enforce_reward_billing_entitlement_redeem'
        )`

    assert.equal(triggerCount, 3)
  } finally {
    await sql.end({ timeout: 5 })
  }
})

function createSqlClient() {
  const hostname = new URL(dbUrl).hostname.toLowerCase()
  const isSupabaseHost =
    hostname === "supabase.com" || hostname.endsWith(".supabase.com")

  return postgres(dbUrl, {
    max: 1,
    ssl: isSupabaseHost ? "require" : undefined,
    transform: postgres.camel,
  })
}

async function setServiceRole(sql) {
  await sql`select set_config('request.jwt.claim.role', 'service_role', false)`
}

async function issueStamp(sql, fixture) {
  return sql`
    select *
    from public.issue_self_service_stamp(
      ${fixture.membershipId}::uuid,
      ${fixture.customerId}::uuid,
      ${fixture.qrPublicId}::text
    )
  `
}

async function collectReward(sql, fixture) {
  return sql`
    select *
    from public.collect_reward_scan_token(
      ${fixture.scanTokenId}::uuid,
      ${fixture.merchantId}::uuid
    )
  `
}

async function issueDirectReward(sql, fixture) {
  return sql`
    select *
    from public.issue_merchant_direct_reward(
      ${fixture.merchantId}::uuid,
      ${fixture.membershipId}::uuid,
      'A direct reward',
      'Subject to the usual house terms.',
      30,
      'Production entitlement proof'
    )
  `
}

async function lockBillingState(sql, merchantId) {
  await sql`
    select pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'billing-state:' || ${merchantId}::uuid::text,
        0
      )
    )`
}

function settle(promise) {
  return promise.then(
    (value) => ({ status: "fulfilled", value }),
    (error) => ({ status: "rejected", error })
  )
}

function registerBillingLapseRace({
  title,
  fixtureOptions,
  attempt,
  assertUntouched,
}) {
  test(title, async () => {
    const setupSql = createSqlClient()
    const billingSql = createSqlClient()
    const loyaltySql = createSqlClient()
    let billingTransactionOpen = false
    let loyaltyAttempt

    try {
      const fixture = await createFixture(setupSql, fixtureOptions)

      await setServiceRole(loyaltySql)
      const loyaltyBackendPid = await getBackendPid(loyaltySql)
      await billingSql`begin`
      billingTransactionOpen = true
      await lockBillingState(billingSql, fixture.merchantId)
      await billingSql`
        update public.billing_customers
        set status = 'past_due'
        where merchant_id = ${fixture.merchantId}::uuid`

      loyaltyAttempt = settle(attempt(loyaltySql, fixture))
      const lockObservation = waitForAdvisoryLockWait(
        setupSql,
        loyaltyBackendPid
      ).then(() => ({ status: "waiting" }))
      const beforeCommit = await Promise.race([loyaltyAttempt, lockObservation])

      assert.equal(
        beforeCommit.status,
        "waiting",
        "loyalty value must wait on the merchant advisory lock"
      )

      await billingSql`commit`
      billingTransactionOpen = false

      const outcome = await loyaltyAttempt
      assert.equal(outcome.status, "rejected")
      assert.match(
        String(outcome.error?.message ?? outcome.error),
        /billing|unavailable/i
      )
      await assertUntouched(setupSql, fixture)
    } finally {
      if (billingTransactionOpen) await billingSql`rollback`
      await loyaltyAttempt
      await Promise.all([
        setupSql.end({ timeout: 5 }),
        billingSql.end({ timeout: 5 }),
        loyaltySql.end({ timeout: 5 }),
      ])
    }
  })
}

async function getBackendPid(sql) {
  const [{ pid }] = await sql`select pg_backend_pid()::integer as pid`
  return pid
}

async function waitForAdvisoryLockWait(observerSql, backendPid) {
  const deadline = Date.now() + 5_000
  let lastObservation = null

  while (Date.now() < deadline) {
    const [activity] = await observerSql`
      select wait_event_type, wait_event
      from pg_stat_activity
      where pid = ${backendPid}::integer`

    lastObservation = activity ?? null
    if (
      activity?.waitEventType === "Lock" &&
      activity.waitEvent?.toLowerCase() === "advisory"
    ) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 25))
  }

  throw new Error(
    `Backend ${backendPid} did not enter an advisory-lock wait: ${JSON.stringify(lastObservation)}`
  )
}

function assertOneSuccessOneFailure(results, expectedMessage) {
  const successes = results.filter((result) => result.status === "fulfilled")
  const failures = results.filter((result) => result.status === "rejected")

  assert.equal(successes.length, 1)
  assert.equal(failures.length, 1)
  assert.match(
    String(failures[0].reason?.message ?? failures[0].reason),
    expectedMessage
  )
}

async function createFixture(sql, options) {
  const fixture = {
    ownerUserId: randomUUID(),
    customerUserId: randomUUID(),
    merchantId: randomUUID(),
    locationId: randomUUID(),
    cardId: randomUUID(),
    customerId: randomUUID(),
    membershipId: randomUUID(),
    qrCodeId: randomUUID(),
    qrPublicId: `db-moat-${randomUUID().slice(0, 8)}`,
    rewardPoolItemIds: [randomUUID(), randomUUID(), randomUUID()],
    rewardEventId: options.rewardToken ? randomUUID() : null,
    scanTokenId: options.rewardToken ? randomUUID() : null,
  }

  await cleanupFixture(sql, fixture)
  fixtures.add(fixture)

  await sql`
    insert into auth.users (id)
    values (${fixture.ownerUserId}::uuid), (${fixture.customerUserId}::uuid)
  `

  await sql`
    insert into public.merchants (
      id,
      owner_user_id,
      business_name,
      business_slug,
      business_type,
      email,
      status,
      requires_billing
    )
    values (
      ${fixture.merchantId}::uuid,
      ${fixture.ownerUserId}::uuid,
      'Architecture DB Test',
      ${`db-moat-${fixture.merchantId.slice(0, 8)}`},
      'pub',
      ${`db-moat-${fixture.merchantId.slice(0, 8)}@example.test`},
      'active',
      true
    )
  `

  await sql`
    insert into public.merchant_locations (
      id,
      merchant_id,
      name,
      address,
      latitude,
      longitude,
      geofence_radius_meters,
      require_geofence,
      soft_geofence_trigger_stamp_number
    )
    values (
      ${fixture.locationId}::uuid,
      ${fixture.merchantId}::uuid,
      'Architecture Test Bar',
      '1 Test Street',
      52.205,
      0.119,
      100,
      false,
      3
    )
  `

  await sql`
    insert into public.loyalty_cards (
      id,
      merchant_id,
      location_id,
      card_name,
      stamps_required,
      reward_name,
      reward_terms,
      is_active
    )
    values (
      ${fixture.cardId}::uuid,
      ${fixture.merchantId}::uuid,
      ${fixture.locationId}::uuid,
      'Architecture Test Card',
      3,
      'Mystery reward',
      'Subject to house rules.',
      true
    )
  `

  await sql`
    insert into public.customers (
      id,
      auth_user_id,
      email,
      full_name,
      date_of_birth,
      email_verified_at
    )
    values (
      ${fixture.customerId}::uuid,
      ${fixture.customerUserId}::uuid,
      ${`db-moat-${fixture.customerId.slice(0, 8)}@example.test`},
      'Database Moat Customer',
      date '1990-01-01',
      now()
    )
  `

  await sql`
    insert into public.customer_memberships (
      id,
      merchant_id,
      customer_id,
      current_stamp_count,
      total_stamps_earned,
      active_cycle_number
    )
    values (
      ${fixture.membershipId}::uuid,
      ${fixture.merchantId}::uuid,
      ${fixture.customerId}::uuid,
      ${options.membershipStampCount},
      ${options.membershipStampCount},
      1
    )
  `

  await sql`
    insert into public.reward_pool_items (
      id,
      merchant_id,
      location_id,
      loyalty_card_id,
      reward_name,
      reward_terms,
      weight,
      is_active,
      display_order
    )
    values
      (
        ${fixture.rewardPoolItemIds[0]}::uuid,
        ${fixture.merchantId}::uuid,
        ${fixture.locationId}::uuid,
        ${fixture.cardId}::uuid,
        'First drink',
        'Subject to availability.',
        1,
        true,
        1
      ),
      (
        ${fixture.rewardPoolItemIds[1]}::uuid,
        ${fixture.merchantId}::uuid,
        ${fixture.locationId}::uuid,
        ${fixture.cardId}::uuid,
        'Snack',
        'Subject to availability.',
        1,
        true,
        2
      ),
      (
        ${fixture.rewardPoolItemIds[2]}::uuid,
        ${fixture.merchantId}::uuid,
        ${fixture.locationId}::uuid,
        ${fixture.cardId}::uuid,
        'Dessert',
        'Subject to availability.',
        1,
        true,
        3
      )
  `

  await sql`
    insert into public.qr_codes (
      id,
      qr_id,
      merchant_id,
      location_id,
      loyalty_card_id,
      destination_type,
      is_active
    )
    values (
      ${fixture.qrCodeId}::uuid,
      ${fixture.qrPublicId},
      ${fixture.merchantId}::uuid,
      ${fixture.locationId}::uuid,
      ${fixture.cardId}::uuid,
      'join',
      true
    )
  `

  if (options.billingStatus) {
    await sql`
      insert into public.billing_customers (
        merchant_id,
        stripe_customer_id,
        stripe_subscription_id,
        status
      )
      values (
        ${fixture.merchantId}::uuid,
        ${`cus_${fixture.merchantId.slice(0, 8)}`},
        ${`sub_${fixture.merchantId.slice(0, 8)}`},
        ${options.billingStatus}
      )
    `
  }

  if (fixture.rewardEventId && fixture.scanTokenId) {
    await sql`
      insert into public.reward_events (
        id,
        merchant_id,
        customer_id,
        membership_id,
        loyalty_card_id,
        reward_pool_item_id,
        reward_name,
        reward_terms,
        redeemable_from,
        status,
        cycle_number
      )
      values (
        ${fixture.rewardEventId}::uuid,
        ${fixture.merchantId}::uuid,
        ${fixture.customerId}::uuid,
        ${fixture.membershipId}::uuid,
        ${fixture.cardId}::uuid,
        ${fixture.rewardPoolItemIds[0]}::uuid,
        'First drink',
        'Subject to availability.',
        public.uk_business_date(now()),
        'unlocked',
        1
      )
    `

    await sql`
      update public.customers
      set email_hmac = coalesce(
        email_hmac,
        encode(extensions.digest(lower(email), 'sha256'), 'hex')
      )
      where id = ${fixture.customerId}::uuid
    `

    await sql`
      insert into public.reward_scan_tokens (
        id,
        reward_event_id,
        merchant_id,
        customer_id,
        membership_id,
        expires_at
      )
      values (
        ${fixture.scanTokenId}::uuid,
        ${fixture.rewardEventId}::uuid,
        ${fixture.merchantId}::uuid,
        ${fixture.customerId}::uuid,
        ${fixture.membershipId}::uuid,
        now() + interval '1 hour'
      )
    `
  }

  return fixture
}

async function cleanupFixture(sql, fixture) {
  await sql`delete from public.merchants where id = ${fixture.merchantId}::uuid`
  await sql`delete from public.customers where id = ${fixture.customerId}::uuid`
  await sql`
    delete from auth.users
    where id in (${fixture.ownerUserId}::uuid, ${fixture.customerUserId}::uuid)
  `
  fixtures.delete(fixture)
}
