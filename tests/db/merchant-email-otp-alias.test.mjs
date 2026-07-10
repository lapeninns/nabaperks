import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { after, test } from "node:test"

import postgres from "postgres"

import { closeDb, dbUrl, inRolledBackTxn } from "./helpers/db.mjs"

const MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20260710093000_finalize_merchant_email_otp_aliases.sql"
)

const PURPOSES = {
  recovery: "recovery",
  signup: "signup",
}

after(async () => {
  await closeDb()
})

test("alias lifecycle RPCs are service-role only and backing tables keep FORCE RLS", async () => {
  await inRolledBackTxn(async (tx) => {
    const functions = await tx`
      select
        proname,
        prosecdef,
        coalesce(array_to_string(proconfig, ','), '') as function_config,
        has_function_privilege('service_role', oid, 'execute') as service_role_can_execute,
        has_function_privilege('authenticated', oid, 'execute') as authenticated_can_execute,
        has_function_privilege('anon', oid, 'execute') as anon_can_execute
      from pg_proc
      where pronamespace = 'public'::regnamespace
        and proname in (
          'create_merchant_email_otp_alias',
          'reserve_merchant_email_otp_alias',
          'finalize_merchant_email_otp_alias',
          'release_merchant_email_otp_alias',
          'revoke_merchant_email_otp_alias'
        )
      order by proname
    `

    assert.equal(
      functions.length,
      5,
      "all five alias lifecycle RPCs must exist (RED until migration lands)"
    )
    for (const fn of functions) {
      assert.equal(fn.prosecdef, true, `${fn.proname} must be SECURITY DEFINER`)
      assert.match(
        fn.function_config,
        /search_path=public/,
        `${fn.proname}: search_path is pinned`
      )
      assert.equal(
        fn.service_role_can_execute,
        true,
        `${fn.proname}: service_role executes`
      )
      assert.equal(
        fn.authenticated_can_execute,
        false,
        `${fn.proname}: authenticated denied`
      )
      assert.equal(fn.anon_can_execute, false, `${fn.proname}: anon denied`)
    }

    const tables = await tx`
      select relname, relrowsecurity, relforcerowsecurity
      from pg_class
      where relnamespace = 'public'::regnamespace
        and relname in (
          'merchant_email_otp_aliases',
          'merchant_email_otp_alias_attempts'
        )
      order by relname
    `
    assert.equal(tables.length, 2)
    for (const table of tables) {
      assert.equal(table.relrowsecurity, true, `${table.relname}: RLS enabled`)
      assert.equal(
        table.relforcerowsecurity,
        true,
        `${table.relname}: RLS forced`
      )
      assert.equal(
        await roleHasTablePrivilege(tx, "authenticated", table.relname),
        false,
        `${table.relname}: authenticated has no direct table privilege`
      )
      assert.equal(
        await roleHasTablePrivilege(tx, "anon", table.relname),
        false,
        `${table.relname}: anon has no direct table privilege`
      )
      assert.equal(
        await roleHasTablePrivilege(tx, "service_role", table.relname),
        true,
        `${table.relname}: service_role retains direct lifecycle access`
      )
    }

    const [policies] = await tx`
      select count(*)::int as policy_count
      from pg_policies
      where schemaname = 'public'
        and tablename in (
          'merchant_email_otp_aliases',
          'merchant_email_otp_alias_attempts'
        )
    `
    assert.equal(
      policies.policy_count,
      0,
      "browser roles receive no RLS policy"
    )

    const compatibilityFunctions = await tx`
      select
        proname,
        has_function_privilege('service_role', oid, 'execute') as service_role_can_execute,
        has_function_privilege('authenticated', oid, 'execute') as authenticated_can_execute,
        has_function_privilege('anon', oid, 'execute') as anon_can_execute
      from pg_proc
      where pronamespace = 'public'::regnamespace
        and proname in (
          'consume_merchant_email_otp_alias',
          'purge_merchant_email_otp_aliases'
        )
      order by proname
    `
    assert.equal(compatibilityFunctions.length, 2)
    for (const fn of compatibilityFunctions) {
      assert.equal(
        fn.service_role_can_execute,
        true,
        `${fn.proname}: service only`
      )
      assert.equal(
        fn.authenticated_can_execute,
        false,
        `${fn.proname}: auth denied`
      )
      assert.equal(fn.anon_can_execute, false, `${fn.proname}: anon denied`)
    }
  })
})

