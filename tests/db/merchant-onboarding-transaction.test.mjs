import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { after, test } from "node:test"

import postgres from "postgres"

import { closeDb, db, dbUrl, inRolledBackTxn } from "./helpers/db.mjs"

const MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20260710100000_atomic_merchant_onboarding.sql"
)
const LOCAL_DB_HOSTS = new Set(["127.0.0.1", "localhost"])
const localDbUrl = resolveLocalDbUrl()
const skip = localDbUrl
  ? false
  : "merchant onboarding transaction proof requires local Supabase Postgres"

after(async () => {
  await closeDb()
})

test(
  "atomic and legacy onboarding RPCs pin ACL, search path, RLS, and durable unique invariants",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const functions = await tx`
        select
          proname,
          pg_get_function_identity_arguments(oid) as identity_arguments,
          prosecdef,
          coalesce(array_to_string(proconfig, ','), '') as function_config,
          has_function_privilege('authenticated', oid, 'execute') as authenticated_can_execute,
          has_function_privilege('service_role', oid, 'execute') as service_role_can_execute,
          has_function_privilege('anon', oid, 'execute') as anon_can_execute
        from pg_proc
        where pronamespace = 'public'::regnamespace
          and proname in (
            'complete_merchant_onboarding',
            'create_merchant_onboarding'
          )
        order by proname`

      assert.equal(
        functions.length,
        2,
        "the new atomic RPC and legacy adapter must both exist"
      )
      for (const fn of functions) {
        assert.equal(fn.prosecdef, true, `${fn.proname} is SECURITY DEFINER`)
        assert.match(
          fn.function_config,
          /search_path=(?:public, auth|"public", "auth")/,
          `${fn.proname} pins public/auth search_path`
        )
        assert.equal(
          fn.authenticated_can_execute,
          true,
          `${fn.proname}: authenticated executes`
        )
        assert.equal(
          fn.service_role_can_execute,
          true,
          `${fn.proname}: service_role executes`
        )
        assert.equal(
          fn.anon_can_execute,
          false,
          `${fn.proname}: PUBLIC/anon execute is revoked`
        )
      }

      const atomic = functions.find(
        (fn) => fn.proname === "complete_merchant_onboarding"
      )
      assert.equal(
        atomic?.identity_arguments ?? "",
        [
          "p_business_name text",
          "p_business_type text",
          "p_phone text",
          "p_location_name text",
          "p_address_line_1 text",
          "p_address_line_2 text",
          "p_address_city text",
          "p_address_postcode text",
          "p_address_provider text",
          "p_address_provider_id text",
          "p_address_source text",
          "p_latitude double precision",
          "p_longitude double precision",
          "p_geofence_radius_meters integer",
          "p_require_geofence boolean",
          "p_soft_geofence_trigger_stamp_number integer",
          "p_geofence_pin_source text",
        ].join(", "),
        "the PostgREST named-argument contract exactly matches the server action"
      )
      assert.doesNotMatch(
        atomic?.identity_arguments ?? "",
        /p_owner_user_id|p_email|p_business_slug|p_address text|p_address_country|p_geocoded_at|p_geofence_pin_updated_at/,
        "identity, slug, display address, country, and timestamps are database-owned"
      )

      const legacy = functions.find(
        (fn) => fn.proname === "create_merchant_onboarding"
      )
      assert.equal(
        legacy?.identity_arguments ?? "",
        [
          "p_owner_user_id uuid",
          "p_email text",
          "p_business_name text",
          "p_business_slug text",
          "p_business_type text",
          "p_phone text",
          "p_location_name text",
        ].join(", "),
        "the legacy seven-argument adapter remains deployment-compatible"
      )

      const indexes = await tx`
        select indexname, indexdef
        from pg_indexes
        where schemaname = 'public'
          and indexname in (
            'merchants_owner_user_id_key',
            'product_events_merchant_signed_up_once_idx',
            'audit_logs_merchant_onboarded_once_idx'
          )
        order by indexname`
      assert.deepEqual(
        indexes.map((row) => row.indexname),
        [
          "audit_logs_merchant_onboarded_once_idx",
          "merchants_owner_user_id_key",
          "product_events_merchant_signed_up_once_idx",
        ]
      )
      for (const index of indexes) {
        assert.match(index.indexdef, /CREATE UNIQUE INDEX/i)
      }
      assert.match(
        indexes.find(
          (row) =>
            row.indexname === "product_events_merchant_signed_up_once_idx"
        )?.indexdef ?? "",
        /merchant_signed_up/
      )
      assert.match(
        indexes.find(
          (row) => row.indexname === "audit_logs_merchant_onboarded_once_idx"
        )?.indexdef ?? "",
        /merchant_onboarded/
      )

      const tables = await tx`
        select relname, relrowsecurity, relforcerowsecurity
        from pg_class
        where relnamespace = 'public'::regnamespace
          and relname in (
            'merchants',
            'merchant_locations',
            'product_events',
            'audit_logs'
          )
        order by relname`
      assert.equal(tables.length, 4)
      for (const table of tables) {
        assert.equal(
          table.relrowsecurity,
          true,
          `${table.relname}: RLS enabled`
        )
        assert.equal(
          table.relforcerowsecurity,
          true,
          `${table.relname}: RLS forced`
        )
      }
    })
  }
)

