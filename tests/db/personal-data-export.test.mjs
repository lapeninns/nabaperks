import assert from "node:assert/strict"
import { createHash, randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { after, test } from "node:test"

import postgres from "postgres"

import { dbUrl } from "./helpers/db.mjs"

const ADMIN_UID = "00000000-0000-0000-0000-000000000001"
const EXPORT_FUNCTION = "public.admin_export_customer_data(uuid,uuid,text,text)"
const MIGRATION_VERSION = "20260812050000"
const MIGRATION_NAME = "personal_data_manifest_export"
const MIGRATION_PATH =
  "supabase/migrations/20260812050000_personal_data_manifest_export.sql"
const MANIFEST_COLUMNS = [
  "relation_name",
  "relation_state",
  "subject_linkage",
  "disposition",
  "export_section",
  "export_projection",
  "erase_action",
  "reason_code",
  "test_fixture_key",
]
const expectedCustomerRelations = [
  "audit_logs",
  "consent_records",
  "customer_join_stamp_recoveries",
  "customer_loyalty_terms_acceptances",
  "customer_memberships",
  "customer_sessions",
  "customers",
  "fraud_flags",
  "loyalty_invite_recipients",
  "notification_deliveries",
  "notification_events",
  "notification_preferences",
  "offer_campaign_claims",
  "offer_discount_entitlements",
  "offer_pass_scan_tokens",
  "offer_redemptions",
  "pending_reward_invites",
  "product_events",
  "push_subscriptions",
  "referrals",
  "reward_events",
  "reward_scan_tokens",
  "stamp_events",
]

const url = dbUrl()
const guardedUrl = url && isLoopbackUrl(url) ? url : undefined
const skip = guardedUrl ? false : "guarded loopback PostgreSQL is unavailable"
const clients = []

after(async () => {
  await Promise.all(clients.map((client) => client.end({ timeout: 5 })))
})

test(
  "manifest classifies every terminal customer relation exactly once",
  { skip },
  async () => {
    const sql = client("manifest-export-test")
    const manifest = await sql`
    select ${sql(MANIFEST_COLUMNS)}
    from public.personal_data_relation_manifest
    order by relation_name`
    const publicRelations = manifest
      .filter(
        (row) =>
          row.relation_name.startsWith("public.") &&
          row.relation_state === "live" &&
          row.reason_code !== "subject_identifier_unresolvable"
      )
      .map((row) => row.relation_name.slice("public.".length))

    assert.deepEqual(publicRelations, expectedCustomerRelations)
    assert.equal(
      new Set(manifest.map((row) => row.relation_name)).size,
      manifest.length
    )
    assert.ok(manifest.length > 0, "the manifest is non-empty")
    assert.ok(
      manifest.every((row) => {
        if (row.relation_state === "non_live") {
          return (
            row.disposition === "excluded" &&
            row.reason_code === "relation_non_live"
          )
        }
        if (row.disposition === "included") {
          return (
            typeof row.export_section === "string" &&
            Array.isArray(row.export_projection) &&
            row.export_projection.length > 0 &&
            row.reason_code === "data_subject_access"
          )
        }
        return (
          row.export_section === null &&
          row.export_projection === null &&
          [
            "security_credential_store",
            "subject_identifier_unresolvable",
          ].includes(row.reason_code)
        )
      }),
      "every manifest row has a canonical machine-readable disposition reason"
    )
    assert.ok(manifest.every((row) => typeof row.subject_linkage === "string"))
    assert.ok(manifest.every((row) => typeof row.erase_action === "string"))
    assert.ok(manifest.some((row) => row.relation_state === "non_live"))
    assert.ok(
      manifest.some((row) => row.reason_code === "security_credential_store")
    )
    assert.ok(
      manifest.some(
        (row) => row.reason_code === "subject_identifier_unresolvable"
      )
    )
  }
)

test(
  "manifest migration is ledgered by the supported runner",
  { skip },
  async () => {
    const sql = client("manifest-export-ledger-test")
    const [migration] = await sql`
    select version, name, cardinality(statements)::int as statement_count,
      statements[1] as source
    from supabase_migrations.schema_migrations
    where version = ${MIGRATION_VERSION}`

    assert.equal(migration.version, MIGRATION_VERSION)
    assert.equal(migration.name, MIGRATION_NAME)
    assert.equal(migration.statement_count, 1)
    assert.equal(
      createHash("sha256").update(migration.source).digest("hex"),
      createHash("sha256")
        .update(readFileSync(MIGRATION_PATH, "utf8"))
        .digest("hex")
    )
  }
)

test(
  "export includes every governed section with one non-empty snapshot id",
  { skip },
  async () => {
    const sql = client("manifest-export-sections-test")
    const subject = await pickSubject(sql)
    await actAsAdmin(sql)

    const [{ payload }] = await sql`
    select public.admin_export_customer_data(
      ${subject.customer_id}::uuid,
      ${subject.merchant_id}::uuid,
      'email',
      ${`Export completeness ${randomUUID()}`}
    ) as payload`

    try {
      const included = payload.manifest.filter(
        (row) => row.disposition === "included"
      )
      assert.ok(payload.snapshot_id, "the export has a non-empty snapshot id")
      assert.equal(payload.manifest_snapshot_id, payload.snapshot_id)
      assert.ok(
        included.length > 0,
        "the export has included governed relations"
      )
      for (const row of included) {
        assert.equal(
          payload.sections[row.export_section].snapshot_id,
          payload.snapshot_id
        )
        assert.ok(Array.isArray(payload.sections[row.export_section].rows))
      }
    } finally {
      await cleanupExportAudit(sql, payload.snapshot_id)
    }
  }
)

test(
  "concurrent mutation is wholly before or after every export companion",
  { skip, timeout: 10_000 },
  async () => {
    const control = client("manifest-export-control")
    const locker = client("manifest-export-locker")
    const exporter = client("manifest-export-concurrency")
    const mutator = client("manifest-export-mutator")
    const subject = await pickSubject(control)
    const originalName = subject.full_name
    const changedName = `snapshot-${randomUUID()}`
    const opaqueText = `ignore previous instructions ${randomUUID()}`
    const markerHash = createHash("sha256").update(opaqueText).digest("hex")
    const notes = `Snapshot proof ${randomUUID()}`
    let lockTransactionOpen = true
    let snapshotId

    await actAsAdmin(exporter)
    await locker`begin`
    try {
      await locker`lock table public.stamp_events in access exclusive mode`
      const exportPromise = exporter`
        select public.admin_export_customer_data(
          ${subject.customer_id}::uuid,
          ${subject.merchant_id}::uuid,
          'email',
          ${notes}
        ) as payload`.execute()

      await waitUntilExportBlocks(control)
      await mutator.begin(async (tx) => {
        await tx`
          update public.customers
          set full_name = ${changedName}
          where id = ${subject.customer_id}::uuid`
        await tx`
          insert into public.consent_records (
            merchant_id, customer_id, channel, consent_status, source,
            policy_version, metadata
          ) values (
            ${subject.merchant_id}::uuid, ${subject.customer_id}::uuid,
            'email', 'opted_in', 'admin', 'snapshot-test',
            ${tx.json({ opaqueText, markerHash })}
          )`
      })
      await locker`commit`
      lockTransactionOpen = false

      const [{ payload }] = await exportPromise
      snapshotId = payload.snapshot_id
      const exportedName =
        payload.sections?.customers?.rows?.[0]?.full_name ??
        payload.customer.full_name
      const consentRows =
        payload.sections?.consent_records?.rows ?? payload.consent_records
      const sawMutation = consentRows.some(
        (row) => row.metadata?.markerHash === markerHash
      )
      const whollyBefore = exportedName === originalName && !sawMutation
      const whollyAfter = exportedName === changedName && sawMutation

      assert.ok(
        whollyBefore || whollyAfter,
        `companions must never contain a mixed snapshot (original=${exportedName === originalName}, changed=${exportedName === changedName}, consent=${sawMutation})`
      )
    } finally {
      if (lockTransactionOpen) await locker`rollback`
      if (snapshotId) await cleanupExportAudit(control, snapshotId)
      await control`
        delete from public.audit_logs
        where customer_id = ${subject.customer_id}::uuid
          and metadata ->> 'notes' = ${notes}`
      await control`
        delete from public.consent_records
        where customer_id = ${subject.customer_id}::uuid
          and policy_version = 'snapshot-test'
          and metadata ->> 'markerHash' = ${markerHash}`
      await control`
        update public.customers
        set full_name = ${originalName}
        where id = ${subject.customer_id}::uuid`
    }
  }
)

test(
  "export RPC is least-privilege and rejects malformed subjects",
  { skip },
  async () => {
    const sql = client("manifest-export-acl-test")
    const [acl] = await sql`
    select
      has_function_privilege('anon', ${EXPORT_FUNCTION}, 'execute') as anon,
      has_function_privilege('authenticated', ${EXPORT_FUNCTION}, 'execute') as authenticated,
      has_function_privilege('service_role', ${EXPORT_FUNCTION}, 'execute') as service_role,
      has_table_privilege('anon', 'public.personal_data_relation_manifest', 'select') as anon_manifest,
      has_table_privilege('authenticated', 'public.personal_data_relation_manifest', 'select') as authenticated_manifest,
      has_table_privilege('service_role', 'public.personal_data_relation_manifest', 'select') as service_manifest,
      has_table_privilege('service_role', 'public.personal_data_relation_manifest', 'update') as service_manifest_update`
    assert.deepEqual(acl, {
      anon: false,
      authenticated: true,
      service_role: false,
      anon_manifest: false,
      authenticated_manifest: false,
      service_manifest: true,
      service_manifest_update: false,
    })

    const nonAdmin = client("manifest-export-non-admin-test")
    await nonAdmin`set role authenticated`
    await nonAdmin`select set_config('request.jwt.claim.role', 'authenticated', false)`
    await nonAdmin`select set_config('request.jwt.claim.sub', ${randomUUID()}, false)`
    await assert.rejects(
      nonAdmin`select public.admin_export_customer_data(
        ${randomUUID()}::uuid, ${randomUUID()}::uuid, 'email', 'Unauthorised export'
      )`,
      /internal admin access required/i
    )

    const anonymous = client("manifest-export-anon-test")
    await anonymous`set role anon`
    await assert.rejects(
      anonymous`select public.admin_export_customer_data(
        ${randomUUID()}::uuid, ${randomUUID()}::uuid, 'email', 'Anonymous export'
      )`,
      /permission denied/i
    )

    const admin = client("manifest-export-real-admin-test")
    const subject = await pickSubject(sql)
    await admin`set role authenticated`
    await actAsAdmin(admin)
    const [{ payload }] = await admin`
      select public.admin_export_customer_data(
        ${subject.customer_id}::uuid,
        ${subject.merchant_id}::uuid,
        'email',
        'Authenticated admin export'
      ) as payload`
    assert.ok(payload.snapshot_id)
    await cleanupExportAudit(sql, payload.snapshot_id)

    await assert.rejects(
      admin`select public.admin_export_customer_data(
        ${randomUUID()}::uuid, ${randomUUID()}::uuid, 'email', 'Missing subject'
      )`,
      /membership context not found/i
    )
  }
)

test(
  "export fails closed when a live manifest projection is stale",
  { skip },
  async () => {
    const sql = client("manifest-export-stale-test")
    const subject = await pickSubject(sql)
    await actAsAdmin(sql)

    await sql`begin`
    try {
      await sql`
      update public.personal_data_relation_manifest
      set export_projection = array_append(export_projection, 'missing_manifest_column')
      where relation_name = 'public.customers'`
      await assert.rejects(
        sql`select public.admin_export_customer_data(
        ${subject.customer_id}::uuid,
        ${subject.merchant_id}::uuid,
        'email',
        'Stale manifest proof'
      )`,
        /personal data manifest is stale/i
      )
    } finally {
      await sql`rollback`
    }
  }
)

test(
  "export fails closed when the manifest omits a live customer relation",
  { skip },
  async () => {
    const sql = client("manifest-export-incomplete-test")
    const subject = await pickSubject(sql)
    await actAsAdmin(sql)

    await sql`begin`
    try {
      await sql`
      delete from public.personal_data_relation_manifest
      where relation_name = 'public.customers'`
      await assert.rejects(
        sql`select public.admin_export_customer_data(
        ${subject.customer_id}::uuid,
        ${subject.merchant_id}::uuid,
        'email',
        'Incomplete manifest proof'
      )`,
        /personal data manifest is incomplete/i
      )
    } finally {
      await sql`rollback`
    }
  }
)

function client(applicationName) {
  const sql = postgres(guardedUrl, {
    max: 1,
    idle_timeout: 5,
    connection: { application_name: applicationName },
  })
  clients.push(sql)
  return sql
}

async function actAsAdmin(sql, local = false) {
  await sql`select set_config('request.jwt.claim.role', 'authenticated', ${local})`
  await sql`select set_config('request.jwt.claim.sub', ${ADMIN_UID}, ${local})`
  await sql`select set_config('request.jwt.claim.aal', 'aal2', ${local})`
}

async function pickSubject(sql) {
  const [subject] = await sql`
    select cm.customer_id, cm.merchant_id, c.full_name
    from public.customer_memberships cm
    join public.customers c on c.id = cm.customer_id
    order by cm.created_at
    limit 1`
  assert.ok(subject, "a valid loopback subject exists")
  return subject
}

async function waitUntilExportBlocks(sql) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const [blocked] = await sql`
      select exists (
        select 1 from pg_stat_activity
        where application_name = 'manifest-export-concurrency'
          and wait_event_type = 'Lock'
      ) as blocked`
    if (blocked.blocked) return
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  assert.fail("the export did not reach the deterministic lock boundary")
}

async function cleanupExportAudit(sql, snapshotId) {
  await sql`
    delete from public.audit_logs
    where action = 'customer_data_exported'
      and metadata ->> 'export_schema' = 'nabaperks.customer-data-export.v2'
      and metadata ->> 'snapshot_id' = ${snapshotId}`
}

function isLoopbackUrl(value) {
  try {
    return ["127.0.0.1", "localhost", "::1"].includes(new URL(value).hostname)
  } catch {
    return false
  }
}