test("reserve leases a token without consuming it, then verified finalize scrubs it exactly once", async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = aliasFixture("verified")
    const aliasId = await createAlias(tx, fixture)

    const reserved = await reserveAlias(tx, fixture)
    assert.equal(reserved.status, "reserved")
    assert.match(reserved.reservation_id, UUID_PATTERN)
    assert.equal(reserved.supabase_token, fixture.token)
    assert.equal(reserved.retry_at, null)

    const [leasedRow] = await tx`
      select consumed_at, resolution, reservation_id, reserved_until, supabase_token
      from public.merchant_email_otp_aliases
      where id = ${aliasId}::uuid
    `
    assert.equal(leasedRow.consumed_at, null, "reserve is not consumption")
    assert.equal(leasedRow.resolution, null)
    assert.equal(leasedRow.reservation_id, reserved.reservation_id)
    assert.ok(leasedRow.reserved_until instanceof Date)
    assert.equal(leasedRow.supabase_token, fixture.token)

    assert.equal(
      await finalizeAlias(tx, reserved.reservation_id, "verified"),
      true
    )
    assert.equal(
      await finalizeAlias(tx, reserved.reservation_id, "verified"),
      false,
      "a reservation cannot finalize twice"
    )

    const [finalRow] = await tx`
      select consumed_at, resolution, reservation_id, reserved_until, supabase_token
      from public.merchant_email_otp_aliases
      where id = ${aliasId}::uuid
    `
    assert.ok(finalRow.consumed_at instanceof Date)
    assert.equal(finalRow.resolution, "verified")
    assert.equal(finalRow.reservation_id, null)
    assert.equal(finalRow.reserved_until, null)
    assert.equal(finalRow.supabase_token, "")

    const reuse = await reserveAlias(tx, fixture)
    assert.equal(reuse.status, "used")
    assert.equal(reuse.reservation_id, null)
    assert.equal(reuse.supabase_token, null)
  })
})

test("release and lease expiry recover transient or crashed verification without stale-nonce mutation", async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = aliasFixture("release")
    await createAlias(tx, fixture)

    const first = await reserveAlias(tx, fixture)
    assert.equal(first.status, "reserved")
    assert.equal(await releaseAlias(tx, first.reservation_id), true)

    const second = await reserveAlias(tx, fixture)
    assert.equal(second.status, "reserved")
    assert.notEqual(second.reservation_id, first.reservation_id)
    assert.equal(
      await finalizeAlias(tx, first.reservation_id, "verified"),
      false,
      "the released nonce cannot finalize a newer lease"
    )
    assert.equal(
      await releaseAlias(tx, first.reservation_id),
      false,
      "the released nonce cannot release a newer lease"
    )

    await tx`
      update public.merchant_email_otp_aliases
      set reserved_until = clock_timestamp() - interval '1 second'
      where reservation_id = ${second.reservation_id}::uuid
    `
    const afterCrash = await reserveAlias(tx, fixture)
    assert.equal(afterCrash.status, "reserved")
    assert.notEqual(afterCrash.reservation_id, second.reservation_id)
    assert.equal(afterCrash.supabase_token, fixture.token)
  })
})