test(
  "fresh onboarding atomically creates one complete merchant, primary venue, and ledger pair",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = onboardingFixture("fresh")
      await insertAuthUser(tx, fixture)

      const result = await asAuthenticated(tx, fixture.ownerUserId, (sp) =>
        completeOnboarding(sp, fixture)
      )
      assert.ok(result?.merchant_id)
      assert.ok(result?.location_id)
      assert.equal(result?.completed_now, true)

      const state = await readOnboardingState(tx, fixture)
      assertCompleteState(state, fixture, result)
    })
  }
)

test(
  "a retry repairs one legacy partial merchant and primary venue without duplicating its ledger",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = onboardingFixture("partial")
      await insertAuthUser(tx, fixture)
      const [merchant] = await tx`
        insert into public.merchants (
          owner_user_id,
          business_name,
          business_slug,
          business_type,
          email,
          status
        ) values (
          ${fixture.ownerUserId}::uuid,
          'Saved partial business',
          ${`saved-partial-${fixture.ownerUserId.slice(0, 8)}`},
          'other',
          ${fixture.email},
          'trial'
        )
        returning id::text as id`
      const [location] = await tx`
        insert into public.merchant_locations (merchant_id, name, is_primary)
        values (${merchant.id}::uuid, 'Saved partial venue', true)
        returning id::text as id`
      await seedOnboardingLedger(tx, fixture, merchant.id, location.id)

      const result = await asAuthenticated(tx, fixture.ownerUserId, (sp) =>
        completeOnboarding(sp, fixture)
      )
      assert.equal(result?.merchant_id, merchant.id)
      assert.equal(result?.location_id, location.id)
      assert.equal(result?.completed_now, true)

      const state = await readOnboardingState(tx, fixture)
      assertCompleteState(state, fixture, result)
    })
  }
)

test(
  "first complete write wins and a changed stale retry is a zero-write no-op",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = onboardingFixture("first-complete")
      await insertAuthUser(tx, fixture)

      const first = await asAuthenticated(tx, fixture.ownerUserId, (sp) =>
        completeOnboarding(sp, fixture)
      )
      const staleFixture = changedOnboardingFixture(fixture)
      const retry = await asAuthenticated(tx, fixture.ownerUserId, (sp) =>
        completeOnboarding(sp, staleFixture)
      )

      assert.equal(retry?.merchant_id, first?.merchant_id)
      assert.equal(retry?.location_id, first?.location_id)
      assert.equal(retry?.completed_now, false)
      const state = await readOnboardingState(tx, fixture)
      assertCompleteState(state, fixture, first)
      assert.notEqual(
        state.merchant?.business_name,
        staleFixture.businessName,
        "stale retry cannot overwrite the completed business profile"
      )
      assert.notEqual(
        state.location?.name,
        staleFixture.locationName,
        "stale retry cannot overwrite the completed primary venue"
      )
    })
  }
)

