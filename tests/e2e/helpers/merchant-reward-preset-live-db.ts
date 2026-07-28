import { randomUUID } from "node:crypto"

import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { expect, type BrowserContext, type Page } from "@playwright/test"

import { connectLocalDb, type Sql } from "./admin-live-db"

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"])
const DEFAULT_BROWSER_URL = "http://127.0.0.1:3146"
const AUDIT_FAULT_TABLE = "merchant_reward_preset_e2e_audit_faults"
const AUDIT_FAULT_FUNCTION = "fail_merchant_reward_preset_e2e_audit"
const AUDIT_FAULT_TRIGGER = "fail_merchant_reward_preset_e2e_audit"

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

export const merchantRewardPresetExpectedRewards = Object.freeze([
  Object.freeze({ id: "regulars-pint", name: "Regulars' pint" }),
  Object.freeze({ id: "free-starter", name: "Free starter" }),
  Object.freeze({
    id: "dessert-on-the-house",
    name: "Dessert on the house",
  }),
] as const)

export type MerchantRewardPresetLiveDbFixture = Readonly<{
  businessName: string
  cardId: string
  cardName: string
  email: string
  locationId: string
  locationName: string
  merchantId: string
  userId: string
}>

export type MerchantRewardPresetDbState = Readonly<{
  activeQrCount: number
  activeRewardCount: number
  auditCount: number
  authUserCount: number
  cardCount: number
  distinctRewardNameCount: number
  displayOrders: number[]
  locationCount: number
  merchantCount: number
  productEventCount: number
  qrAuditCount: number
  qrCount: number
  qrLinkedCardCount: number
  qrProductEventCount: number
  rewardAuditCount: number
  rewardAuditPresetIds: string[]
  rewardCount: number
  rewardNames: string[]
  rewardProductEventCount: number
  rewardProductEventPresetIds: string[]
  weights: number[]
}>

type DbStateRow = Readonly<{
  active_qr_count: number
  active_reward_count: number
  audit_count: number
  auth_user_count: number
  card_count: number
  distinct_reward_name_count: number
  display_orders: number[]
  location_count: number
  merchant_count: number
  product_event_count: number
  qr_audit_count: number
  qr_count: number
  qr_linked_card_count: number
  qr_product_event_count: number
  reward_audit_count: number
  reward_audit_preset_ids: string[]
  reward_count: number
  reward_names: string[]
  reward_product_event_count: number
  reward_product_event_preset_ids: string[]
  weights: number[]
}>

type ConfirmedUserRow = Readonly<{
  email_confirmed_at: string | null
}>

type RemovalStateRow = Readonly<{
  audit_fault_function: boolean
  audit_fault_rows: number
  audit_fault_table: boolean
  audit_fault_triggers: number
  audits: number
  cards: number
  locations: number
  merchants: number
  product_events: number
  qr_codes: number
  rewards: number
  sessions: number
  users: number
}>

export function merchantRewardPresetLiveDbSkipReason(): string | undefined {
  if (process.env.MERCHANT_REWARD_PRESET_LIVE_DB_E2E !== "1") {
    return "set MERCHANT_REWARD_PRESET_LIVE_DB_E2E=1 with local Supabase to run atomic reward preset proof"
  }
  if (process.env.PLAYWRIGHT_WORKERS !== "1") {
    return "set PLAYWRIGHT_WORKERS=1 for the owner/card-scoped reward preset fault proof"
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
    return "NEXT_PUBLIC_SUPABASE_ANON_KEY is required for reward preset proof"
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return "SUPABASE_SERVICE_ROLE_KEY is required for reward preset proof"
  }
  return undefined
}

export function connectMerchantRewardPresetDb(): Sql | undefined {
  if (merchantRewardPresetLiveDbSkipReason()) return undefined
  return connectLocalDb()
}

