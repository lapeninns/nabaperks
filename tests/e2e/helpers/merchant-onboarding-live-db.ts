import { randomUUID } from "node:crypto"

import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { expect, type BrowserContext, type Page } from "@playwright/test"

import { connectLocalDb, type Sql } from "./admin-live-db"

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"])
const DEFAULT_BROWSER_URL = "http://127.0.0.1:3146"
const AUDIT_FAULT_TABLE = "merchant_onboarding_e2e_audit_faults"
const AUDIT_FAULT_FUNCTION = "fail_merchant_onboarding_e2e_audit"
const AUDIT_FAULT_TRIGGER = "fail_merchant_onboarding_e2e_audit"

type BrowserCookie = Parameters<BrowserContext["addCookies"]>[0][number]

type SupabaseCookieOptions = {
  readonly expires?: Date
  readonly httpOnly?: boolean
  readonly maxAge?: number
  readonly path?: string
  readonly sameSite?: boolean | "lax" | "strict" | "none"
  readonly secure?: boolean
}

type SupabaseCookie = {
  readonly name: string
  readonly value: string
  readonly options: SupabaseCookieOptions
}

type StoredCookie = {
  readonly value: string
  readonly options: SupabaseCookieOptions
}

export type MerchantOnboardingExpectedState = Readonly<{
  address: string
  addressCity: string
  addressCountry: string
  addressLine1: string
  addressLine2: string | null
  addressPostcode: string
  addressProvider: string | null
  addressProviderId: string | null
  addressSource: "manual_entry" | "provider_lookup"
  businessName: string
  businessSlug: string
  businessType: string
  geofencePinSource: "geocoded" | "merchant_pin"
  geofenceRadiusMeters: number
  latitude?: number
  locationName: string
  longitude?: number
  phone: string | null
  requireGeofence: boolean
  softGeofenceTriggerStamp: number
}>

export type MerchantOnboardingLiveDbFixture = Readonly<{
  email: string
  expected: MerchantOnboardingExpectedState
  name: string
  userId: string
}>

export type MerchantOnboardingDbState = Readonly<{
  address: string | null
  addressCity: string | null
  addressCountry: string | null
  addressLine1: string | null
  addressLine2: string | null
  addressPostcode: string | null
  addressProvider: string | null
  addressProviderId: string | null
  addressSource: string | null
  auditActorId: string | null
  auditCount: number
  auditLocationId: string | null
  auditTargetId: string | null
  auditTargetTable: string | null
  authUserCount: number
  businessName: string | null
  businessSlug: string | null
  businessType: string | null
  email: string | null
  emailConfirmedAt: string | null
  geocodedAt: string | null
  geofencePinSource: string | null
  geofencePinUpdatedAt: string | null
  geofenceRadiusMeters: number | null
  latitude: number | null
  locationCount: number
  locationId: string | null
  locationName: string | null
  longitude: number | null
  merchantCount: number
  merchantId: string | null
  phone: string | null
  primaryLocationCount: number
  productEventActorId: string | null
  productEventCount: number
  productEventSource: string | null
  requireGeofence: boolean | null
  requiresBilling: boolean | null
  softGeofenceTriggerStamp: number | null
  status: string | null
}>

type DbStateRow = Readonly<{
  address: string | null
  address_city: string | null
  address_country: string | null
  address_line_1: string | null
  address_line_2: string | null
  address_postcode: string | null
  address_provider: string | null
  address_provider_id: string | null
  address_source: string | null
  audit_actor_id: string | null
  audit_count: number
  audit_location_id: string | null
  audit_target_id: string | null
  audit_target_table: string | null
  auth_user_count: number
  business_name: string | null
  business_slug: string | null
  business_type: string | null
  email: string | null
  email_confirmed_at: string | null
  geocoded_at: string | null
  geofence_pin_source: string | null
  geofence_pin_updated_at: string | null
  geofence_radius_meters: number | null
  latitude: number | null
  location_count: number
  location_id: string | null
  location_name: string | null
  longitude: number | null
  merchant_count: number
  merchant_id: string | null
  phone: string | null
  primary_location_count: number
  product_event_actor_id: string | null
  product_event_count: number
  product_event_source: string | null
  require_geofence: boolean | null
  requires_billing: boolean | null
  soft_geofence_trigger_stamp: number | null
  status: string | null
}>

