import { randomUUID } from "node:crypto"
import postgres from "postgres"

const LOCAL_DB_HOSTS = ["127.0.0.1", "localhost"] as const

export type Sql = ReturnType<typeof postgres>

type CountRow = {
  readonly count: number
}

type FraudStatusRow = {
  readonly status: string
}

type MerchantOwnerEmailRow = {
  readonly email: string
}

export type SeedMembership = {
  readonly membership_id: string
  readonly merchant_id: string
  readonly customer_id: string
}

export type AdminBrowserFixture = {
  readonly membership: SeedMembership
  readonly flagId: string
  readonly fraudReviewReason: string
  readonly optOutReason: string
  readonly dataRequestNotes: string
}

type AdminAuditAction =
  | "consent_opt_out_recorded"
  | "data_request_logged"
  | "fraud_flag_resolved"

function resolveLocalDbUrl(): string | undefined {
  const rawUrl = process.env.SUPABASE_DB_URL?.trim()
  if (!rawUrl) return undefined

  try {
    const dbUrl = new URL(rawUrl)
    if (dbUrl.protocol !== "postgres:" && dbUrl.protocol !== "postgresql:") {
      return undefined
    }
    return LOCAL_DB_HOSTS.some((host) => host === dbUrl.hostname)
      ? rawUrl
      : undefined
  } catch (error) {
    if (error instanceof TypeError) return undefined
    throw error
  }
}

export function adminLiveDbSkipReason(): string | undefined {
  if (process.env.ADMIN_LIVE_DB_E2E !== "1") {
    return "set ADMIN_LIVE_DB_E2E=1 with local Supabase to run admin browser proof"
  }
  if (!resolveLocalDbUrl()) {
    return "SUPABASE_DB_URL must point at local Supabase Postgres"
  }
  return undefined
}

export function connectLocalDb(): Sql | undefined {
  const dbUrl = resolveLocalDbUrl()
  if (!dbUrl) return undefined

  return postgres(dbUrl, {
    idle_timeout: 5,
    max: 1,
  })
}

export async function seedMerchantOwnerEmail(
  sql: Sql,
  businessSlug: string
): Promise<string | undefined> {
  const rows = await sql<readonly MerchantOwnerEmailRow[]>`
    select users.email
    from public.merchants
    join auth.users
      on users.id = merchants.owner_user_id
    where merchants.business_slug = ${businessSlug}
    limit 1`

  return rows.at(0)?.email
}

export function createAdminBrowserFixture(
  membership: SeedMembership
): AdminBrowserFixture {
  const runId = randomUUID()

  return {
    membership,
    flagId: randomUUID(),
    fraudReviewReason: `Browser fraud review ${runId}`,
    optOutReason: `Browser opt-out ${runId}`,
    dataRequestNotes: `Browser data request ${runId}`,
  }
}

export async function databaseIsReady(sql: Sql): Promise<boolean> {
  const rows = await sql<readonly CountRow[]>`
    select count(*)::int as count
    from pg_proc
    where proname in (
      'admin_resolve_fraud_flag',
      'admin_record_consent_opt_out',
      'admin_log_data_request',
      'admin_record_unaffiliated_consent_opt_out',
      'admin_log_unaffiliated_data_request'
    )`

  return (rows.at(0)?.count ?? 0) >= 5
}

export async function pickSeedMembership(
  sql: Sql
): Promise<SeedMembership | undefined> {
  const rows = await sql<readonly SeedMembership[]>`
    select
      id::text as membership_id,
      merchant_id::text as merchant_id,
      customer_id::text as customer_id
    from public.customer_memberships
    where id = '16000000-0000-0000-0000-000000000002'::uuid
    limit 1`

  return rows.at(0)
}

export async function insertFraudFlag(
  sql: Sql,
  fixture: AdminBrowserFixture
): Promise<void> {
  await sql`
    insert into public.fraud_flags (
      id,
      merchant_id,
      customer_id,
      membership_id,
      signal,
      severity,
      status,
      metadata
    )
    values (
      ${fixture.flagId}::uuid,
      ${fixture.membership.merchant_id}::uuid,
      ${fixture.membership.customer_id}::uuid,
      ${fixture.membership.membership_id}::uuid,
      'high_stamp_velocity',
      'medium',
      'open',
      jsonb_build_object(
        'source', 'admin-live-db-e2e',
        'reason', 'browser_admin_review',
        'location_status', 'outside_geofence',
        'distance_bucket', '100m+',
        'accuracy_bucket', 'coarse',
        'confidence', 'medium'
      )
    )`
}

export async function cleanupAdminRows(
  sql: Sql,
  fixture: AdminBrowserFixture
): Promise<void> {
  await sql`
    delete from public.audit_logs
    where target_id = ${fixture.flagId}::uuid
      or metadata ->> 'reason' = ${fixture.fraudReviewReason}
      or metadata ->> 'reason' = ${fixture.optOutReason}
      or metadata ->> 'notes' = ${fixture.dataRequestNotes}`
  await sql`
    delete from public.consent_records
    where metadata ->> 'reason' = ${fixture.optOutReason}`
  await sql`
    delete from public.fraud_flags
    where id = ${fixture.flagId}::uuid`
}

export async function fraudFlagStatus(
  sql: Sql,
  flagId: string
): Promise<string> {
  const rows = await sql<readonly FraudStatusRow[]>`
    select status
    from public.fraud_flags
    where id = ${flagId}::uuid`

  return rows.at(0)?.status ?? "missing"
}

export async function auditCountByReason(
  sql: Sql,
  action: AdminAuditAction,
  reason: string
): Promise<number> {
  const rows = await sql<readonly CountRow[]>`
    select count(*)::int as count
    from public.audit_logs
    where action = ${action}
      and metadata ->> 'reason' = ${reason}`

  return rows.at(0)?.count ?? 0
}

export async function auditCountByNotes(
  sql: Sql,
  notes: string
): Promise<number> {
  const rows = await sql<readonly CountRow[]>`
    select count(*)::int as count
    from public.audit_logs
    where action = 'data_request_logged'
      and metadata ->> 'notes' = ${notes}`

  return rows.at(0)?.count ?? 0
}

export async function consentCountByReason(
  sql: Sql,
  reason: string
): Promise<number> {
  const rows = await sql<readonly CountRow[]>`
    select count(*)::int as count
    from public.consent_records
    where metadata ->> 'reason' = ${reason}`

  return rows.at(0)?.count ?? 0
}