test("purpose-scoped creation supersedes only older matching-purpose codes and reports terminal states", async () => {
  await inRolledBackTxn(async (tx) => {
    const oldSignup = {
      ...aliasFixture("old-signup", PURPOSES.signup),
      aliasCode: "610001",
    }
    const recovery = {
      ...aliasFixture("recovery", PURPOSES.recovery),
      aliasCode: "610002",
      email: oldSignup.email,
    }
    const latestSignup = {
      ...aliasFixture("latest-signup", PURPOSES.signup),
      aliasCode: "610003",
      email: oldSignup.email,
    }

    await createAlias(tx, oldSignup)
    await createAlias(tx, recovery)
    await createAlias(tx, latestSignup)

    assert.equal((await reserveAlias(tx, oldSignup)).status, "superseded")
    assert.equal((await reserveAlias(tx, recovery)).status, "reserved")
    assert.equal((await reserveAlias(tx, latestSignup)).status, "reserved")

    const [supersededRow] = await tx`
      select resolution, supabase_token
      from public.merchant_email_otp_aliases
      where email = ${oldSignup.email}
        and alias_code = ${oldSignup.aliasCode}
    `
    assert.equal(supersededRow.resolution, "superseded")
    assert.equal(supersededRow.supabase_token, "")

    const expired = aliasFixture("expired")
    const expiredId = await createAlias(tx, expired)
    await tx`
      update public.merchant_email_otp_aliases
      set expires_at = clock_timestamp() - interval '1 minute'
      where id = ${expiredId}::uuid
    `
    const expiredResult = await reserveAlias(tx, expired)
    assert.equal(expiredResult.status, "expired")
    assert.equal(expiredResult.supabase_token, null)
    const [expiredRow] = await tx`
      select resolution, supabase_token
      from public.merchant_email_otp_aliases
      where id = ${expiredId}::uuid
    `
    assert.equal(expiredRow.resolution, "expired")
    assert.equal(expiredRow.supabase_token, "")

    const rejected = aliasFixture("rejected")
    await createAlias(tx, rejected)
    const rejectedLease = await reserveAlias(tx, rejected)
    assert.equal(rejectedLease.status, "reserved")
    assert.equal(
      await finalizeAlias(tx, rejectedLease.reservation_id, "rejected"),
      true
    )
    assert.equal((await reserveAlias(tx, rejected)).status, "rejected")
    const [rejectedRow] = await tx`
      select resolution, supabase_token
      from public.merchant_email_otp_aliases
      where reservation_id is null
        and email = ${rejected.email}
        and alias_code = ${rejected.aliasCode}
    `
    assert.equal(rejectedRow.resolution, "rejected")
    assert.equal(rejectedRow.supabase_token, "")
  })
})

test("active codes stay unambiguous across signup and recovery purposes", async () => {
  await inRolledBackTxn(async (tx) => {
    const signup = {
      ...aliasFixture("cross-purpose-code", PURPOSES.signup),
      aliasCode: "615001",
    }
    const recovery = {
      ...aliasFixture("cross-purpose-recovery", PURPOSES.recovery),
      aliasCode: "615002",
      email: signup.email,
    }
    await createAlias(tx, signup)
    await createAlias(tx, recovery)

    let collisionRefused = false
    try {
      await tx.savepoint((sp) =>
        createAlias(sp, {
          ...recovery,
          aliasCode: signup.aliasCode,
          token: `${recovery.token}:collision`,
        })
      )
    } catch (error) {
      collisionRefused = error?.code === "23505"
    }

    assert.equal(
      collisionRefused,
      true,
      "one email cannot have the same live six-digit code for two purposes"
    )
    assert.equal((await reserveAlias(tx, signup)).status, "reserved")
    assert.equal(
      (await reserveAlias(tx, recovery)).status,
      "reserved",
      "the failed replacement rolls back without superseding recovery"
    )
  })
})

test("invalid-guess throttling returns a stable retry time without retaining guesses or sliding the lock", async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = aliasFixture("throttle")
    const invalidCodes = Array.from({ length: 20 }, (_, index) =>
      String(700000 + index)
    )

    for (const code of invalidCodes) {
      const result = await reserveAlias(tx, { ...fixture, aliasCode: code })
      assert.equal(result.status, "invalid")
    }

    const firstThrottle = await reserveAlias(tx, {
      ...fixture,
      aliasCode: "799998",
    })
    assert.equal(firstThrottle.status, "throttled")
    assert.ok(firstThrottle.retry_at instanceof Date)

    const secondThrottle = await reserveAlias(tx, {
      ...fixture,
      aliasCode: "799999",
    })
    assert.equal(secondThrottle.status, "throttled")
    assert.equal(
      secondThrottle.retry_at.toISOString(),
      firstThrottle.retry_at.toISOString(),
      "throttled checks do not slide the retry window"
    )

    const [attempts] = await tx`
      select
        count(*)::int as attempt_count,
        count(*) filter (where alias_code = any(${invalidCodes}))::int as raw_guess_count
      from public.merchant_email_otp_alias_attempts
      where email = ${fixture.email}
    `
    assert.equal(attempts.attempt_count, 20)
    assert.equal(
      attempts.raw_guess_count,
      0,
      "submitted aliases are not retained"
    )
  })
})