type ConfirmedUserRow = Readonly<{
  email_confirmed_at: string | null
}>

type MerchantIdRow = Readonly<{
  id: string
}>

type RemovalStateRow = Readonly<{
  audit_fault_function: boolean
  audit_fault_rows: number
  audit_fault_table: boolean
  audit_fault_triggers: number
  audits: number
  locations: number
  merchants: number
  product_events: number
  sessions: number
  users: number
}>

export function merchantOnboardingLiveDbSkipReason(): string | undefined {
  if (process.env.MERCHANT_ONBOARDING_LIVE_DB_E2E !== "1") {
    return "set MERCHANT_ONBOARDING_LIVE_DB_E2E=1 with local Supabase to run merchant onboarding proof"
  }
  if (process.env.PLAYWRIGHT_WORKERS !== "1") {
    return "set PLAYWRIGHT_WORKERS=1 for owner-scoped merchant onboarding fault proof"
  }
  if (!localHttpUrl(process.env.PLAYWRIGHT_BASE_URL ?? DEFAULT_BROWSER_URL)) {
    return "PLAYWRIGHT_BASE_URL must point at a local browser server"
  }
  if (!localHttpUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)) {
    return "NEXT_PUBLIC_SUPABASE_URL must point at the local Supabase API"
  }
  if (!localPostgresUrl(process.env.SUPABASE_DB_URL)) {
    return "SUPABASE_DB_URL must point at local Supabase Postgres"
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
    return "NEXT_PUBLIC_SUPABASE_ANON_KEY is required for merchant onboarding proof"
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return "SUPABASE_SERVICE_ROLE_KEY is required for merchant onboarding proof"
  }
  return undefined
}

export function connectMerchantOnboardingDb(): Sql | undefined {
  if (merchantOnboardingLiveDbSkipReason()) return undefined
  return connectLocalDb()
}

export async function createMerchantOnboardingLiveDbFixture(
  sql: Sql,
  context: BrowserContext
): Promise<MerchantOnboardingLiveDbFixture> {
  assertLiveDbOptIn()

  const runId = randomUUID().replaceAll("-", "")
  const email = `merchant-onboarding-${runId.slice(0, 18)}@example.test`
  const password = `Nabaperks-${randomUUID()}-1!`
  const name = `Live onboarding ${runId.slice(0, 8)}`
  const admin = serviceRoleClient()
  let userId: string | undefined

  try {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    })
    if (created.error || !created.data.user) {
      throw new Error("Local merchant onboarding auth-user creation failed.")
    }
    userId = created.data.user.id

    const confirmed = await sql<readonly ConfirmedUserRow[]>`
      select email_confirmed_at::text as email_confirmed_at
      from auth.users
      where id = ${userId}::uuid`
    if (!confirmed.at(0)?.email_confirmed_at) {
      throw new Error("Local merchant onboarding auth user was not confirmed.")
    }

    const cookieJar = new Map<string, StoredCookie>()
    const browserAuth = createServerClient(
      requiredLocalSupabaseUrl(),
      requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      {
        cookies: {
          getAll() {
            return Array.from(cookieJar, ([cookieName, cookie]) => ({
              name: cookieName,
              value: cookie.value,
            }))
          },
          setAll(cookiesToSet: SupabaseCookie[]) {
            for (const cookie of cookiesToSet) {
              if (cookie.value) {
                cookieJar.set(cookie.name, {
                  value: cookie.value,
                  options: cookie.options,
                })
              } else {
                cookieJar.delete(cookie.name)
              }
            }
          },
        },
      }
    )
    const signIn = await browserAuth.auth.signInWithPassword({
      email,
      password,
    })
    if (
      signIn.error ||
      signIn.data.user?.id !== userId ||
      !signIn.data.session
    ) {
      throw new Error("Local merchant onboarding browser sign-in failed.")
    }

    await context.addCookies(
      Array.from(cookieJar, ([cookieName, cookie]) =>
        browserCookie(cookieName, cookie)
      )
    )

    const businessName = `Live Merchant ${runId.slice(0, 8)}`
    const addressProviderId = `test-place-${runId}`
    const fixture: MerchantOnboardingLiveDbFixture = {
      email,
      name,
      userId,
      expected: {
        address: "15 Market Street, Cambridge, CB2 3PA",
        addressCity: "Cambridge",
        addressCountry: "GB",
        addressLine1: "15 Market Street",
        addressLine2: null,
        addressPostcode: "CB2 3PA",
        addressProvider: "google_places",
        addressProviderId,
        addressSource: "provider_lookup",
        businessName,
        businessSlug: `${slugify(businessName)}-${userId.slice(0, 8)}`,
        businessType: "pub",
        geofencePinSource: "geocoded",
        geofenceRadiusMeters: 150,
        latitude: 52.2053,
        locationName: businessName,
        longitude: 0.1218,
        phone: "+44 7700 900123",
        requireGeofence: false,
        softGeofenceTriggerStamp: 3,
      },
    }

    await assertMerchantOnboardingBrowserSession(context, fixture)
    return fixture
  } catch (error) {
    if (userId) {
      const deleted = await admin.auth.admin.deleteUser(userId)
      if (deleted.error) {
        throw new AggregateError(
          [
            asError("fixture creation", error),
            asError("partial user cleanup", deleted.error),
          ],
          "Merchant onboarding fixture creation and cleanup failed."
        )
      }
    }
    throw error
  }
}

