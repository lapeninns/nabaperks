import { execFileSync } from "node:child_process"
import { createHash, randomUUID } from "node:crypto"
import { createServer } from "node:http"

import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { expect, type Page } from "@playwright/test"

import {
  decryptOtpAliasToken,
  encryptOtpAliasToken,
} from "../../../lib/security/otp-alias-token-core"
import { connectLocalDb, type Sql } from "./admin-live-db"

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"])
const DEFAULT_BROWSER_URL = "http://127.0.0.1:3146"
const LOCAL_EMAIL_HOOK_HOSTS = new Set([
  "127.0.0.1",
  "host.docker.internal",
  "localhost",
])
const ALIAS_LIFETIME_MS = 60 * 60 * 1000
const INITIAL_PASSWORD = "NabaperksLive1!"
const REPLACEMENT_PASSWORD = "venue456"

export type MerchantAuthLivePurpose = "recovery" | "signup"
export type MerchantAuthAliasTestOutcome =
  | "busy"
  | "expired"
  | "rejected"
  | "superseded"
  | "throttled"
  | "used"

export type MerchantAuthLiveDbFixture = Readonly<{
  aliasCode: string
  aliasId: string
  email: string
  initialPassword: string
  name: string
  nextPath: string
  providerToken: string
  purpose: MerchantAuthLivePurpose
  replacementPassword: string
  userId: string
}>

type AliasRow = Readonly<{
  alias_code: string
  consumed_at: string | null
  email: string
  id: string
  purpose: string
  reservation_id: string | null
  resolution: string | null
  reserved_until: string | null
  supabase_token: string
}>

type AuthUserRow = Readonly<{
  email: string
  email_confirmed_at: string | null
  id: string
}>

type CountRow = Readonly<{
  count: number
}>

type CleanupCountRow = Readonly<{
  aliases: number
  attempts: number
  sessions: number
  users: number
}>

export function merchantAuthRecoveryLiveDbSkipReason(): string | undefined {
  if (process.env.MERCHANT_AUTH_LIVE_DB_E2E !== "1") {
    return "set MERCHANT_AUTH_LIVE_DB_E2E=1 with local Supabase to run merchant auth session proof"
  }
  if (!localUrl(process.env.PLAYWRIGHT_BASE_URL ?? DEFAULT_BROWSER_URL)) {
    return "PLAYWRIGHT_BASE_URL must point at a local browser server"
  }
  if (!localUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)) {
    return "NEXT_PUBLIC_SUPABASE_URL must point at the local Supabase API"
  }
  if (!localPostgresUrl(process.env.SUPABASE_DB_URL)) {
    return "SUPABASE_DB_URL must point at local Supabase Postgres"
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
    return "NEXT_PUBLIC_SUPABASE_ANON_KEY is required for merchant auth session proof"
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return "SUPABASE_SERVICE_ROLE_KEY is required for merchant auth session proof"
  }
  if (!process.env.MERCHANT_OTP_ALIAS_TOKEN_ENCRYPTION_KEY?.trim()) {
    return "MERCHANT_OTP_ALIAS_TOKEN_ENCRYPTION_KEY is required for merchant auth session proof"
  }
  return undefined
}

export function connectMerchantAuthRecoveryDb(): Sql | undefined {
  if (merchantAuthRecoveryLiveDbSkipReason()) return undefined
  return connectLocalDb()
}

export type MerchantAuthLocalEmailHookSink = Readonly<{
  close: () => Promise<void>
  requestCount: () => number
}>