test(
  "a canonical complete row missing its historical ledger is reconciled without overwriting data",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = onboardingFixture("complete-ledger-repair")
      await insertAuthUser(tx, fixture)

      const first = await asAuthenticated(tx, fixture.ownerUserId, (sp) =>
        completeOnboarding(sp, fixture)
      )
      await tx`
        delete from public.audit_logs
        where merchant_id = ${first.merchant_id}::uuid
          and action = 'merchant_onboarded'`
      await tx`
        delete from public.product_events
        where merchant_id = ${first.merchant_id}::uuid
          and event_name = 'merchant_signed_up'`

      const staleFixture = changedOnboardingFixture(fixture)
      const repaired = await asAuthenticated(tx, fixture.ownerUserId, (sp) =>
        completeOnboarding(sp, staleFixture)
      )

      assert.equal(repaired.merchant_id, first.merchant_id)
      assert.equal(repaired.location_id, first.location_id)
      assert.equal(repaired.completed_now, false)
      const state = await readOnboardingState(tx, fixture)
      assertCompleteState(state, fixture, first)
      assert.notEqual(state.merchant?.business_name, staleFixture.businessName)
      assert.notEqual(state.location?.name, staleFixture.locationName)
    })
  }
)

test(
  "an owner-scoped audit failure rolls back merchant, venue, product event, and audit writes",
  { skip },
  async () => {
    const fixture = onboardingFixture("rollback")
    const setup = db()
    // Commit the owner-scoped trigger before opening the proof transaction.
    // PostgreSQL otherwise retains the trigger's ACCESS EXCLUSIVE table lock
    // until rollback, which can deadlock unrelated DB-test files that insert
    // audit rows in parallel. The random owner predicate keeps the committed
    // trigger inert for every other test, and finally removes it exactly.
    const fault = await installOwnerScopedAuditFailure(
      setup,
      fixture.ownerUserId
    )

    try {
      await inRolledBackTxn(async (tx) => {
        await insertAuthUser(tx, fixture)
        const failure = await captureFailure(() =>
          asAuthenticated(tx, fixture.ownerUserId, (sp) =>
            completeOnboarding(sp, fixture)
          )
        )
        assert.match(failure, /owner-scoped onboarding audit failure/i)

        const state = await readOnboardingState(tx, fixture)
        assert.equal(state.merchantCount, 0)
        assert.equal(state.locationCount, 0)
        assert.equal(state.productEventCount, 0)
        assert.equal(state.auditCount, 0)
      })
    } finally {
      await removeOwnerScopedAuditFailure(setup, fault)
    }
  }
)

test(
  "missing and anonymous atomic calls plus a mismatched legacy owner are denied before tenant writes",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const owner = onboardingFixture("auth-owner")
      const outsider = onboardingFixture("auth-outsider")
      await insertAuthUser(tx, owner)
      await insertAuthUser(tx, outsider)

      const missing = await captureFailure(() =>
        asAuthenticated(tx, null, (sp) => completeOnboarding(sp, owner))
      )
      assert.match(missing, /auth|owner|privilege|permission/i)

      const anonymous = await captureFailure(() =>
        asAnon(tx, (sp) => completeOnboarding(sp, owner))
      )
      assert.match(anonymous, /permission|execute|privilege/i)

      const legacyMismatch = await captureFailure(() =>
        asAuthenticated(tx, outsider.ownerUserId, (sp) =>
          createLegacyOnboarding(sp, owner)
        )
      )
      assert.match(legacyMismatch, /owner|mismatch|privilege|permission/i)

      const state = await readOnboardingState(tx, owner)
      assert.equal(state.merchantCount, 0)
      assert.equal(state.locationCount, 0)
      assert.equal(state.productEventCount, 0)
      assert.equal(state.auditCount, 0)
    })
  }
)