export async function assertMerchantOnboardingBrowserSession(
  browser: BrowserContext | Page,
  fixture: MerchantOnboardingLiveDbFixture,
  expectedPath?: string
): Promise<void> {
  const context = "context" in browser ? browser.context() : browser
  const cookies = await context.cookies()
  const authCookies = cookies.filter((cookie) =>
    /^sb-.+-auth-token(?:\.\d+)?$/.test(cookie.name)
  )

  expect(authCookies.length).toBeGreaterThan(0)
  if ("context" in browser && expectedPath) {
    const currentUrl = new URL(browser.url())
    expect(`${currentUrl.pathname}${currentUrl.search}`).toBe(expectedPath)
  }

  const auth = createServerClient(
    requiredLocalSupabaseUrl(),
    requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookies.map(({ name: cookieName, value }) => ({
            name: cookieName,
            value,
          }))
        },
        setAll() {
          // Read-only assertion: Playwright owns the browser cookie jar.
        },
      },
    }
  )
  const currentUser = await auth.auth.getUser()

  expect(currentUser.error).toBeNull()
  expect(currentUser.data.user?.id).toBe(fixture.userId)
  expect(currentUser.data.user?.email).toBe(fixture.email)
}

export async function installMerchantOnboardingAuditFailure(
  sql: Sql,
  fixture: MerchantOnboardingLiveDbFixture
): Promise<void> {
  assertLiveDbOptIn()

  await sql`
    create table if not exists public.merchant_onboarding_e2e_audit_faults (
      owner_user_id uuid primary key
    )`
  await sql`
    insert into public.merchant_onboarding_e2e_audit_faults (owner_user_id)
    values (${fixture.userId}::uuid)
    on conflict (owner_user_id) do nothing`
  await sql`
    create or replace function public.fail_merchant_onboarding_e2e_audit()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $$
    begin
      if new.action = 'merchant_onboarded'
         and new.actor_type = 'merchant'
         and exists (
           select 1
           from public.merchant_onboarding_e2e_audit_faults faults
           where new.actor_id = faults.owner_user_id::text
         ) then
        raise exception using
          errcode = 'P0001',
          message = 'merchant onboarding e2e audit fault';
      end if;
      return new;
    end;
    $$`
  await sql`
    drop trigger if exists fail_merchant_onboarding_e2e_audit
    on public.audit_logs`
  await sql`
    create trigger fail_merchant_onboarding_e2e_audit
    before insert on public.audit_logs
    for each row
    execute function public.fail_merchant_onboarding_e2e_audit()`
}

export async function removeMerchantOnboardingAuditFailure(
  sql: Sql
): Promise<void> {
  assertLiveDbOptIn()

  await sql`
    do $merchant_onboarding_fault_cleanup$
    begin
      if exists (
        select 1
        from pg_trigger
        where tgname = 'fail_merchant_onboarding_e2e_audit'
          and tgrelid = 'public.audit_logs'::regclass
      ) then
        execute 'drop trigger fail_merchant_onboarding_e2e_audit on public.audit_logs';
      end if;

      if to_regprocedure(
        'public.fail_merchant_onboarding_e2e_audit()'
      ) is not null then
        execute 'drop function public.fail_merchant_onboarding_e2e_audit()';
      end if;

      if to_regclass(
        'public.merchant_onboarding_e2e_audit_faults'
      ) is not null then
        execute 'drop table public.merchant_onboarding_e2e_audit_faults';
      end if;
    end
    $merchant_onboarding_fault_cleanup$`
}