export async function startMerchantAuthLocalEmailHookSink({
  response: sinkResponse = "failure",
}: {
  readonly response?: "failure" | "success"
} = {}): Promise<MerchantAuthLocalEmailHookSink> {
  assertLiveDbOptIn()
  const expectedUri = requiredEnv("MERCHANT_AUTH_EXPECTED_LOCAL_EMAIL_HOOK_URI")
  const expectedUrl = localEmailHookUrl(expectedUri)
  const runtimeUri = runningLocalAuthHookUri()

  if (runtimeUri !== expectedUri) {
    throw new Error(
      "Merchant auth live proof refused because the running local Auth hook URI does not match the expected local sink."
    )
  }

  const port = Number(expectedUrl.port)
  if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
    throw new Error("Merchant auth local email-hook sink needs a safe port.")
  }

  let requests = 0
  const server = createServer((request, response) => {
    requests += 1
    // Never retain or print the OTP-bearing hook body. This sink exists only to
    // prove provider outcomes without any production network destination.
    request.resume()
    if (sinkResponse === "success") {
      response.writeHead(200, { "content-type": "application/json" })
      response.end(JSON.stringify({}))
      return
    }
    response.writeHead(503, { "content-type": "application/json" })
    response.end(
      JSON.stringify({
        error: {
          http_code: 503,
          message: "Local merchant auth proof email sink.",
        },
      })
    )
  })

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(port, "0.0.0.0", () => {
      server.off("error", reject)
      resolve()
    })
  })

  return {
    requestCount: () => requests,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
    },
  }
}

export async function createMerchantSignupLiveDbFixture(
  sql: Sql
): Promise<MerchantAuthLiveDbFixture> {
  return createMerchantAuthLiveDbFixture(sql, "signup")
}

export async function createMerchantRecoveryLiveDbFixture(
  sql: Sql
): Promise<MerchantAuthLiveDbFixture> {
  return createMerchantAuthLiveDbFixture(sql, "recovery")
}

export async function assertMerchantAuthAliasPrepared(
  sql: Sql,
  fixture: MerchantAuthLiveDbFixture
): Promise<void> {
  const row = await readAliasRow(sql, fixture.aliasId)

  expect(row).toBeDefined()
  expect(row).toMatchObject({
    alias_code: fixture.aliasCode,
    consumed_at: null,
    email: fixture.email,
    id: fixture.aliasId,
    purpose: fixture.purpose,
    reservation_id: null,
    resolution: null,
    reserved_until: null,
  })
  expect(row?.supabase_token).toMatch(/^v1\./)
  expect(row?.supabase_token).not.toBe(fixture.providerToken)
  expect(decryptOtpAliasToken(row?.supabase_token ?? "")).toBe(
    fixture.providerToken
  )
}

export async function assertMerchantAuthBrowserSession(
  page: Page,
  fixture: MerchantAuthLiveDbFixture,
  expectedPath: string = fixture.nextPath
): Promise<void> {
  const browserUrl = new URL(page.url())
  const cookies = await page.context().cookies()
  const authCookies = cookies.filter((cookie) =>
    /^sb-.+-auth-token(?:\.\d+)?$/.test(cookie.name)
  )
  const pageContent = await page.content()

  expect(`${browserUrl.pathname}${browserUrl.search}`).toBe(expectedPath)
  expect(authCookies.length).toBeGreaterThan(0)
  for (const secret of [
    fixture.providerToken,
    fixture.initialPassword,
    fixture.replacementPassword,
  ]) {
    expect(
      page.url().includes(secret) ||
        pageContent.includes(secret) ||
        cookies.some(({ value }) => value.includes(secret)),
      "browser URL, markup, and cookies must not contain fixture secrets"
    ).toBe(false)
  }

  const supabase = createServerClient(
    requiredLocalSupabaseUrl(),
    requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookies.map(({ name, value }) => ({ name, value }))
        },
        setAll() {
          // Read-only validation: the browser owns the session cookie jar.
        },
      },
    }
  )
  const { data, error } = await supabase.auth.getUser()

  expect(error).toBeNull()
  expect(data.user?.id).toBe(fixture.userId)
  expect(data.user?.email).toBe(fixture.email)
}