test("delivery failure revokes exactly the created alias and exposes no provider token", async () => {
  await inRolledBackTxn(async (tx) => {
    const failed = {
      ...aliasFixture("delivery-failed", PURPOSES.signup),
      aliasCode: "620001",
    }
    const recovery = {
      ...aliasFixture("delivery-control", PURPOSES.recovery),
      aliasCode: "620002",
      email: failed.email,
    }
    const failedId = await createAlias(tx, failed)
    await createAlias(tx, recovery)

    assert.equal(await revokeAlias(tx, failedId, "delivery_failed"), true)
    assert.equal(await revokeAlias(tx, failedId, "delivery_failed"), false)

    const [failedRow] = await tx`
      select resolution, supabase_token
      from public.merchant_email_otp_aliases
      where id = ${failedId}::uuid
    `
    assert.equal(failedRow.resolution, "delivery_failed")
    assert.equal(failedRow.supabase_token, "")
    assert.equal((await reserveAlias(tx, failed)).status, "invalid")
    assert.equal((await reserveAlias(tx, recovery)).status, "reserved")
  })
})

test("rolling-deploy consume cannot bypass a live new-version lease", async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = aliasFixture("mixed-version")
    await createAlias(tx, fixture)

    const lease = await reserveAlias(tx, fixture)
    assert.equal(lease.status, "reserved")
    const blockedLegacyConsume = await consumeLegacyAlias(tx, fixture)
    assert.equal(
      blockedLegacyConsume.length,
      0,
      "an older instance receives no token while a new instance owns the lease"
    )

    assert.equal(await releaseAlias(tx, lease.reservation_id), true)
    const consumed = await consumeLegacyAlias(tx, fixture)
    assert.equal(consumed.length, 1)
    assert.equal(consumed[0].supabase_token, fixture.token)

    const [row] = await tx`
      select resolution, supabase_token
      from public.merchant_email_otp_aliases
      where email = ${fixture.email}
        and alias_code = ${fixture.aliasCode}
    `
    assert.equal(row.resolution, "legacy_consumed")
    assert.equal(row.supabase_token, "")
    assert.equal((await reserveAlias(tx, fixture)).status, "used")
  })
})

test("concurrent reservations expose the token to exactly one verifier", async () => {
  const url = dbUrl()
  assert.ok(url, "SUPABASE_DB_URL is required for OTP alias DB proof")

  const setup = postgres(url, { max: 1 })
  const first = postgres(url, { max: 1 })
  const second = postgres(url, { max: 1 })
  const fixture = aliasFixture(`race-${randomUUID()}`)

  try {
    await createAlias(setup, fixture)
    const results = await Promise.all([
      reserveAlias(first, fixture),
      reserveAlias(second, fixture),
    ])

    assert.equal(
      results.filter((result) => result.status === "reserved").length,
      1,
      "only one concurrent caller receives a lease"
    )
    assert.equal(
      results.filter((result) => result.supabase_token === fixture.token)
        .length,
      1,
      "only one concurrent caller receives the encrypted token"
    )
    assert.equal(
      results.filter((result) => result.status === "busy").length,
      1,
      "the losing caller receives a bounded busy outcome"
    )
    const busy = results.find((result) => result.status === "busy")
    assert.ok(
      busy.retry_at instanceof Date,
      "busy includes the lease retry time"
    )
    assert.equal(busy.reservation_id, null)
    assert.equal(busy.supabase_token, null)
  } finally {
    await setup`
      delete from public.merchant_email_otp_alias_attempts
      where email = ${fixture.email}
    `
    await setup`
      delete from public.merchant_email_otp_aliases
      where email = ${fixture.email}
    `
    await Promise.all([
      setup.end({ timeout: 5 }),
      first.end({ timeout: 5 }),
      second.end({ timeout: 5 }),
    ])
  }
})

