import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import postgres from "postgres"

import { dbUrl } from "./helpers/db.mjs"

const ADMIN_UID = "00000000-0000-0000-0000-000000000001"
const EXPORT_FUNCTION = "public.admin_export_customer_data(uuid,uuid,text,text)"
const EXPECTED_CUSTOMER_RELATIONS = [
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
    select relation_name, disposition, reason_code, export_section
    from public.personal_data_relation_manifest
    order by relation_name`
    const publicRelations = manifest
      .filter((row) => row.relation_name.startsWith("public."))
      .map((row) => row.relation_name.slice("public.".length))

    assert.deepEqual(publicRelations, EXPECTED_CUSTOMER_RELATIONS)
    assert.equal(
      new Set(manifest.map((row) => row.relation_name)).size,
      manifest.length
    )
    assert.ok(manifest.length > 0, "the manifest is non-empty")
    assert.ok(
      manifest.every((row) =>
        row.disposition === "included"
          ? typeof row.export_section === "string" &&
            row.reason_code === "data_subject_access"
          : row.export_section === null &&
            row.reason_code === "security_credential_store"
      ),
      "every manifest row has a canonical machine-readable disposition reason"
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

    const included = payload.manifest.filter(
      (row) => row.disposition === "included"
    )
    assert.ok(payload.snapshot_id, "the export has a non-empty snapshot id")
    assert.equal(payload.manifest_snapshot_id, payload.snapshot_id)
    assert.ok(included.length > 0, "the export has included governed relations")
    for (const row of included) {
      assert.equal(
        payload.sections[row.export_section].snapshot_id,
        payload.snapshot_id
      )
      assert.ok(Array.isArray(payload.sections[row.export_section].rows))
    }
  }
)

test(
  "export sees a concurrent mutation wholly before or after",
  { skip, timeout: 10_000 },
  async () => {
    const control = client("manifest-export-control")
    const locker = client("manifest-export-locker")
    const exporter = client("manifest-export-concurrency")
    const mutator = client("manifest-export-mutator")
    const subject = await pickSubject(control)
    const originalName = subject.full_name
    const changedName = `snapshot-${randomUUID()}`
    const marker = randomUUID()
    const notes = `Snapshot proof ${randomUUID()}`

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
      ) as payload`

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
          'email', 'granted', 'admin', 'snapshot-test', ${JSON.stringify({ marker })}::jsonb
        )`
      })
      await locker`commit`

      const [{ payload }] = await exportPromise
      const exportedName =
        payload.sections?.customers?.rows?.[0]?.full_name ??
        payload.customer.full_name
      const consentRows =
        payload.sections?.consent_records?.rows ?? payload.consent_records
      const sawMutation = consentRows.some(
        (row) => row.metadata?.marker === marker
      )
      const whollyBefore = exportedName === originalName && !sawMutation
      const whollyAfter = exportedName === changedName && sawMutation

      assert.ok(
        whollyBefore || whollyAfter,
        "companions must never contain a mixed snapshot"
      )
    } finally {
      await locker`rollback`
      await control`
      delete from public.audit_logs
      where customer_id = ${subject.customer_id}::uuid
        and metadata ->> 'notes' = ${notes}`
      await control`
      delete from public.consent_records
      where customer_id = ${subject.customer_id}::uuid
        and policy_version = 'snapshot-test'
        and metadata ->> 'marker' = ${marker}`
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
      has_function_privilege('service_role', ${EXPORT_FUNCTION}, 'execute') as service_role`
    assert.deepEqual(acl, {
      anon: false,
      authenticated: false,
      service_role: true,
    })

    await actAsAdmin(sql)
    await assert.rejects(
      sql`select public.admin_export_customer_data(
      ${randomUUID()}::uuid, ${randomUUID()}::uuid, 'email', 'Missing subject'
    )`,
      /membership context not found/i
    )
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

async function actAsAdmin(sql) {
  await sql`select set_config('request.jwt.claim.role', 'authenticated', false)`
  await sql`select set_config('request.jwt.claim.sub', ${ADMIN_UID}, false)`
  await sql`select set_config('request.jwt.claim.aal', 'aal2', false)`
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

function isLoopbackUrl(value) {
  try {
    return ["127.0.0.1", "localhost", "::1"].includes(new URL(value).hostname)
  } catch {
    return false
  }
}