export async function assertMerchantAuthVerifiedDbState(
  sql: Sql,
  fixture: MerchantAuthLiveDbFixture
): Promise<void> {
  const alias = await readAliasRow(sql, fixture.aliasId)
  const users = await sql<readonly AuthUserRow[]>`
    select
      id::text as id,
      email,
      email_confirmed_at::text as email_confirmed_at
    from auth.users
    where id = ${fixture.userId}::uuid`
  const sessions = await sql<readonly CountRow[]>`
    select count(*)::int as count
    from auth.sessions
    where user_id = ${fixture.userId}::uuid`
  const merchants = await sql<readonly CountRow[]>`
    select count(*)::int as count
    from public.merchants
    where owner_user_id = ${fixture.userId}::uuid`

  expect(alias).toBeDefined()
  expect(alias).toMatchObject({
    alias_code: fixture.aliasCode,
    email: fixture.email,
    id: fixture.aliasId,
    purpose: fixture.purpose,
    reservation_id: null,
    reserved_until: null,
    resolution: "verified",
    supabase_token: "",
  })
  expect(alias?.consumed_at).not.toBeNull()
  expect(users).toHaveLength(1)
  expect(users.at(0)).toMatchObject({
    email: fixture.email,
    id: fixture.userId,
  })
  expect(users.at(0)?.email_confirmed_at).not.toBeNull()
  expect(sessions.at(0)?.count ?? 0).toBeGreaterThan(0)
  expect(merchants.at(0)?.count ?? 0).toBe(0)
}

export async function assertMerchantRecoveryPasswordUpdated(
  fixture: MerchantAuthLiveDbFixture
): Promise<void> {
  if (fixture.purpose !== "recovery") {
    throw new Error("Password-update proof requires a recovery fixture.")
  }

  const supabase = createClient(
    requiredLocalSupabaseUrl(),
    requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data, error } = await supabase.auth.signInWithPassword({
    email: fixture.email,
    password: fixture.replacementPassword,
  })

  expect(error).toBeNull()
  expect(data.user?.id).toBe(fixture.userId)

  if (data.session) {
    const { error: signOutError } = await supabase.auth.signOut()
    expect(signOutError).toBeNull()
  }
}