test("concurrent creates leave one live code and one scrubbed superseded code", async () => {
  const url = dbUrl()
  assert.ok(url, "SUPABASE_DB_URL is required for OTP alias DB proof")

  const setup = postgres(url, { max: 1 })
  const first = postgres(url, { max: 1 })
  const second = postgres(url, { max: 1 })
  const base = aliasFixture(`create-race-${randomUUID()}`)
  const firstAlias = {
    ...base,
    aliasCode: "630001",
    token: `${base.token}:first`,
  }
  const secondAlias = {
    ...base,
    aliasCode: "630002",
    token: `${base.token}:second`,
  }

  try {
    await Promise.all([
      createAlias(first, firstAlias),
      createAlias(second, secondAlias),
    ])

    const rows = await setup`
      select resolution, supabase_token
      from public.merchant_email_otp_aliases
      where email = ${base.email}
      order by alias_code
    `
    assert.equal(rows.length, 2)
    assert.equal(
      rows.filter((row) => row.resolution === null).length,
      1,
      "exactly one concurrently created code remains live"
    )
    assert.equal(
      rows.filter(
        (row) => row.resolution === "superseded" && row.supabase_token === ""
      ).length,
      1,
      "the losing code is terminal and scrubbed"
    )
  } finally {
    await setup`
      delete from public.merchant_email_otp_alias_attempts
      where email = ${base.email}
    `
    await setup`
      delete from public.merchant_email_otp_aliases
      where email = ${base.email}
    `
    await Promise.all([
      setup.end({ timeout: 5 }),
      first.end({ timeout: 5 }),
      second.end({ timeout: 5 }),
    ])
  }
})

test(
  "concurrent create and reserve share lock ordering without deadlock",
  { timeout: 3_000 },
  async () => {
    const url = dbUrl()
    assert.ok(url, "SUPABASE_DB_URL is required for OTP alias DB proof")

    const setup = postgres(url, { max: 1 })
    const creator = postgres(url, { max: 1 })
    const verifier = postgres(url, { max: 1 })
    const current = {
      ...aliasFixture(`create-reserve-${randomUUID()}`),
      aliasCode: "640001",
    }
    const replacement = {
      ...current,
      aliasCode: "640002",
      token: `${current.token}:replacement`,
    }

    try {
      await createAlias(setup, current)
      const [createdId, reservation] = await Promise.all([
        createAlias(creator, replacement),
        reserveAlias(verifier, current),
      ])

      assert.match(createdId, UUID_PATTERN)
      assert.ok(
        ["reserved", "superseded"].includes(reservation.status),
        "the exact scheduling order decides whether reserve wins, never a deadlock"
      )

      const [state] = await setup`
        select
          count(*) filter (
            where resolution is null and consumed_at is null
          )::int as live_count,
          count(*) filter (
            where resolution = 'superseded' and supabase_token = ''
          )::int as superseded_scrubbed_count
        from public.merchant_email_otp_aliases
        where email = ${current.email}
      `
      assert.equal(state.live_count, 1)
      assert.equal(state.superseded_scrubbed_count, 1)
    } finally {
      await setup`
        delete from public.merchant_email_otp_alias_attempts
        where email = ${current.email}
      `
      await setup`
        delete from public.merchant_email_otp_aliases
        where email = ${current.email}
      `
      await Promise.all([
        setup.end({ timeout: 5 }),
        creator.end({ timeout: 5 }),
        verifier.end({ timeout: 5 }),
      ])
    }
  }
)

test("email normalization and invalid finalization outcomes fail safely", async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = aliasFixture("normalization")
    const mixedEmail = `  ${fixture.email.toUpperCase()}  `
    const aliasId = await createAlias(tx, { ...fixture, email: mixedEmail })
    const [stored] = await tx`
      select email
      from public.merchant_email_otp_aliases
      where id = ${aliasId}::uuid
    `
    assert.equal(stored.email, fixture.email)

    const lease = await reserveAlias(tx, fixture)
    assert.equal(lease.status, "reserved")

    let refused = false
    try {
      await tx.savepoint(
        (sp) =>
          sp`
          select public.finalize_merchant_email_otp_alias(
            ${lease.reservation_id}::uuid,
            'not-a-real-outcome'
          )
        `
      )
    } catch (error) {
      refused =
        error?.code === "22023" ||
        /invalid alias finalization/i.test(error.message)
    }
    assert.equal(refused, true, "unknown terminal outcomes are rejected")
    assert.equal(
      await releaseAlias(tx, lease.reservation_id),
      true,
      "a rejected outcome does not consume the valid lease"
    )

    let invalidPurposeRefused = false
    try {
      await tx.savepoint((sp) =>
        reserveAlias(sp, { ...fixture, purpose: "not-a-purpose" })
      )
    } catch (error) {
      invalidPurposeRefused = error?.code === "22023"
    }
    assert.equal(invalidPurposeRefused, true, "unknown purposes are rejected")
  })
})