export async function readMerchantOnboardingDbState(
  sql: Sql,
  fixture: MerchantOnboardingLiveDbFixture
): Promise<MerchantOnboardingDbState> {
  assertLiveDbOptIn()

  const rows = await sql<readonly DbStateRow[]>`
    with owned as (
      select *
      from public.merchants
      where owner_user_id = ${fixture.userId}::uuid
      order by created_at, id
      limit 1
    ), primary_location as (
      select locations.*
      from public.merchant_locations locations
      where locations.merchant_id = (select id from owned)
        and locations.is_primary
      order by locations.created_at, locations.id
      limit 1
    )
    select
      (select count(*)::int from auth.users
       where id = ${fixture.userId}::uuid) as auth_user_count,
      (select email_confirmed_at::text from auth.users
       where id = ${fixture.userId}::uuid) as email_confirmed_at,
      (select count(*)::int from public.merchants
       where owner_user_id = ${fixture.userId}::uuid) as merchant_count,
      (select id::text from owned) as merchant_id,
      (select business_name from owned) as business_name,
      (select business_slug from owned) as business_slug,
      (select business_type from owned) as business_type,
      (select email from owned) as email,
      (select phone from owned) as phone,
      (select status from owned) as status,
      (select requires_billing from owned) as requires_billing,
      (select count(*)::int from public.merchant_locations
       where merchant_id = (select id from owned)) as location_count,
      (select count(*)::int from public.merchant_locations
       where merchant_id = (select id from owned) and is_primary) as primary_location_count,
      (select id::text from primary_location) as location_id,
      (select name from primary_location) as location_name,
      (select address from primary_location) as address,
      (select address_line_1 from primary_location) as address_line_1,
      (select address_line_2 from primary_location) as address_line_2,
      (select address_city from primary_location) as address_city,
      (select address_postcode from primary_location) as address_postcode,
      (select address_country from primary_location) as address_country,
      (select address_provider from primary_location) as address_provider,
      (select address_provider_id from primary_location) as address_provider_id,
      (select address_source from primary_location) as address_source,
      (select latitude::float8 from primary_location) as latitude,
      (select longitude::float8 from primary_location) as longitude,
      (select geofence_radius_meters from primary_location) as geofence_radius_meters,
      (select require_geofence from primary_location) as require_geofence,
      (select soft_geofence_trigger_stamp_number from primary_location)
        as soft_geofence_trigger_stamp,
      (select geocoded_at::text from primary_location) as geocoded_at,
      (select geofence_pin_source from primary_location) as geofence_pin_source,
      (select geofence_pin_updated_at::text from primary_location)
        as geofence_pin_updated_at,
      (select count(*)::int from public.product_events
       where merchant_id = (select id from owned)
         and event_name = 'merchant_signed_up') as product_event_count,
      (select actor_id from public.product_events
       where merchant_id = (select id from owned)
         and event_name = 'merchant_signed_up'
       order by created_at, id limit 1) as product_event_actor_id,
      (select metadata ->> 'source' from public.product_events
       where merchant_id = (select id from owned)
         and event_name = 'merchant_signed_up'
       order by created_at, id limit 1) as product_event_source,
      (select count(*)::int from public.audit_logs
       where merchant_id = (select id from owned)
         and action = 'merchant_onboarded') as audit_count,
      (select actor_id from public.audit_logs
       where merchant_id = (select id from owned)
         and action = 'merchant_onboarded'
       order by created_at, id limit 1) as audit_actor_id,
      (select target_table from public.audit_logs
       where merchant_id = (select id from owned)
         and action = 'merchant_onboarded'
       order by created_at, id limit 1) as audit_target_table,
      (select target_id::text from public.audit_logs
       where merchant_id = (select id from owned)
         and action = 'merchant_onboarded'
       order by created_at, id limit 1) as audit_target_id,
      (select metadata ->> 'location_id' from public.audit_logs
       where merchant_id = (select id from owned)
         and action = 'merchant_onboarded'
       order by created_at, id limit 1) as audit_location_id`

  const row = rows.at(0)
  if (!row) throw new Error("Merchant onboarding readback returned no row.")

  return {
    address: row.address,
    addressCity: row.address_city,
    addressCountry: row.address_country,
    addressLine1: row.address_line_1,
    addressLine2: row.address_line_2,
    addressPostcode: row.address_postcode,
    addressProvider: row.address_provider,
    addressProviderId: row.address_provider_id,
    addressSource: row.address_source,
    auditActorId: row.audit_actor_id,
    auditCount: row.audit_count,
    auditLocationId: row.audit_location_id,
    auditTargetId: row.audit_target_id,
    auditTargetTable: row.audit_target_table,
    authUserCount: row.auth_user_count,
    businessName: row.business_name,
    businessSlug: row.business_slug,
    businessType: row.business_type,
    email: row.email,
    emailConfirmedAt: row.email_confirmed_at,
    geocodedAt: row.geocoded_at,
    geofencePinSource: row.geofence_pin_source,
    geofencePinUpdatedAt: row.geofence_pin_updated_at,
    geofenceRadiusMeters: row.geofence_radius_meters,
    latitude: row.latitude,
    locationCount: row.location_count,
    locationId: row.location_id,
    locationName: row.location_name,
    longitude: row.longitude,
    merchantCount: row.merchant_count,
    merchantId: row.merchant_id,
    phone: row.phone,
    primaryLocationCount: row.primary_location_count,
    productEventActorId: row.product_event_actor_id,
    productEventCount: row.product_event_count,
    productEventSource: row.product_event_source,
    requireGeofence: row.require_geofence,
    requiresBilling: row.requires_billing,
    softGeofenceTriggerStamp: row.soft_geofence_trigger_stamp,
    status: row.status,
  }
}