test(
  "owner table reads succeed while an authenticated outsider cannot see or mutate onboarding state",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const owner = onboardingFixture("rls-owner")
      const outsider = onboardingFixture("rls-outsider")
      await insertAuthUser(tx, owner)
      await insertAuthUser(tx, outsider)
      const result = await asAuthenticated(tx, owner.ownerUserId, (sp) =>
        completeOnboarding(sp, owner)
      )

      const ownerVisibility = await asAuthenticated(
        tx,
        owner.ownerUserId,
        (sp) => readOnboardingVisibility(sp, result.merchant_id)
      )
      assert.deepEqual(ownerVisibility, {
        audits: 1,
        events: 1,
        locations: 1,
        merchants: 1,
      })

      const outsiderVisibility = await asAuthenticated(
        tx,
        outsider.ownerUserId,
        (sp) => readOnboardingVisibility(sp, result.merchant_id)
      )
      assert.deepEqual(outsiderVisibility, {
        audits: 0,
        events: 0,
        locations: 0,
        merchants: 0,
      })

      const outsiderMerchantUpdates = await asAuthenticated(
        tx,
        outsider.ownerUserId,
        (sp) => sp`
          update public.merchants
          set business_name = 'Cross-owner overwrite'
          where id = ${result.merchant_id}::uuid
          returning id`
      )
      assert.equal(outsiderMerchantUpdates.length, 0)

      const outsiderLocationUpdates = await asAuthenticated(
        tx,
        outsider.ownerUserId,
        (sp) => sp`
          update public.merchant_locations
          set name = 'Cross-owner venue overwrite'
          where merchant_id = ${result.merchant_id}::uuid
          returning id`
      )
      assert.equal(outsiderLocationUpdates.length, 0)

      const eventInsertFailure = await captureFailure(() =>
        asAuthenticated(
          tx,
          outsider.ownerUserId,
          (sp) => sp`
          insert into public.product_events (
            event_name,
            merchant_id,
            actor_type,
            actor_id
          ) values (
            'merchant_signed_up',
            ${result.merchant_id}::uuid,
            'merchant',
            ${outsider.ownerUserId}
          )`
        )
      )
      assert.match(eventInsertFailure, /row-level security|policy/i)

      const auditInsertFailure = await captureFailure(() =>
        asAuthenticated(
          tx,
          outsider.ownerUserId,
          (sp) => sp`
          insert into public.audit_logs (
            actor_type,
            actor_id,
            merchant_id,
            target_table,
            target_id,
            action
          ) values (
            'merchant',
            ${outsider.ownerUserId},
            ${result.merchant_id}::uuid,
            'merchants',
            ${result.merchant_id}::uuid,
            'merchant_onboarded'
          )`
        )
      )
      assert.match(auditInsertFailure, /row-level security|policy/i)
    })
  }
)

test(
  "a readable slug collision falls back deterministically without crossing owners",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = onboardingFixture("slug-fallback")
      const blocker = onboardingFixture("slug-blocker")
      await insertAuthUser(tx, fixture)
      await insertAuthUser(tx, blocker)
      const firstCandidate = expectedReadableSlug(fixture)
      await tx`
        insert into public.merchants (
          owner_user_id,
          business_name,
          business_slug,
          business_type,
          email,
          status
        ) values (
          ${blocker.ownerUserId}::uuid,
          'Slug namespace blocker',
          ${firstCandidate},
          'other',
          ${blocker.email},
          'trial'
        )`

      const result = await asAuthenticated(tx, fixture.ownerUserId, (sp) =>
        completeOnboarding(sp, fixture)
      )
      const [merchant] = await tx`
        select business_slug
        from public.merchants
        where id = ${result.merchant_id}::uuid`

      assert.notEqual(merchant.business_slug, firstCandidate)
      assert.match(
        merchant.business_slug,
        new RegExp(`^${slugify(fixture.businessName)}-`)
      )
      assert.match(
        merchant.business_slug.replaceAll("-", ""),
        new RegExp(fixture.ownerUserId.replaceAll("-", ""), "i")
      )
    })
  }
)

test(
  "two concurrent atomic calls return one merchant, one primary venue, and one ledger pair",
  { skip, timeout: 10_000 },
  async () => {
    const fixture = onboardingFixture("new-new-race")
    const setup = db()
    await insertAuthUser(setup, fixture)

    try {
      const startTogether = createStartBarrier(2)
      const [first, second] = await allFulfilled([
        callOnDedicatedConnection(
          fixture,
          (sql) => completeOnboarding(sql, fixture),
          startTogether
        ),
        callOnDedicatedConnection(
          fixture,
          (sql) => completeOnboarding(sql, fixture),
          startTogether
        ),
      ])

      assert.equal(first.merchant_id, second.merchant_id)
      assert.equal(first.location_id, second.location_id)
      assert.deepEqual([first.completed_now, second.completed_now].sort(), [
        false,
        true,
      ])
      assertCompleteState(
        await readOnboardingState(setup, fixture),
        fixture,
        first
      )
    } finally {
      await cleanupCommittedFixture(setup, fixture)
    }
  }
)