export async function assertMerchantRecoveryPasswordUnchanged(
  fixture: MerchantAuthLiveDbFixture
): Promise<void> {
  if (fixture.purpose !== "recovery") {
    throw new Error("Password-unchanged proof requires a recovery fixture.")
  }

  const supabase = createClient(
    requiredLocalSupabaseUrl(),
    requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const original = await supabase.auth.signInWithPassword({
    email: fixture.email,
    password: fixture.initialPassword,
  })
  expect(original.error).toBeNull()
  expect(original.data.user?.id).toBe(fixture.userId)
  if (original.data.session) await supabase.auth.signOut()

  const replacement = await supabase.auth.signInWithPassword({
    email: fixture.email,
    password: fixture.replacementPassword,
  })
  expect(replacement.data.session).toBeNull()
  expect(replacement.error).not.toBeNull()
}

export async function assertMerchantRecoverySessionClosed(
  sql: Sql,
  fixture: MerchantAuthLiveDbFixture,
  expectedSurvivingSessions = 0
): Promise<void> {
  const alias = await readAliasRow(sql, fixture.aliasId)
  const sessions = await sql<readonly CountRow[]>`
    select count(*)::int as count
    from auth.sessions
    where user_id = ${fixture.userId}::uuid`

  expect(alias).toMatchObject({
    id: fixture.aliasId,
    resolution: "verified",
    supabase_token: "",
  })
  expect(alias?.consumed_at).not.toBeNull()
  expect(sessions.at(0)?.count ?? 0).toBe(expectedSurvivingSessions)
}

export async function installMerchantPasswordUpdateFault(
  sql: Sql,
  fixture: MerchantAuthLiveDbFixture
): Promise<void> {
  assertLiveDbOptIn()

  await sql`
    create table if not exists public.merchant_auth_e2e_password_faults (
      email text primary key
    )`
  await sql`
    insert into public.merchant_auth_e2e_password_faults (email)
    values (${fixture.email})
    on conflict (email) do nothing`
  await sql`
    create or replace function public.block_merchant_auth_e2e_password_update()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $$
    begin
      if new.encrypted_password is distinct from old.encrypted_password
         and exists (
           select 1
           from public.merchant_auth_e2e_password_faults faults
           where faults.email = lower(trim(new.email))
         ) then
        raise exception using
          errcode = 'P0001',
          message = 'merchant auth e2e password update fault';
      end if;
      return new;
    end;
    $$`
  await dropMerchantPasswordUpdateTrigger(sql)
  await sql`
    create trigger block_merchant_auth_e2e_password_update
    before update of encrypted_password on auth.users
    for each row
    execute function public.block_merchant_auth_e2e_password_update()`
}

export async function removeMerchantPasswordUpdateFault(
  sql: Sql
): Promise<void> {
  assertLiveDbOptIn()

  await sql`
    do $merchant_auth_cleanup$
    begin
      if exists (
        select 1
        from pg_trigger
        where tgname = 'block_merchant_auth_e2e_password_update'
          and tgrelid = 'auth.users'::regclass
      ) then
        execute 'drop trigger block_merchant_auth_e2e_password_update on auth.users';
      end if;

      if to_regprocedure(
        'public.block_merchant_auth_e2e_password_update()'
      ) is not null then
        execute 'drop function public.block_merchant_auth_e2e_password_update()';
      end if;

      if to_regclass('public.merchant_auth_e2e_password_faults') is not null then
        execute 'drop table public.merchant_auth_e2e_password_faults';
      end if;
    end
    $merchant_auth_cleanup$`
}

async function dropMerchantPasswordUpdateTrigger(sql: Sql): Promise<void> {
  await sql`
    do $merchant_auth_trigger_cleanup$
    begin
      if exists (
        select 1
        from pg_trigger
        where tgname = 'block_merchant_auth_e2e_password_update'
          and tgrelid = 'auth.users'::regclass
      ) then
        execute 'drop trigger block_merchant_auth_e2e_password_update on auth.users';
      end if;
    end
    $merchant_auth_trigger_cleanup$`
}

export async function prepareMerchantAuthAliasOutcome(
  sql: Sql,
  fixture: MerchantAuthLiveDbFixture,
  outcome: MerchantAuthAliasTestOutcome
): Promise<string | undefined> {
  assertLiveDbOptIn()

  switch (outcome) {
    case "expired":
      await sql`
        update public.merchant_email_otp_aliases
        set expires_at = clock_timestamp() - interval '1 minute'
        where id = ${fixture.aliasId}::uuid`
      return undefined
    case "used":
    case "superseded":
    case "rejected":
      await sql`
        update public.merchant_email_otp_aliases
        set
          resolution = ${outcome === "used" ? "verified" : outcome},
          consumed_at = clock_timestamp(),
          supabase_token = '',
          reservation_id = null,
          reserved_until = null
        where id = ${fixture.aliasId}::uuid`
      return undefined
    case "busy": {
      const retryAt = new Date(Date.now() + 90_000).toISOString()
      await sql`
        update public.merchant_email_otp_aliases
        set
          reservation_id = ${randomUUID()}::uuid,
          reserved_until = ${retryAt}::timestamptz
        where id = ${fixture.aliasId}::uuid`
      return retryAt
    }
    case "throttled":
      await sql`
        insert into public.merchant_email_otp_alias_attempts (
          email,
          alias_code,
          success,
          attempted_at
        )
        select
          ${fixture.email},
          '[redacted]',
          false,
          clock_timestamp()
        from generate_series(1, 20)`
      return undefined
  }
}

export async function seedMerchantAuthResendCooldown(
  sql: Sql,
  fixture: MerchantAuthLiveDbFixture,
  requestIdentity: string,
  durationMs = 4_000
): Promise<string> {
  assertLiveDbOptIn()

  const retryAt = new Date(Date.now() + durationMs).toISOString()
  const rawKey = [
    "merchant-otp-resend",
    fixture.purpose,
    fixture.email.trim().toLowerCase(),
    requestIdentity.trim(),
    "cooldown",
  ].join(":")
  const bucketKey = createHash("sha256").update(rawKey).digest("hex")

  await sql`
    insert into public.rate_limit_buckets (bucket_key, count, reset_at)
    values (${bucketKey}, 1, ${retryAt}::timestamptz)
    on conflict (bucket_key) do update
      set count = excluded.count,
          reset_at = excluded.reset_at`

  return retryAt
}

export async function seedMerchantAuthVerificationLimit(
  sql: Sql,
  fixture: MerchantAuthLiveDbFixture,
  requestIdentity: string,
  durationMs = 15 * 60_000
): Promise<string> {
  assertLiveDbOptIn()
  const retryAt = new Date(Date.now() + durationMs).toISOString()
  const rawKey = [
    "merchant-verify",
    fixture.email.trim().toLowerCase(),
    requestIdentity.trim(),
  ].join(":")
  const bucketKey = createHash("sha256").update(rawKey).digest("hex")

  await sql`
    insert into public.rate_limit_buckets (bucket_key, count, reset_at)
    values (${bucketKey}, 5, ${retryAt}::timestamptz)
    on conflict (bucket_key) do update
      set count = excluded.count,
          reset_at = excluded.reset_at`

  return retryAt
}

export async function setMerchantAuthReservationRpcAvailable(
  sql: Sql,
  available: boolean
): Promise<void> {
  assertLiveDbOptIn()

  if (available) {
    await sql`
      grant execute on function public.reserve_merchant_email_otp_alias(
        text,
        text,
        text
      ) to service_role`
    return
  }

  await sql`
    revoke execute on function public.reserve_merchant_email_otp_alias(
      text,
      text,
      text
    ) from service_role`
}

export async function setMerchantAuthRateLimitRpcAvailable(
  sql: Sql,
  available: boolean
): Promise<void> {
  assertLiveDbOptIn()

  if (available) {
    await sql`
      grant execute on function public.enforce_rate_limit(
        text,
        integer,
        integer
      ) to public, service_role`
    return
  }

  await sql`
    revoke execute on function public.enforce_rate_limit(
      text,
      integer,
      integer
    ) from public, service_role`
}

export async function allowMerchantAuthProviderSend(
  sql: Sql,
  fixture: MerchantAuthLiveDbFixture
): Promise<void> {
  assertLiveDbOptIn()

  await sql`
    update auth.users
    set confirmation_sent_at = clock_timestamp() - interval '5 minutes',
        recovery_sent_at = clock_timestamp() - interval '5 minutes'
    where id = ${fixture.userId}::uuid`
}

export async function setMerchantAuthRateLimitReadAvailable(
  sql: Sql,
  available: boolean
): Promise<void> {
  assertLiveDbOptIn()

  if (available) {
    await sql`
      grant select on table public.rate_limit_buckets to service_role`
    return
  }

  await sql`
    revoke select on table public.rate_limit_buckets from service_role`
}

export async function restoreMerchantAuthLiveDbFaults(sql: Sql): Promise<void> {
  assertLiveDbOptIn()

  const cleanupErrors: Error[] = []
  for (const [label, cleanup] of [
    [
      "merchant auth reservation permission repair",
      () => setMerchantAuthReservationRpcAvailable(sql, true),
    ],
    [
      "merchant auth rate-limit permission repair",
      () => setMerchantAuthRateLimitRpcAvailable(sql, true),
    ],
    [
      "merchant auth rate-limit read permission repair",
      () => setMerchantAuthRateLimitReadAvailable(sql, true),
    ],
    [
      "merchant auth password fault cleanup",
      () => removeMerchantPasswordUpdateFault(sql),
    ],
  ] as const) {
    try {
      await cleanup()
    } catch (error) {
      cleanupErrors.push(asError(label, error))
    }
  }

  if (cleanupErrors.length > 0) {
    throw new AggregateError(
      cleanupErrors,
      "Unable to restore the merchant auth local proof database."
    )
  }
}

export async function cleanupMerchantAuthLiveDbFixture(
  sql: Sql,
  fixture: MerchantAuthLiveDbFixture | undefined,
  requestIdentity?: string
): Promise<void> {
  if (!fixture) return

  const cleanupErrors: Error[] = []

  try {
    await cleanupMerchantAuthAliasRows(sql, fixture.email)
  } catch (error) {
    cleanupErrors.push(asError("merchant auth alias cleanup", error))
  }

  if (requestIdentity) {
    try {
      await cleanupMerchantAuthRateLimitBuckets(
        sql,
        fixture.email,
        requestIdentity
      )
    } catch (error) {
      cleanupErrors.push(asError("merchant auth rate-limit cleanup", error))
    }
  }

  try {
    const { error } = await serviceRoleClient().auth.admin.deleteUser(
      fixture.userId
    )
    if (error) throw error
  } catch (error) {
    cleanupErrors.push(asError("merchant auth user cleanup", error))
  }

  if (cleanupErrors.length === 0) {
    try {
      await assertMerchantAuthFixtureRemoved(sql, fixture, requestIdentity)
    } catch (error) {
      cleanupErrors.push(asError("merchant auth cleanup readback", error))
    }
  }

  if (cleanupErrors.length > 0) {
    throw new AggregateError(
      cleanupErrors,
      `Unable to fully clean merchant auth fixture ${fixture.userId}.`
    )
  }
}

export async function cleanupMerchantAuthAliasRows(
  sql: Sql,
  email: string
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase()

  await sql`
    delete from public.merchant_email_otp_alias_attempts
    where email = ${normalizedEmail}`
  await sql`
    delete from public.merchant_email_otp_aliases
    where email = ${normalizedEmail}`
}

async function cleanupMerchantAuthRateLimitBuckets(
  sql: Sql,
  email: string,
  requestIdentity: string
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase()
  const normalizedIdentity = requestIdentity.trim()
  const rawKeys = [
    `merchant-signup:${normalizedEmail}:${normalizedIdentity}`,
    `merchant-signin:${normalizedEmail}:${normalizedIdentity}`,
    `merchant-verify:${normalizedEmail}:${normalizedIdentity}`,
    `merchant-otp-resend:signup:${normalizedEmail}:${normalizedIdentity}:cooldown`,
    `merchant-otp-resend:signup:${normalizedEmail}:${normalizedIdentity}:window`,
    `merchant-otp-resend:recovery:${normalizedEmail}:${normalizedIdentity}:cooldown`,
    `merchant-otp-resend:recovery:${normalizedEmail}:${normalizedIdentity}:window`,
  ]

  for (const rawKey of rawKeys) {
    const bucketKey = createHash("sha256").update(rawKey).digest("hex")
    await sql`
      delete from public.rate_limit_buckets
      where bucket_key = ${bucketKey}`
  }
}

async function createMerchantAuthLiveDbFixture(
  sql: Sql,
  purpose: MerchantAuthLivePurpose
): Promise<MerchantAuthLiveDbFixture> {
  assertLiveDbOptIn()

  const runId = randomUUID().replaceAll("-", "").slice(0, 16)
  const email = `merchant-auth-${purpose}-${runId}@example.test`
  const name = `Live auth ${purpose} ${runId.slice(0, 6)}`
  const supabase = serviceRoleClient()
  let userId: string | undefined

  try {
    const signup = await supabase.auth.admin.generateLink({
      type: "signup",
      email,
      password: INITIAL_PASSWORD,
      options: { data: { name } },
    })

    if (signup.error) {
      throw new Error(`local signup token generation: ${signup.error.message}`)
    }
    if (!signup.data.user || !signup.data.properties?.email_otp) {
      throw new Error("local signup token generation returned incomplete data")
    }

    userId = signup.data.user.id
    let providerToken = signup.data.properties.email_otp

    if (purpose === "recovery") {
      const confirmation = await supabase.auth.admin.updateUserById(userId, {
        email_confirm: true,
      })
      if (confirmation.error) {
        throw new Error(
          `local recovery user confirmation: ${confirmation.error.message}`
        )
      }

      const recovery = await supabase.auth.admin.generateLink({
        type: "recovery",
        email,
      })
      if (recovery.error) {
        throw new Error(
          `local recovery token generation: ${recovery.error.message}`
        )
      }
      if (
        !recovery.data.user ||
        recovery.data.user.id !== userId ||
        !recovery.data.properties?.email_otp
      ) {
        throw new Error(
          "local recovery token generation returned incomplete data"
        )
      }
      providerToken = recovery.data.properties.email_otp
    }

    if (!/^\d{6}$/.test(providerToken)) {
      throw new Error("local Supabase did not generate a six-digit email OTP")
    }

    const aliasCode = visibleAliasCode(purpose, providerToken)
    const { data: aliasId, error: aliasError } = await supabase.rpc(
      "create_merchant_email_otp_alias",
      {
        p_alias_code: aliasCode,
        p_email: email,
        p_expires_at: new Date(Date.now() + ALIAS_LIFETIME_MS).toISOString(),
        p_purpose: purpose,
        p_supabase_token: encryptOtpAliasToken(providerToken),
      }
    )

    if (aliasError) {
      throw new Error(`local merchant alias creation: ${aliasError.message}`)
    }
    if (typeof aliasId !== "string") {
      throw new Error("local merchant alias creation returned no alias id")
    }

    const fixture: MerchantAuthLiveDbFixture = {
      aliasCode,
      aliasId,
      email,
      initialPassword: INITIAL_PASSWORD,
      name,
      nextPath: `/app/onboarding?proof=live-${purpose}`,
      providerToken,
      purpose,
      replacementPassword: REPLACEMENT_PASSWORD,
      userId,
    }

    await assertMerchantAuthAliasPrepared(sql, fixture)
    return fixture
  } catch (error) {
    const cleanupErrors: Error[] = []
    try {
      await cleanupMerchantAuthAliasRows(sql, email)
    } catch (cleanupError) {
      cleanupErrors.push(
        asError("merchant auth partial alias cleanup", cleanupError)
      )
    }
    if (userId) {
      try {
        const { error: deleteError } =
          await supabase.auth.admin.deleteUser(userId)
        if (deleteError) throw deleteError
      } catch (cleanupError) {
        cleanupErrors.push(
          asError("merchant auth partial user cleanup", cleanupError)
        )
      }
    }
    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        [asError("merchant auth fixture creation", error), ...cleanupErrors],
        "Merchant auth fixture creation failed and cleanup was incomplete."
      )
    }
    throw error
  }
}