export async function assertMerchantOnboardingDbState(
  sql: Sql,
  fixture: MerchantOnboardingLiveDbFixture,
  overrides: Partial<MerchantOnboardingExpectedState> = {}
): Promise<MerchantOnboardingDbState> {
  const expected = { ...fixture.expected, ...overrides }
  const state = await readMerchantOnboardingDbState(sql, fixture)

  expect(state).toMatchObject({
    address: expected.address,
    addressCity: expected.addressCity,
    addressCountry: expected.addressCountry,
    addressLine1: expected.addressLine1,
    addressLine2: expected.addressLine2,
    addressPostcode: expected.addressPostcode,
    addressProvider: expected.addressProvider,
    addressProviderId: expected.addressProviderId,
    addressSource: expected.addressSource,
    auditActorId: fixture.userId,
    auditCount: 1,
    auditTargetTable: "merchants",
    authUserCount: 1,
    businessName: expected.businessName,
    businessSlug: expected.businessSlug,
    businessType: expected.businessType,
    email: fixture.email,
    geofencePinSource: expected.geofencePinSource,
    geofenceRadiusMeters: expected.geofenceRadiusMeters,
    locationCount: 1,
    locationName: expected.locationName,
    merchantCount: 1,
    phone: expected.phone,
    primaryLocationCount: 1,
    productEventActorId: fixture.userId,
    productEventCount: 1,
    productEventSource: "onboarding",
    requireGeofence: expected.requireGeofence,
    requiresBilling: true,
    softGeofenceTriggerStamp: expected.softGeofenceTriggerStamp,
    status: "trial",
  })
  expect(state.emailConfirmedAt).not.toBeNull()
  expect(state.merchantId).toMatch(/^[0-9a-f-]{36}$/)
  expect(state.locationId).toMatch(/^[0-9a-f-]{36}$/)
  expect(state.auditTargetId).toBe(state.merchantId)
  expect(state.auditLocationId).toBe(state.locationId)
  expect(state.geocodedAt).not.toBeNull()
  expect(state.geofencePinUpdatedAt).not.toBeNull()

  assertCoordinate("latitude", state.latitude, expected.latitude)
  assertCoordinate("longitude", state.longitude, expected.longitude)
  return state
}