export async function createMerchantRewardPresetLiveDbFixture(
  sql: Sql,
  context: BrowserContext
): Promise<MerchantRewardPresetLiveDbFixture> {
  assertLiveDbOptIn()

  const runId = randomUUID().replaceAll("-", "")
  const email = `merchant-reward-preset-${runId.slice(0, 16)}@example.test`
  const password = `Nabaperks-${randomUUID()}-1!`
  const name = `Reward preset owner ${runId.slice(0, 8)}`
  const merchantId = randomUUID()
  const locationId = randomUUID()
  const cardId = randomUUID()
  const admin = serviceRoleClient()
  let userId: string | undefined
  let fixture: MerchantRewardPresetLiveDbFixture | undefined

  try {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    })
    if (created.error || !created.data.user) {
      throw new Error("Local reward preset auth-user creation failed.")
    }
    const createdUserId = created.data.user.id
    userId = createdUserId

    const confirmed = await sql<readonly ConfirmedUserRow[]>`
      select email_confirmed_at::text as email_confirmed_at
      from auth.users
      where id = ${createdUserId}::uuid`
    if (!confirmed.at(0)?.email_confirmed_at) {
      throw new Error("Local reward preset auth user was not confirmed.")
    }

    const businessName = `Atomic Rewards ${runId.slice(0, 8)}`
    const locationName = `Atomic Venue ${runId.slice(0, 8)}`
    const cardName = `Atomic Card ${runId.slice(0, 8)}`
    fixture = {
      businessName,
      cardId,
      cardName,
      email,
      locationId,
      locationName,
      merchantId,
      userId: createdUserId,
    }

    await sql.begin(async (tx) => {
      await tx`
        insert into public.merchants (
          id,
          owner_user_id,
          business_name,
          business_slug,
          business_type,
          email,
          phone,
          status,
          requires_billing
        ) values (
          ${merchantId}::uuid,
          ${createdUserId}::uuid,
          ${businessName},
          ${`atomic-rewards-${runId.slice(0, 20)}`},
          'pub',
          ${email},
          '+44 7700 900123',
          'trial',
          true
        )`
      await tx`
        insert into public.merchant_locations (
          id,
          merchant_id,
          name,
          address,
          address_line_1,
          address_city,
          address_postcode,
          address_country,
          address_source,
          latitude,
          longitude,
          geofence_radius_meters,
          require_geofence,
          soft_geofence_trigger_stamp_number,
          geocoded_at,
          geofence_pin_source,
          geofence_pin_updated_at,
          is_primary
        ) values (
          ${locationId}::uuid,
          ${merchantId}::uuid,
          ${locationName},
          '15 Market Street, Cambridge, CB2 3PA',
          '15 Market Street',
          'Cambridge',
          'CB2 3PA',
          'GB',
          'manual_entry',
          52.2053,
          0.1218,
          150,
          false,
          3,
          now(),
          'geocoded',
          now(),
          true
        )`
      await tx`
        insert into public.loyalty_cards (
          id,
          merchant_id,
          location_id,
          card_name,
          stamps_required,
          reward_name,
          reward_terms,
          is_active
        ) values (
          ${cardId}::uuid,
          ${merchantId}::uuid,
          ${locationId}::uuid,
          ${cardName},
          3,
          'Surprise reward',
          'A surprise reward on the house after three visits.',
          true
        )`
    })

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
      throw new Error("Local reward preset browser sign-in failed.")
    }

    await context.addCookies(
      Array.from(cookieJar, ([cookieName, cookie]) =>
        browserCookie(cookieName, cookie)
      )
    )

    await assertMerchantRewardPresetBrowserSession(context, fixture)
    await assertMerchantRewardPresetRolledBack(sql, fixture)
    return fixture
  } catch (error) {
    const cleanupErrors: Error[] = []
    if (fixture) {
      try {
        await cleanupMerchantRewardPresetLiveDbFixture(sql, fixture)
      } catch (cleanupError) {
        cleanupErrors.push(asError("partial fixture cleanup", cleanupError))
      }
    } else if (userId) {
      const deleted = await admin.auth.admin.deleteUser(userId)
      if (deleted.error) {
        cleanupErrors.push(asError("partial auth-user cleanup", deleted.error))
      }
    }

    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        [asError("fixture creation", error), ...cleanupErrors],
        "Reward preset fixture creation and cleanup failed."
      )
    }
    throw error
  }
}