async function assertMerchantAuthFixtureRemoved(
  sql: Sql,
  fixture: MerchantAuthLiveDbFixture,
  requestIdentity?: string
): Promise<void> {
  const rows = await sql<readonly CleanupCountRow[]>`
    select
      (select count(*)::int
       from public.merchant_email_otp_aliases
       where email = ${fixture.email}) as aliases,
      (select count(*)::int
       from public.merchant_email_otp_alias_attempts
       where email = ${fixture.email}) as attempts,
      (select count(*)::int
       from auth.sessions
       where user_id = ${fixture.userId}::uuid) as sessions,
      (select count(*)::int
       from auth.users
       where id = ${fixture.userId}::uuid) as users`
  const counts = rows.at(0)

  expect(counts).toEqual({ aliases: 0, attempts: 0, sessions: 0, users: 0 })

  if (!requestIdentity) return
  const normalizedEmail = fixture.email.trim().toLowerCase()
  const normalizedIdentity = requestIdentity.trim()
  const rawKeys = [
    `merchant-signup:${normalizedEmail}:${normalizedIdentity}`,
    `merchant-signin:${normalizedEmail}:${normalizedIdentity}`,
    `merchant-verify:${normalizedEmail}:${normalizedIdentity}`,
    `merchant-otp-resend:signup:${normalizedEmail}:${normalizedIdentity}:cooldown`,
    `merchant-otp-resend:signup:${normalizedEmail}:${normalizedIdentity}:window`,
    `merchant-otp-resend:recovery:${normalizedEmail}:${normalizedIdentity}:cooldown`,
    `merchant-otp-resend:recovery:${normalizedEmail}:${normalizedIdentity}:window`,
  ]

  for (const rawKey of rawKeys) {
    const bucketKey = createHash("sha256").update(rawKey).digest("hex")
    const buckets = await sql<readonly CountRow[]>`
      select count(*)::int as count
      from public.rate_limit_buckets
      where bucket_key = ${bucketKey}`
    expect(buckets.at(0)?.count ?? 0).toBe(0)
  }
}