test(
  "legacy and atomic calls share lock ordering and converge on one complete onboarding",
  { skip, timeout: 10_000 },
  async () => {
    const fixture = onboardingFixture("legacy-new-race")
    const setup = db()
    await insertAuthUser(setup, fixture)

    try {
      const startTogether = createStartBarrier(2)
      const [legacy, atomic] = await allFulfilled([
        callOnDedicatedConnection(
          fixture,
          (sql) => createLegacyOnboarding(sql, fixture),
          startTogether
        ),
        callOnDedicatedConnection(
          fixture,
          (sql) => completeOnboarding(sql, fixture),
          startTogether
        ),
      ])

      assert.equal(legacy.merchant_id, atomic.merchant_id)
      assert.equal(legacy.location_id, atomic.location_id)
      assertCompleteState(
        await readOnboardingState(setup, fixture),
        fixture,
        atomic
      )
    } finally {
      await cleanupCommittedFixture(setup, fixture)
    }
  }
)

test(
  "atomic onboarding migration replays and committed fixture cleanup has exact zero readback",
  { skip },
  async () => {
    assert.ok(
      existsSync(MIGRATION_PATH),
      "atomic onboarding migration must exist (RED until implemented)"
    )
    const source = readFileSync(MIGRATION_PATH, "utf8")

    await inRolledBackTxn(async (tx) => {
      await tx.unsafe(source)
      await tx.unsafe(source)
    })

    const fixture = onboardingFixture("cleanup")
    const setup = db()
    await insertAuthUser(setup, fixture)
    await callOnDedicatedConnection(fixture, (sql) =>
      completeOnboarding(sql, fixture)
    )
    await cleanupCommittedFixture(setup, fixture)
    await assertCommittedFixtureClean(setup, fixture)
  }
)

test(
  "migration replay rejects a same-named partial unique index with a weaker predicate",
  { skip },
  async () => {
    assert.ok(existsSync(MIGRATION_PATH))
    const source = readFileSync(MIGRATION_PATH, "utf8")

    await inRolledBackTxn(async (tx) => {
      const failure = await captureFailure(() =>
        tx.savepoint(async (sp) => {
          await sp`
            drop index public.product_events_merchant_signed_up_once_idx`
          await sp`
            create unique index product_events_merchant_signed_up_once_idx
            on public.product_events (merchant_id)
            where merchant_id is not null
              and event_name = 'merchant_signed_up'
              and false`
          await sp.unsafe(source)
        })
      )

      assert.match(
        failure,
        /product_events_merchant_signed_up_once_idx exists with an incompatible definition/i
      )
    })
  }
)

function onboardingFixture(label) {
  const runId = randomUUID()
  const compact = runId.replaceAll("-", "")
  return {
    ownerUserId: runId,
    email: `merchant-onboarding-${label}-${compact}@example.test`,
    businessName: `Atomic Crown ${label} ${compact.slice(0, 6)}`,
    businessType: "pub",
    phone: "+441223555010",
    locationName: `Atomic Crown ${label} Bar`,
    address: "10 King Street, Cambridge, CB1 1AA",
    addressLine1: "10 King Street",
    addressLine2: null,
    addressCity: "Cambridge",
    addressPostcode: "CB1 1AA",
    addressCountry: "GB",
    addressProvider: null,
    addressProviderId: null,
    addressSource: "manual_entry",
    latitude: 52.2053,
    longitude: 0.1218,
    geofenceRadiusMeters: 150,
    requireGeofence: false,
    softGeofenceTriggerStamp: 3,
    geofencePinSource: "geocoded",
  }
}

function changedOnboardingFixture(fixture) {
  return {
    ...fixture,
    businessName: `Stale overwrite ${fixture.ownerUserId.slice(0, 8)}`,
    businessType: "cafe",
    phone: "+441223555099",
    locationName: "Stale overwrite venue",
    address: "99 Stale Road, Ely, CB7 4AA",
    addressLine1: "99 Stale Road",
    addressCity: "Ely",
    addressPostcode: "CB7 4AA",
    latitude: 52.3995,
    longitude: 0.2624,
  }
}

async function insertAuthUser(sql, fixture) {
  await sql`
    insert into auth.users (
      id,
      email,
      aud,
      role,
      email_confirmed_at,
      created_at,
      updated_at
    ) values (
      ${fixture.ownerUserId}::uuid,
      ${fixture.email},
      'authenticated',
      'authenticated',
      now(),
      now(),
      now()
    )`
}