export async function assertMerchantOnboardingRolledBack(
  sql: Sql,
  fixture: MerchantOnboardingLiveDbFixture
): Promise<MerchantOnboardingDbState> {
  const state = await readMerchantOnboardingDbState(sql, fixture)

  expect(state).toMatchObject({
    auditCount: 0,
    authUserCount: 1,
    locationCount: 0,
    merchantCount: 0,
    primaryLocationCount: 0,
    productEventCount: 0,
  })
  expect(state.emailConfirmedAt).not.toBeNull()
  expect(state.merchantId).toBeNull()
  expect(state.locationId).toBeNull()
  return state
}

export async function cleanupMerchantOnboardingLiveDbFixture(
  sql: Sql,
  fixture: MerchantOnboardingLiveDbFixture | undefined
): Promise<void> {
  if (!fixture) return
  assertLiveDbOptIn()

  const cleanupErrors: Error[] = []
  let merchantIds: string[] = []

  try {
    const rows = await sql<readonly MerchantIdRow[]>`
      select id::text as id
      from public.merchants
      where owner_user_id = ${fixture.userId}::uuid`
    merchantIds = rows.map(({ id }) => id)
  } catch (error) {
    cleanupErrors.push(asError("merchant id readback", error))
  }

  await collectCleanupError(cleanupErrors, "audit fault cleanup", () =>
    removeMerchantOnboardingAuditFailure(sql)
  )
  await collectCleanupError(
    cleanupErrors,
    "product-event cleanup",
    async () => {
      await sql`
      delete from public.product_events
      where actor_id = ${fixture.userId}
         or merchant_id in (
           select id from public.merchants
           where owner_user_id = ${fixture.userId}::uuid
         )`
    }
  )
  await collectCleanupError(cleanupErrors, "audit cleanup", async () => {
    await sql`
      delete from public.audit_logs
      where actor_id = ${fixture.userId}
         or merchant_id in (
           select id from public.merchants
           where owner_user_id = ${fixture.userId}::uuid
         )`
  })
  await collectCleanupError(cleanupErrors, "location cleanup", async () => {
    await sql`
      delete from public.merchant_locations
      where merchant_id in (
        select id from public.merchants
        where owner_user_id = ${fixture.userId}::uuid
      )`
  })
  await collectCleanupError(cleanupErrors, "merchant cleanup", async () => {
    await sql`
      delete from public.merchants
      where owner_user_id = ${fixture.userId}::uuid`
  })
  await collectCleanupError(cleanupErrors, "auth-user cleanup", async () => {
    const deleted = await serviceRoleClient().auth.admin.deleteUser(
      fixture.userId
    )
    if (deleted.error) throw deleted.error
  })
  await collectCleanupError(cleanupErrors, "zero-row cleanup readback", () =>
    assertMerchantOnboardingFixtureRemoved(sql, fixture, merchantIds)
  )

  if (cleanupErrors.length > 0) {
    throw new AggregateError(
      cleanupErrors,
      `Unable to fully clean merchant onboarding fixture ${fixture.userId}.`
    )
  }
}

async function assertMerchantOnboardingFixtureRemoved(
  sql: Sql,
  fixture: MerchantOnboardingLiveDbFixture,
  merchantIds: readonly string[]
): Promise<void> {
  const rows = await sql<readonly RemovalStateRow[]>`
    select
      (select count(*)::int from auth.users
       where id = ${fixture.userId}::uuid) as users,
      (select count(*)::int from auth.sessions
       where user_id = ${fixture.userId}::uuid) as sessions,
      (select count(*)::int from public.merchants
       where owner_user_id = ${fixture.userId}::uuid) as merchants,
      (select count(*)::int from public.merchant_locations
       where merchant_id::text = any(${merchantIds})) as locations,
      (select count(*)::int from public.product_events
       where actor_id = ${fixture.userId}
          or merchant_id::text = any(${merchantIds})) as product_events,
      (select count(*)::int from public.audit_logs
       where actor_id = ${fixture.userId}
          or merchant_id::text = any(${merchantIds})) as audits,
      to_regclass('public.merchant_onboarding_e2e_audit_faults') is not null
        as audit_fault_table,
      to_regprocedure('public.fail_merchant_onboarding_e2e_audit()') is not null
        as audit_fault_function,
      (select count(*)::int from pg_trigger
       where tgname = 'fail_merchant_onboarding_e2e_audit'
         and tgrelid = 'public.audit_logs'::regclass) as audit_fault_triggers,
      0::int as audit_fault_rows`
  const state = rows.at(0)

  expect(state).toEqual({
    audit_fault_function: false,
    audit_fault_rows: 0,
    audit_fault_table: false,
    audit_fault_triggers: 0,
    audits: 0,
    locations: 0,
    merchants: 0,
    product_events: 0,
    sessions: 0,
    users: 0,
  })
}