export async function assertMerchantRewardPresetBrowserSession(
  browser: BrowserContext | Page,
  fixture: MerchantRewardPresetLiveDbFixture,
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

export async function installMerchantRewardPresetAuditFailure(
  sql: Sql,
  fixture: MerchantRewardPresetLiveDbFixture
): Promise<void> {
  assertLiveDbOptIn()

  await sql`
    create table if not exists public.merchant_reward_preset_e2e_audit_faults (
      owner_user_id uuid not null,
      loyalty_card_id uuid not null,
      fail_preset_id text not null,
      primary key (owner_user_id, loyalty_card_id)
    )`
  await sql`
    insert into public.merchant_reward_preset_e2e_audit_faults (
      owner_user_id,
      loyalty_card_id,
      fail_preset_id
    ) values (
      ${fixture.userId}::uuid,
      ${fixture.cardId}::uuid,
      'free-starter'
    )
    on conflict (owner_user_id, loyalty_card_id)
    do update set fail_preset_id = excluded.fail_preset_id`
  await sql`
    create or replace function public.fail_merchant_reward_preset_e2e_audit()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $$
    begin
      if new.action = 'reward_pool_item_created'
         and new.actor_type = 'merchant'
         and new.target_table = 'reward_pool_items'
         and new.metadata ->> 'source' = 'reward_preset_batch'
         and exists (
           select 1
           from public.merchant_reward_preset_e2e_audit_faults faults
           where new.actor_id = faults.owner_user_id::text
             and new.metadata ->> 'loyalty_card_id' = faults.loyalty_card_id::text
             and new.metadata ->> 'preset_id' = faults.fail_preset_id
         ) then
        raise exception using
          errcode = 'P0001',
          message = 'merchant reward preset e2e second-audit fault';
      end if;
      return new;
    end;
    $$`
  await sql`
    drop trigger if exists fail_merchant_reward_preset_e2e_audit
    on public.audit_logs`
  await sql`
    create trigger fail_merchant_reward_preset_e2e_audit
    before insert on public.audit_logs
    for each row
    execute function public.fail_merchant_reward_preset_e2e_audit()`
}

export async function removeMerchantRewardPresetAuditFailure(
  sql: Sql
): Promise<void> {
  assertLiveDbOptIn()

  await sql`
    do $merchant_reward_preset_fault_cleanup$
    begin
      if exists (
        select 1
        from pg_trigger
        where tgname = 'fail_merchant_reward_preset_e2e_audit'
          and tgrelid = 'public.audit_logs'::regclass
      ) then
        execute 'drop trigger fail_merchant_reward_preset_e2e_audit on public.audit_logs';
      end if;

      if to_regprocedure(
        'public.fail_merchant_reward_preset_e2e_audit()'
      ) is not null then
        execute 'drop function public.fail_merchant_reward_preset_e2e_audit()';
      end if;

      if to_regclass(
        'public.merchant_reward_preset_e2e_audit_faults'
      ) is not null then
        execute 'drop table public.merchant_reward_preset_e2e_audit_faults';
      end if;
    end
    $merchant_reward_preset_fault_cleanup$`
}

export async function readMerchantRewardPresetDbState(
  sql: Sql,
  fixture: MerchantRewardPresetLiveDbFixture
): Promise<MerchantRewardPresetDbState> {
  assertLiveDbOptIn()

  const rows = await sql<readonly DbStateRow[]>`
    select
      (select count(*)::int from auth.users
       where id = ${fixture.userId}::uuid) as auth_user_count,
      (select count(*)::int from public.merchants
       where id = ${fixture.merchantId}::uuid
         and owner_user_id = ${fixture.userId}::uuid) as merchant_count,
      (select count(*)::int from public.merchant_locations
       where id = ${fixture.locationId}::uuid
         and merchant_id = ${fixture.merchantId}::uuid) as location_count,
      (select count(*)::int from public.loyalty_cards
       where id = ${fixture.cardId}::uuid
         and merchant_id = ${fixture.merchantId}::uuid
         and location_id = ${fixture.locationId}::uuid) as card_count,
      (select count(*)::int from public.reward_pool_items
       where merchant_id = ${fixture.merchantId}::uuid
         and loyalty_card_id = ${fixture.cardId}::uuid) as reward_count,
      (select count(*)::int from public.reward_pool_items
       where merchant_id = ${fixture.merchantId}::uuid
         and loyalty_card_id = ${fixture.cardId}::uuid
         and is_active) as active_reward_count,
      (select count(distinct lower(regexp_replace(btrim(reward_name), '[[:space:]]+', ' ', 'g')))::int
       from public.reward_pool_items
       where merchant_id = ${fixture.merchantId}::uuid
         and loyalty_card_id = ${fixture.cardId}::uuid) as distinct_reward_name_count,
      coalesce((select jsonb_agg(reward_name order by display_order, created_at, id)
       from public.reward_pool_items
       where merchant_id = ${fixture.merchantId}::uuid
         and loyalty_card_id = ${fixture.cardId}::uuid), '[]'::jsonb) as reward_names,
      coalesce((select jsonb_agg(weight order by display_order, created_at, id)
       from public.reward_pool_items
       where merchant_id = ${fixture.merchantId}::uuid
         and loyalty_card_id = ${fixture.cardId}::uuid), '[]'::jsonb) as weights,
      coalesce((select jsonb_agg(display_order order by display_order, created_at, id)
       from public.reward_pool_items
       where merchant_id = ${fixture.merchantId}::uuid
         and loyalty_card_id = ${fixture.cardId}::uuid), '[]'::jsonb) as display_orders,
      (select count(*)::int from public.product_events
       where merchant_id = ${fixture.merchantId}::uuid
         and (
           (
             event_name = 'reward_pool_item_created'
             and metadata ->> 'source' = 'reward_preset_batch'
             and metadata ->> 'loyalty_card_id' = ${fixture.cardId}
           )
           or event_name = 'qr_created'
         )) as product_event_count,
      (select count(*)::int from public.product_events
       where merchant_id = ${fixture.merchantId}::uuid
         and event_name = 'reward_pool_item_created'
         and metadata ->> 'source' = 'reward_preset_batch'
         and metadata ->> 'loyalty_card_id' = ${fixture.cardId})
        as reward_product_event_count,
      coalesce((select jsonb_agg(events.metadata ->> 'preset_id'
         order by items.display_order, items.created_at, items.id)
       from public.product_events events
       join public.reward_pool_items items
         on items.id = (events.metadata ->> 'reward_pool_item_id')::uuid
       where events.merchant_id = ${fixture.merchantId}::uuid
         and events.event_name = 'reward_pool_item_created'
         and events.metadata ->> 'source' = 'reward_preset_batch'
         and events.metadata ->> 'loyalty_card_id' = ${fixture.cardId}), '[]'::jsonb)
        as reward_product_event_preset_ids,
      (select count(*)::int from public.audit_logs
       where merchant_id = ${fixture.merchantId}::uuid) as audit_count,
      (select count(*)::int from public.audit_logs
       where merchant_id = ${fixture.merchantId}::uuid
         and action = 'reward_pool_item_created'
         and target_table = 'reward_pool_items'
         and metadata ->> 'source' = 'reward_preset_batch'
         and metadata ->> 'loyalty_card_id' = ${fixture.cardId})
        as reward_audit_count,
      coalesce((select jsonb_agg(audits.metadata ->> 'preset_id'
         order by items.display_order, items.created_at, items.id)
       from public.audit_logs audits
       join public.reward_pool_items items on items.id = audits.target_id
       where audits.merchant_id = ${fixture.merchantId}::uuid
         and audits.action = 'reward_pool_item_created'
         and audits.target_table = 'reward_pool_items'
         and audits.metadata ->> 'source' = 'reward_preset_batch'
         and audits.metadata ->> 'loyalty_card_id' = ${fixture.cardId}), '[]'::jsonb)
        as reward_audit_preset_ids,
      (select count(*)::int from public.qr_codes
       where merchant_id = ${fixture.merchantId}::uuid
         and location_id = ${fixture.locationId}::uuid
         and destination_type = 'join') as qr_count,
      (select count(*)::int from public.qr_codes
       where merchant_id = ${fixture.merchantId}::uuid
         and location_id = ${fixture.locationId}::uuid
         and destination_type = 'join'
         and is_active) as active_qr_count,
      (select count(*)::int from public.qr_codes
       where merchant_id = ${fixture.merchantId}::uuid
         and location_id = ${fixture.locationId}::uuid
         and loyalty_card_id = ${fixture.cardId}::uuid
         and destination_type = 'join') as qr_linked_card_count,
      (select count(*)::int from public.product_events
       where merchant_id = ${fixture.merchantId}::uuid
         and event_name = 'qr_created') as qr_product_event_count,
      (select count(*)::int from public.audit_logs
       where merchant_id = ${fixture.merchantId}::uuid
         and action = 'qr_created'
         and target_table = 'qr_codes') as qr_audit_count`
  const row = rows.at(0)
  if (!row) throw new Error("Reward preset DB state readback returned no row.")

  return {
    activeQrCount: row.active_qr_count,
    activeRewardCount: row.active_reward_count,
    auditCount: row.audit_count,
    authUserCount: row.auth_user_count,
    cardCount: row.card_count,
    distinctRewardNameCount: row.distinct_reward_name_count,
    displayOrders: row.display_orders,
    locationCount: row.location_count,
    merchantCount: row.merchant_count,
    productEventCount: row.product_event_count,
    qrAuditCount: row.qr_audit_count,
    qrCount: row.qr_count,
    qrLinkedCardCount: row.qr_linked_card_count,
    qrProductEventCount: row.qr_product_event_count,
    rewardAuditCount: row.reward_audit_count,
    rewardAuditPresetIds: row.reward_audit_preset_ids,
    rewardCount: row.reward_count,
    rewardNames: row.reward_names,
    rewardProductEventCount: row.reward_product_event_count,
    rewardProductEventPresetIds: row.reward_product_event_preset_ids,
    weights: row.weights,
  }
}

export async function assertMerchantRewardPresetRolledBack(
  sql: Sql,
  fixture: MerchantRewardPresetLiveDbFixture
): Promise<MerchantRewardPresetDbState> {
  const state = await readMerchantRewardPresetDbState(sql, fixture)

  expect(state).toEqual({
    activeQrCount: 0,
    activeRewardCount: 0,
    auditCount: 0,
    authUserCount: 1,
    cardCount: 1,
    distinctRewardNameCount: 0,
    displayOrders: [],
    locationCount: 1,
    merchantCount: 1,
    productEventCount: 0,
    qrAuditCount: 0,
    qrCount: 0,
    qrLinkedCardCount: 0,
    qrProductEventCount: 0,
    rewardAuditCount: 0,
    rewardAuditPresetIds: [],
    rewardCount: 0,
    rewardNames: [],
    rewardProductEventCount: 0,
    rewardProductEventPresetIds: [],
    weights: [],
  })
  return state
}

export async function assertMerchantRewardPresetDbState(
  sql: Sql,
  fixture: MerchantRewardPresetLiveDbFixture
): Promise<MerchantRewardPresetDbState> {
  const state = await readMerchantRewardPresetDbState(sql, fixture)
  const expectedIds = merchantRewardPresetExpectedRewards.map(({ id }) => id)
  const expectedNames = merchantRewardPresetExpectedRewards.map(
    ({ name }) => name
  )

  expect(state).toEqual({
    activeQrCount: 0,
    activeRewardCount: 3,
    auditCount: 3,
    authUserCount: 1,
    cardCount: 1,
    distinctRewardNameCount: 3,
    displayOrders: [1, 2, 3],
    locationCount: 1,
    merchantCount: 1,
    productEventCount: 3,
    qrAuditCount: 0,
    qrCount: 0,
    qrLinkedCardCount: 0,
    qrProductEventCount: 0,
    rewardAuditCount: 3,
    rewardAuditPresetIds: expectedIds,
    rewardCount: 3,
    rewardNames: expectedNames,
    rewardProductEventCount: 3,
    rewardProductEventPresetIds: expectedIds,
    weights: [1, 1, 1],
  })
  return state
}

export async function cleanupMerchantRewardPresetLiveDbFixture(
  sql: Sql,
  fixture: MerchantRewardPresetLiveDbFixture | undefined
): Promise<void> {
  if (!fixture) return
  assertLiveDbOptIn()

  const cleanupErrors: Error[] = []

  await collectCleanupError(cleanupErrors, "audit fault cleanup", () =>
    removeMerchantRewardPresetAuditFailure(sql)
  )
  await collectCleanupError(
    cleanupErrors,
    "product-event cleanup",
    async () => {
      await sql`
      delete from public.product_events
      where merchant_id = ${fixture.merchantId}::uuid
         or actor_id = ${fixture.userId}`
    }
  )
  await collectCleanupError(cleanupErrors, "audit cleanup", async () => {
    await sql`
      delete from public.audit_logs
      where merchant_id = ${fixture.merchantId}::uuid
         or actor_id = ${fixture.userId}`
  })
  await collectCleanupError(cleanupErrors, "QR cleanup", async () => {
    await sql`
      delete from public.qr_codes
      where merchant_id = ${fixture.merchantId}::uuid`
  })
  await collectCleanupError(cleanupErrors, "reward cleanup", async () => {
    await sql`
      delete from public.reward_pool_items
      where merchant_id = ${fixture.merchantId}::uuid`
  })
  await collectCleanupError(cleanupErrors, "card cleanup", async () => {
    await sql`
      delete from public.loyalty_cards
      where merchant_id = ${fixture.merchantId}::uuid`
  })
  await collectCleanupError(cleanupErrors, "location cleanup", async () => {
    await sql`
      delete from public.merchant_locations
      where merchant_id = ${fixture.merchantId}::uuid`
  })
  await collectCleanupError(cleanupErrors, "merchant cleanup", async () => {
    await sql`
      delete from public.merchants
      where id = ${fixture.merchantId}::uuid
        and owner_user_id = ${fixture.userId}::uuid`
  })
  await collectCleanupError(cleanupErrors, "auth-user cleanup", async () => {
    const deleted = await serviceRoleClient().auth.admin.deleteUser(
      fixture.userId
    )
    if (deleted.error) throw deleted.error
  })
  await collectCleanupError(cleanupErrors, "zero-row cleanup readback", () =>
    assertMerchantRewardPresetFixtureRemoved(sql, fixture)
  )

  if (cleanupErrors.length > 0) {
    throw new AggregateError(
      cleanupErrors,
      `Unable to fully clean reward preset fixture ${fixture.userId}.`
    )
  }
}

async function assertMerchantRewardPresetFixtureRemoved(
  sql: Sql,
  fixture: MerchantRewardPresetLiveDbFixture
): Promise<void> {
  const rows = await sql<readonly RemovalStateRow[]>`
    select
      (select count(*)::int from auth.users
       where id = ${fixture.userId}::uuid) as users,
      (select count(*)::int from auth.sessions
       where user_id = ${fixture.userId}::uuid) as sessions,
      (select count(*)::int from public.merchants
       where id = ${fixture.merchantId}::uuid) as merchants,
      (select count(*)::int from public.merchant_locations
       where id = ${fixture.locationId}::uuid) as locations,
      (select count(*)::int from public.loyalty_cards
       where id = ${fixture.cardId}::uuid) as cards,
      (select count(*)::int from public.reward_pool_items
       where merchant_id = ${fixture.merchantId}::uuid) as rewards,
      (select count(*)::int from public.qr_codes
       where merchant_id = ${fixture.merchantId}::uuid) as qr_codes,
      (select count(*)::int from public.product_events
       where merchant_id = ${fixture.merchantId}::uuid
          or actor_id = ${fixture.userId}) as product_events,
      (select count(*)::int from public.audit_logs
       where merchant_id = ${fixture.merchantId}::uuid
          or actor_id = ${fixture.userId}) as audits,
      to_regclass('public.merchant_reward_preset_e2e_audit_faults') is not null
        as audit_fault_table,
      to_regprocedure('public.fail_merchant_reward_preset_e2e_audit()') is not null
        as audit_fault_function,
      (select count(*)::int from pg_trigger
       where tgname = 'fail_merchant_reward_preset_e2e_audit'
         and tgrelid = 'public.audit_logs'::regclass) as audit_fault_triggers,
      0::int as audit_fault_rows`
  const state = rows.at(0)

  expect(state).toEqual({
    audit_fault_function: false,
    audit_fault_rows: 0,
    audit_fault_table: false,
    audit_fault_triggers: 0,
    audits: 0,
    cards: 0,
    locations: 0,
    merchants: 0,
    product_events: 0,
    qr_codes: 0,
    rewards: 0,
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

function serviceRoleClient() {
  assertLiveDbOptIn()
  return createClient(
    requiredLocalSupabaseUrl(),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function assertLiveDbOptIn(): void {
  const reason = merchantRewardPresetLiveDbSkipReason()
  if (reason) {
    throw new Error(`Merchant reward preset live DB proof refused: ${reason}.`)
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
  if (!value) throw new Error(`${name} is required for reward preset proof.`)
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

export const merchantRewardPresetAuditFaultObjects = Object.freeze({
  functionName: AUDIT_FAULT_FUNCTION,
  tableName: AUDIT_FAULT_TABLE,
  triggerName: AUDIT_FAULT_TRIGGER,
})