async function completeOnboarding(sql, fixture) {
  const [row] = await sql`
    select
      merchant_id::text as merchant_id,
      location_id::text as location_id,
      completed_now
    from public.complete_merchant_onboarding(
      ${fixture.businessName},
      ${fixture.businessType},
      ${fixture.phone},
      ${fixture.locationName},
      ${fixture.addressLine1},
      ${fixture.addressLine2},
      ${fixture.addressCity},
      ${fixture.addressPostcode},
      ${fixture.addressProvider},
      ${fixture.addressProviderId},
      ${fixture.addressSource},
      ${fixture.latitude},
      ${fixture.longitude},
      ${fixture.geofenceRadiusMeters},
      ${fixture.requireGeofence},
      ${fixture.softGeofenceTriggerStamp},
      ${fixture.geofencePinSource}
    )`
  assert.ok(row, "atomic onboarding RPC returns one result row")
  return row
}

async function createLegacyOnboarding(sql, fixture) {
  const [row] = await sql`
    select
      merchant_id::text as merchant_id,
      location_id::text as location_id
    from public.create_merchant_onboarding(
      ${fixture.ownerUserId}::uuid,
      ${fixture.email},
      ${fixture.businessName},
      ${expectedReadableSlug(fixture)},
      ${fixture.businessType},
      ${fixture.phone},
      ${fixture.locationName}
    )`
  assert.ok(row, "legacy onboarding adapter returns one result row")
  return row
}

async function seedOnboardingLedger(sql, fixture, merchantId, locationId) {
  await sql`
    insert into public.product_events (
      event_name,
      merchant_id,
      actor_type,
      actor_id,
      metadata
    ) values (
      'merchant_signed_up',
      ${merchantId}::uuid,
      'merchant',
      ${fixture.ownerUserId},
      jsonb_build_object('source', 'onboarding')
    )`
  await sql`
    insert into public.audit_logs (
      actor_type,
      actor_id,
      merchant_id,
      target_table,
      target_id,
      action,
      metadata
    ) values (
      'merchant',
      ${fixture.ownerUserId},
      ${merchantId}::uuid,
      'merchants',
      ${merchantId}::uuid,
      'merchant_onboarded',
      jsonb_build_object('location_id', ${locationId}::uuid)
    )`
}

async function readOnboardingState(sql, fixture) {
  const merchants = await sql`
    select
      id::text as id,
      business_name,
      business_slug,
      business_type,
      email,
      phone,
      status,
      requires_billing
    from public.merchants
    where owner_user_id = ${fixture.ownerUserId}::uuid
    order by created_at, id`
  const merchantIds = merchants.map((row) => row.id)
  const locations = merchantIds.length
    ? await sql`
        select
          id::text as id,
          merchant_id::text as merchant_id,
          name,
          address,
          address_line_1,
          address_line_2,
          address_city,
          address_postcode,
          address_country,
          address_provider,
          address_provider_id,
          address_source,
          latitude::float8 as latitude,
          longitude::float8 as longitude,
          geofence_radius_meters,
          require_geofence,
          soft_geofence_trigger_stamp_number,
          geocoded_at::text as geocoded_at,
          geofence_pin_source,
          geofence_pin_updated_at::text as geofence_pin_updated_at,
          is_primary
        from public.merchant_locations
        where merchant_id = any(${merchantIds}::uuid[])
        order by is_primary desc, created_at, id`
    : []
  const [product] = await sql`
    select count(*)::int as count
    from public.product_events
    where actor_id = ${fixture.ownerUserId}
      and event_name = 'merchant_signed_up'`
  const [audit] = await sql`
    select count(*)::int as count
    from public.audit_logs
    where actor_id = ${fixture.ownerUserId}
      and action = 'merchant_onboarded'`

  return {
    merchantCount: merchants.length,
    locationCount: locations.length,
    merchant: merchants.at(0),
    location: locations.at(0),
    productEventCount: product?.count ?? 0,
    auditCount: audit?.count ?? 0,
  }
}

