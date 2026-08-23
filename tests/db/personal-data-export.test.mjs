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
    select relation_name, relation_state, disposition, reason_code, export_section
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
            [
              "security_credential_store",
              "subject_identifier_unresolvable",
              "relation_non_live",
            ].includes(row.reason_code)
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
    const [{ locker_pid: lockerPid }] =
      await locker`select pg_backend_pid() as locker_pid`
    let settleExport = Promise.resolve()
    let exporterFacts
    let insertedConsentId
    let mutatorFacts
    let postCommitFacts
    try {
      await locker`lock table public.stamp_events in access exclusive mode`
      let identifyExporter
      const exporterIdentified = new Promise((resolve) => {
        identifyExporter = resolve
      })
      const exportPromise = exporter.begin(async (tx) => {
        const [{ exporter_pid: exporterPid }] =
          await tx`select pg_backend_pid() as exporter_pid`
        await tx`select set_config('application_name', 'manifest-export-concurrency', true)`
        identifyExporter(exporterPid)
        const [isolation] = await tx`show transaction_isolation`
        const [{ snapshot_id: snapshotId }] =
          await tx`select txid_current_snapshot()::text as snapshot_id`
        exporterFacts = {
          transactionIsolation: isolation.transaction_isolation,
          snapshotId,
        }
        const rows = await tx`
          select public.admin_export_customer_data(
            ${subject.customer_id}::uuid,
            ${subject.merchant_id}::uuid,
            'email',
            ${notes}
          ) as payload`
        const [{ snapshot_id: afterRpcSnapshotId }] =
          await tx`select txid_current_snapshot()::text as snapshot_id`
        exporterFacts.afterRpcSnapshotId = afterRpcSnapshotId
        return rows
      })
      settleExport = exportPromise.then(
        () => undefined,
        () => undefined
      )

      await waitUntilExportBlocks(control, await exporterIdentified, lockerPid)
      await mutator.begin(async (tx) => {
        const [isolation] = await tx`show transaction_isolation`
        await tx`
        update public.customers
        set full_name = ${changedName}
        where id = ${subject.customer_id}::uuid`
        const [{ id }] = await tx`
        insert into public.consent_records (
          merchant_id, customer_id, channel, consent_status, source,
          policy_version, metadata
        ) values (
          ${subject.merchant_id}::uuid, ${subject.customer_id}::uuid,
          'email', 'opted_in', 'admin', 'snapshot-test', ${tx.json({ marker })}::jsonb
        ) returning id`
        insertedConsentId = id
        const [
          {
            mutation_txid_present: mutationTxidPresent,
            snapshot_id: snapshotId,
          },
        ] = await tx`select txid_current() is not null as mutation_txid_present,
                          txid_current_snapshot()::text as snapshot_id`
        mutatorFacts = {
          insertedConsentIdPresent: Boolean(insertedConsentId),
          mutationTxidPresent,
          transactionIsolation: isolation.transaction_isolation,
          snapshotId,
        }
      })
      const [visibility] = await control`
        select
          exists (
            select 1 from public.customers
            where id = ${subject.customer_id}::uuid
              and full_name = ${changedName}
          ) as changed_customer_visible,
          exists (
            select 1 from public.consent_records
            where id = ${insertedConsentId}::uuid
              and customer_id = ${subject.customer_id}::uuid
              and policy_version = 'snapshot-test'
              and metadata ->> 'marker' = ${marker}
          ) as inserted_consent_visible,
          txid_current_snapshot()::text as snapshot_id`
      postCommitFacts = {
        changedCustomerVisible: visibility.changed_customer_visible,
        insertedConsentVisible: visibility.inserted_consent_visible,
        visibleTogether:
          visibility.changed_customer_visible &&
          visibility.inserted_consent_visible,
        snapshotId: visibility.snapshot_id,
      }
      await locker`commit`

      const [{ payload }] = await exportPromise
      const rawCustomersSectionRows = payload.sections?.customers?.rows
      const rawConsentSectionRows = payload.sections?.consent_records?.rows
      const rawCustomersRows = Array.isArray(rawCustomersSectionRows)
        ? rawCustomersSectionRows
        : []
      const rawConsentRows = Array.isArray(rawConsentSectionRows)
        ? rawConsentSectionRows
        : []
      const exportedName =
        rawCustomersRows[0]?.full_name ?? payload.customer.full_name
      const consentRows = Array.isArray(rawConsentSectionRows)
        ? rawConsentRows
        : payload.consent_records
      const customersRowCount = Array.isArray(rawCustomersSectionRows)
        ? rawCustomersRows.length
        : 1
      const exportedNameClass =
        exportedName === originalName
          ? "original"
          : exportedName === changedName
            ? "changed"
            : "other"
      const sawMutation = consentRows.some(
        (row) => row.metadata?.marker === marker
      )
      const metadataKinds = rawConsentRows.map((row) =>
        row.metadata === null
          ? "null"
          : Array.isArray(row.metadata)
            ? "array"
            : typeof row.metadata === "object"
              ? "object"
              : "other"
      )
      const whollyBefore = exportedName === originalName && !sawMutation
      const whollyAfter = exportedName === changedName && sawMutation

      assert.ok(
        whollyBefore || whollyAfter,
        `snapshot classification: ${JSON.stringify({
          exportedNameClass,
          sawMutation,
          rawCustomersRowsIsArray: Array.isArray(rawCustomersSectionRows),
          rawConsentRowsIsArray: Array.isArray(rawConsentSectionRows),
          customersRowCount,
          consentRowsCount: consentRows.length,
          insertedIdMatchCount: rawConsentRows.filter(
            (row) => row.id === insertedConsentId
          ).length,
          snapshotPolicyVersionCount: rawConsentRows.filter(
            (row) => row.policy_version === "snapshot-test"
          ).length,
          markerKeyPresentCount: rawConsentRows.filter(
            (row) =>
              row.metadata !== null &&
              typeof row.metadata === "object" &&
              Object.hasOwn(row.metadata, "marker")
          ).length,
          markerMatchCount: rawConsentRows.filter(
            (row) => row.metadata?.marker === marker
          ).length,
          metadataKindCounts: {
            object: metadataKinds.filter((kind) => kind === "object").length,
            array: metadataKinds.filter((kind) => kind === "array").length,
            null: metadataKinds.filter((kind) => kind === "null").length,
            other: metadataKinds.filter((kind) => kind === "other").length,
          },
          exporterFacts,
          mutatorFacts,
          postCommitFacts,
        })}`
      )
    } finally {
      await locker`rollback`
      await settleExport
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
      authenticated: true,
      service_role: false,
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

async function waitUntilExportBlocks(sql, exporterPid, lockerPid) {
  let facts
  for (let attempt = 0; attempt < 100; attempt += 1) {
    ;[facts] = await sql`
      select
        exists (
          select 1 from pg_stat_activity
          where pid = ${exporterPid}
            and application_name = 'manifest-export-concurrency'
        ) as exporter_identified,
        exists (
          select 1 from pg_locks
          where pid = ${exporterPid}
            and relation = 'public.stamp_events'::regclass
            and mode = 'AccessShareLock'
            and not granted
        ) as access_share_waiting,
        ${lockerPid}::int = any(pg_blocking_pids(${exporterPid})) as locker_is_blocker`
    if (
      facts.exporter_identified &&
      facts.access_share_waiting &&
      facts.locker_is_blocker
    )
      return
  }
  assert.fail(`export lock boundary facts: ${JSON.stringify(facts)}`)
}

function isLoopbackUrl(value) {
  try {
    return ["127.0.0.1", "localhost", "::1"].includes(new URL(value).hostname)
  } catch {
    return false
  }
}