async function readAliasRow(
  sql: Sql,
  aliasId: string
): Promise<AliasRow | undefined> {
  const rows = await sql<readonly AliasRow[]>`
    select
      id::text as id,
      email,
      alias_code,
      supabase_token,
      purpose,
      reservation_id::text as reservation_id,
      reserved_until::text as reserved_until,
      resolution,
      consumed_at::text as consumed_at
    from public.merchant_email_otp_aliases
    where id = ${aliasId}::uuid`

  return rows.at(0)
}

function serviceRoleClient() {
  assertLiveDbOptIn()

  return createClient(
    requiredLocalSupabaseUrl(),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function visibleAliasCode(
  purpose: MerchantAuthLivePurpose,
  providerToken: string
): string {
  const candidates =
    purpose === "signup" ? ["731001", "731003"] : ["731002", "731004"]
  const aliasCode = candidates.find((candidate) => candidate !== providerToken)

  if (!aliasCode) {
    throw new Error("Unable to choose a non-secret visible alias code.")
  }
  return aliasCode
}

function assertLiveDbOptIn(): void {
  const reason = merchantAuthRecoveryLiveDbSkipReason()
  if (reason) throw new Error(`Merchant auth live DB proof refused: ${reason}.`)
}

function requiredLocalSupabaseUrl(): string {
  const url = localUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must point at local Supabase.")
  }
  return url
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required for merchant auth proof.`)
  return value
}

function localUrl(value: string | undefined): string | undefined {
  const rawUrl = value?.trim()
  if (!rawUrl) return undefined

  try {
    const url = new URL(rawUrl)
    return LOCAL_HOSTS.has(url.hostname) &&
      ["http:", "https:"].includes(url.protocol)
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
      ["postgres:", "postgresql:"].includes(url.protocol)
      ? rawUrl
      : undefined
  } catch {
    return undefined
  }
}

function localEmailHookUrl(value: string): URL {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error("Merchant auth email-hook sink URI must be a valid URL.")
  }

  if (
    url.protocol !== "http:" ||
    !LOCAL_EMAIL_HOOK_HOSTS.has(url.hostname) ||
    url.pathname !== "/api/auth/hooks/send-email" ||
    !url.port
  ) {
    throw new Error(
      "Merchant auth email-hook sink URI must be an explicit local HTTP endpoint."
    )
  }
  return url
}

function runningLocalAuthHookUri(): string {
  let containerNames: string
  try {
    containerNames = execFileSync(
      "docker",
      [
        "ps",
        "--filter",
        "label=com.supabase.cli.project=Nabaperks",
        "--filter",
        "name=supabase_auth_",
        "--format",
        "{{.Names}}",
      ],
      { encoding: "utf8" }
    )
  } catch {
    throw new Error(
      "Merchant auth live proof could not inspect the local Auth container."
    )
  }

  const names = containerNames
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter(Boolean)
  if (names.length !== 1) {
    throw new Error(
      "Merchant auth live proof requires exactly one local Auth container."
    )
  }

  try {
    return execFileSync(
      "docker",
      ["exec", names[0], "printenv", "GOTRUE_HOOK_SEND_EMAIL_URI"],
      { encoding: "utf8" }
    ).trim()
  } catch {
    throw new Error(
      "Merchant auth live proof could not read the local Auth hook URI."
    )
  }
}

function asError(label: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : "unknown error"
  return new Error(`${label}: ${message}`)
}