async function readOnboardingVisibility(sql, merchantId) {
  const [row] = await sql`
    select
      (select count(*)::int from public.merchants
       where id = ${merchantId}::uuid) as merchants,
      (select count(*)::int from public.merchant_locations
       where merchant_id = ${merchantId}::uuid) as locations,
      (select count(*)::int from public.product_events
       where merchant_id = ${merchantId}::uuid
         and event_name = 'merchant_signed_up') as events,
      (select count(*)::int from public.audit_logs
       where merchant_id = ${merchantId}::uuid
         and action = 'merchant_onboarded') as audits`

  return row
}

function assertCompleteState(state, fixture, result) {
  assert.equal(state.merchantCount, 1)
  assert.equal(state.locationCount, 1)
  assert.deepEqual(
    {
      id: state.merchant?.id,
      business_name: state.merchant?.business_name,
      business_type: state.merchant?.business_type,
      email: state.merchant?.email,
      phone: state.merchant?.phone,
      status: state.merchant?.status,
      requires_billing: state.merchant?.requires_billing,
    },
    {
      id: result.merchant_id,
      business_name: fixture.businessName,
      business_type: fixture.businessType,
      email: fixture.email,
      phone: fixture.phone,
      status: "trial",
      requires_billing: true,
    }
  )
  assert.deepEqual(
    {
      id: state.location?.id,
      merchant_id: state.location?.merchant_id,
      name: state.location?.name,
      address: state.location?.address,
      address_line_1: state.location?.address_line_1,
      address_line_2: state.location?.address_line_2,
      address_city: state.location?.address_city,
      address_postcode: state.location?.address_postcode,
      address_country: state.location?.address_country,
      address_provider: state.location?.address_provider,
      address_provider_id: state.location?.address_provider_id,
      address_source: state.location?.address_source,
      latitude: state.location?.latitude,
      longitude: state.location?.longitude,
      geofence_radius_meters: state.location?.geofence_radius_meters,
      require_geofence: state.location?.require_geofence,
      soft_geofence_trigger_stamp_number:
        state.location?.soft_geofence_trigger_stamp_number,
      geofence_pin_source: state.location?.geofence_pin_source,
      is_primary: state.location?.is_primary,
    },
    {
      id: result.location_id,
      merchant_id: result.merchant_id,
      name: fixture.businessName,
      address: fixture.address,
      address_line_1: fixture.addressLine1,
      address_line_2: fixture.addressLine2,
      address_city: fixture.addressCity,
      address_postcode: fixture.addressPostcode,
      address_country: fixture.addressCountry,
      address_provider: fixture.addressProvider,
      address_provider_id: fixture.addressProviderId,
      address_source: fixture.addressSource,
      latitude: fixture.latitude,
      longitude: fixture.longitude,
      geofence_radius_meters: fixture.geofenceRadiusMeters,
      require_geofence: fixture.requireGeofence,
      soft_geofence_trigger_stamp_number: fixture.softGeofenceTriggerStamp,
      geofence_pin_source: fixture.geofencePinSource,
      is_primary: true,
    }
  )
  assert.ok(state.location?.geocoded_at)
  assert.ok(state.location?.geofence_pin_updated_at)
  assert.equal(state.productEventCount, 1)
  assert.equal(state.auditCount, 1)
}

async function asAuthenticated(tx, userId, fn) {
  return tx.savepoint(async (sp) => {
    await sp`set local role authenticated`
    await sp`select set_config('request.jwt.claim.role', 'authenticated', true)`
    await sp`select set_config('request.jwt.claim.sub', ${userId ?? ""}, true)`
    const result = await fn(sp)
    await sp`reset role`
    await sp`select set_config('request.jwt.claim.role', 'service_role', true)`
    await sp`select set_config('request.jwt.claim.sub', '', true)`
    return result
  })
}

async function asAnon(tx, fn) {
  return tx.savepoint(async (sp) => {
    await sp`set local role anon`
    await sp`select set_config('request.jwt.claim.role', 'anon', true)`
    await sp`select set_config('request.jwt.claim.sub', '', true)`
    const result = await fn(sp)
    await sp`reset role`
    await sp`select set_config('request.jwt.claim.role', 'service_role', true)`
    return result
  })
}