function browserCookie(name: string, cookie: StoredCookie): BrowserCookie {
  const expires = cookieExpires(cookie.options)
  const sameSite = sameSiteOption(cookie.options.sameSite)

  return {
    name,
    value: cookie.value,
    url: requiredLocalBrowserUrl(),
    ...(expires !== undefined ? { expires } : {}),
    ...(typeof cookie.options.httpOnly === "boolean"
      ? { httpOnly: cookie.options.httpOnly }
      : {}),
    ...(typeof cookie.options.secure === "boolean"
      ? { secure: cookie.options.secure }
      : {}),
    ...(sameSite !== undefined ? { sameSite } : {}),
  }
}

function cookieExpires(options: SupabaseCookieOptions): number | undefined {
  if (options.expires instanceof Date) {
    return Math.floor(options.expires.getTime() / 1000)
  }
  if (typeof options.maxAge === "number") {
    return Math.floor(Date.now() / 1000) + options.maxAge
  }
  return undefined
}

function sameSiteOption(
  value: SupabaseCookieOptions["sameSite"]
): BrowserCookie["sameSite"] | undefined {
  switch (value) {
    case "lax":
      return "Lax"
    case "strict":
    case true:
      return "Strict"
    case "none":
      return "None"
    case false:
    case undefined:
      return undefined
    default:
      return assertNever(value)
  }
}

function assertCoordinate(
  label: "latitude" | "longitude",
  actual: number | null,
  expected: number | undefined
): void {
  expect(actual, `${label} must be persisted`).not.toBeNull()
  expect(Number.isFinite(actual), `${label} must be finite`).toBe(true)
  if (expected !== undefined) expect(actual).toBeCloseTo(expected, 6)
}

function serviceRoleClient() {
  assertLiveDbOptIn()
  return createClient(
    requiredLocalSupabaseUrl(),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function assertLiveDbOptIn(): void {
  const reason = merchantOnboardingLiveDbSkipReason()
  if (reason) {
    throw new Error(`Merchant onboarding live DB proof refused: ${reason}.`)
  }
}

function requiredLocalBrowserUrl(): string {
  const value = localHttpUrl(
    process.env.PLAYWRIGHT_BASE_URL ?? DEFAULT_BROWSER_URL
  )
  if (!value) throw new Error("PLAYWRIGHT_BASE_URL must point at localhost.")
  return value
}

function requiredLocalSupabaseUrl(): string {
  const value = localHttpUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
  if (!value) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must point at local Supabase.")
  }
  return value
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value)
    throw new Error(`${name} is required for merchant onboarding proof.`)
  return value
}

function localHttpUrl(value: string | undefined): string | undefined {
  const rawUrl = value?.trim()
  if (!rawUrl) return undefined

  try {
    const url = new URL(rawUrl)
    return LOCAL_HOSTS.has(url.hostname) &&
      (url.protocol === "http:" || url.protocol === "https:")
      ? rawUrl
      : undefined
  } catch {
    return undefined
  }
}

function localPostgresUrl(value: string | undefined): string | undefined {
  const rawUrl = value?.trim()
  if (!rawUrl) return undefined

  try {
    const url = new URL(rawUrl)
    return LOCAL_HOSTS.has(url.hostname) &&
      (url.protocol === "postgres:" || url.protocol === "postgresql:")
      ? rawUrl
      : undefined
  } catch {
    return undefined
  }
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
}

async function collectCleanupError(
  errors: Error[],
  label: string,
  cleanup: () => Promise<void>
): Promise<void> {
  try {
    await cleanup()
  } catch (error) {
    errors.push(asError(label, error))
  }
}

function asError(label: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : "unknown error"
  return new Error(`${label}: ${message}`)
}

function assertNever(value: never): never {
  throw new Error(`Unexpected SameSite value: ${String(value)}`)
}

export const merchantOnboardingAuditFaultObjects = Object.freeze({
  functionName: AUDIT_FAULT_FUNCTION,
  tableName: AUDIT_FAULT_TABLE,
  triggerName: AUDIT_FAULT_TRIGGER,
})