test("migration scrubs historical guesses and purge deletes only tombstones older than one day", async () => {
  const source = readFileSync(MIGRATION_PATH, "utf8")

  await inRolledBackTxn(async (tx) => {
    const email = `history-${randomUUID()}@example.test`
    await tx`
      insert into public.merchant_email_otp_alias_attempts (
        email,
        alias_code,
        success,
        attempted_at
      ) values (${email}, '654321', false, clock_timestamp())
    `

    const oldFixture = aliasFixture("old-tombstone")
    const recentFixture = aliasFixture("recent-tombstone")
    const oldId = await createAlias(tx, oldFixture)
    const recentId = await createAlias(tx, recentFixture)
    const oldLease = await reserveAlias(tx, oldFixture)
    const recentLease = await reserveAlias(tx, recentFixture)
    await finalizeAlias(tx, oldLease.reservation_id, "verified")
    await finalizeAlias(tx, recentLease.reservation_id, "verified")
    await tx`
      update public.merchant_email_otp_aliases
      set consumed_at = clock_timestamp() - interval '2 days'
      where id = ${oldId}::uuid
    `

    await tx.unsafe(source)
    await tx`select public.purge_merchant_email_otp_aliases(clock_timestamp())`

    const [attempt] = await tx`
      select alias_code
      from public.merchant_email_otp_alias_attempts
      where email = ${email}
    `
    assert.equal(attempt.alias_code, "[redacted]")

    const rows = await tx`
      select id
      from public.merchant_email_otp_aliases
      where id in (${oldId}::uuid, ${recentId}::uuid)
    `
    assert.equal(
      rows.some((row) => row.id === oldId),
      false,
      "terminal metadata older than one day is purged"
    )
    assert.equal(
      rows.some((row) => row.id === recentId),
      true,
      "recent terminal metadata remains diagnosable"
    )
  })
})

test("alias finalization migration replays idempotently", async () => {
  assert.ok(
    existsSync(MIGRATION_PATH),
    "alias finalization migration must exist (RED until implemented)"
  )
  const source = readFileSync(MIGRATION_PATH, "utf8")

  await inRolledBackTxn(async (tx) => {
    await tx.unsafe(source)
    await tx.unsafe(source)
  })
})

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function aliasFixture(label, purpose = PURPOSES.signup) {
  const suffix = randomUUID()
  const digits = suffix.replace(/\D/g, "").padEnd(6, "0").slice(0, 6)

  return {
    aliasCode: digits,
    email: `${label}-${suffix}@example.test`,
    expiresAt: new Date(Date.now() + 60 * 60_000),
    purpose,
    token: `v1:encrypted-provider-token:${suffix}`,
  }
}

async function createAlias(sql, fixture) {
  const [row] = await sql`
    select public.create_merchant_email_otp_alias(
      ${fixture.email},
      ${fixture.aliasCode},
      ${fixture.token},
      ${fixture.expiresAt},
      ${fixture.purpose}
    ) as alias_id
  `
  return row.alias_id
}

async function reserveAlias(sql, fixture) {
  const [row] = await sql`
    select *
    from public.reserve_merchant_email_otp_alias(
      ${fixture.email},
      ${fixture.aliasCode},
      ${fixture.purpose}
    )
  `
  return row
}

async function consumeLegacyAlias(sql, fixture) {
  return sql`
    select *
    from public.consume_merchant_email_otp_alias(
      ${fixture.email},
      ${fixture.aliasCode}
    )
  `
}

async function finalizeAlias(sql, reservationId, outcome) {
  const [row] = await sql`
    select public.finalize_merchant_email_otp_alias(
      ${reservationId}::uuid,
      ${outcome}
    ) as finalized
  `
  return row.finalized
}

async function releaseAlias(sql, reservationId) {
  const [row] = await sql`
    select public.release_merchant_email_otp_alias(
      ${reservationId}::uuid
    ) as released
  `
  return row.released
}

async function revokeAlias(sql, aliasId, outcome) {
  const [row] = await sql`
    select public.revoke_merchant_email_otp_alias(
      ${aliasId}::uuid,
      ${outcome}
    ) as revoked
  `
  return row.revoked
}

async function roleHasTablePrivilege(tx, role, table, privilege = "select") {
  const [row] = await tx`
    select has_table_privilege(
      ${role},
      ${`public.${table}`},
      ${privilege}
    ) as allowed
  `
  return row.allowed
}