async function callOnDedicatedConnection(fixture, fn, start = async () => {}) {
  assert.ok(localDbUrl)
  const sql = postgres(localDbUrl, { max: 1 })
  try {
    return await sql.begin(async (tx) => {
      await tx`set local role authenticated`
      await tx`select set_config('request.jwt.claim.role', 'authenticated', true)`
      await tx`select set_config('request.jwt.claim.sub', ${fixture.ownerUserId}, true)`
      await start()
      return fn(tx)
    })
  } finally {
    await sql.end({ timeout: 5 })
  }
}

function createStartBarrier(participantCount) {
  let arrived = 0
  let release
  const opened = new Promise((resolve) => {
    release = resolve
  })

  return async () => {
    arrived += 1
    if (arrived === participantCount) release()
    await opened
  }
}

async function installOwnerScopedAuditFailure(sql, ownerUserId) {
  const suffix = randomUUID().replaceAll("-", "")
  const functionName = `test_onboarding_audit_failure_${suffix}`
  const triggerName = `test_onboarding_audit_failure_${suffix}`
  await sql.unsafe(`
    create function public.${functionName}()
    returns trigger
    language plpgsql
    set search_path = public
    as $function$
    begin
      if new.action = 'merchant_onboarded'
        and new.actor_id = '${ownerUserId}' then
        raise exception 'owner-scoped onboarding audit failure';
      end if;
      return new;
    end;
    $function$;

    create trigger ${triggerName}
      before insert on public.audit_logs
      for each row execute function public.${functionName}();
  `)
  return { functionName, triggerName }
}

async function removeOwnerScopedAuditFailure(sql, fault) {
  await sql.unsafe(`
    drop trigger if exists ${fault.triggerName} on public.audit_logs;
    drop function if exists public.${fault.functionName}();
  `)
}

async function cleanupCommittedFixture(sql, fixture) {
  await sql`
    delete from public.audit_logs
    where actor_id = ${fixture.ownerUserId}
       or merchant_id in (
         select id from public.merchants
         where owner_user_id = ${fixture.ownerUserId}::uuid
       )`
  await sql`
    delete from public.product_events
    where actor_id = ${fixture.ownerUserId}
       or merchant_id in (
         select id from public.merchants
         where owner_user_id = ${fixture.ownerUserId}::uuid
       )`
  await sql`
    delete from public.merchants
    where owner_user_id = ${fixture.ownerUserId}::uuid`
  await sql`
    delete from auth.users
    where id = ${fixture.ownerUserId}::uuid`

  await assertCommittedFixtureClean(sql, fixture)
}

async function assertCommittedFixtureClean(sql, fixture) {
  const [row] = await sql`
    select
      (select count(*)::int from auth.users
       where id = ${fixture.ownerUserId}::uuid) as user_count,
      (select count(*)::int from public.merchants
       where owner_user_id = ${fixture.ownerUserId}::uuid) as merchant_count,
      (select count(*)::int from public.merchant_locations locations
       join public.merchants merchants on merchants.id = locations.merchant_id
       where merchants.owner_user_id = ${fixture.ownerUserId}::uuid) as location_count,
      (select count(*)::int from public.product_events
       where actor_id = ${fixture.ownerUserId}) as product_event_count,
      (select count(*)::int from public.audit_logs
       where actor_id = ${fixture.ownerUserId}) as audit_count`
  assert.deepEqual(row, {
    user_count: 0,
    merchant_count: 0,
    location_count: 0,
    product_event_count: 0,
    audit_count: 0,
  })
}

async function captureFailure(fn) {
  try {
    await fn()
    return ""
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

async function allFulfilled(promises) {
  const results = await Promise.allSettled(promises)
  const failure = results.find((result) => result.status === "rejected")
  if (failure?.status === "rejected") throw failure.reason
  return results.map((result) => {
    assert.equal(result.status, "fulfilled")
    return result.value
  })
}

function expectedReadableSlug(fixture) {
  return `${slugify(fixture.businessName)}-${fixture.ownerUserId.slice(0, 8)}`
}

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
}

function resolveLocalDbUrl() {
  const rawUrl = dbUrl()?.trim()
  if (!rawUrl) return undefined

  try {
    const url = new URL(rawUrl)
    return LOCAL_DB_HOSTS.has(url.hostname) &&
      ["postgres:", "postgresql:"].includes(url.protocol)
      ? rawUrl
      : undefined
  } catch {
    return undefined
  }
}
