import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * admin console / architecture audit — live-DB tier.
 *
 * The audit fixes added admin fraud resolution and privacy request dispatch,
 * but local proof was still source-contract only. These tests execute the real
 * RPCs behind the admin UI and prove admin gating, persisted status changes,
 * audit trails, and access/export/deletion privacy dispatch paths.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

const ADMIN_UID = "00000000-0000-0000-0000-000000000001"

const PICK_MEMBERSHIP = /* sql */ `
  select id as membership_id, merchant_id, customer_id
  from public.customer_memberships
  where merchant_id is not null and customer_id is not null
  order by created_at
  limit 1`

async function actAsAuthenticated(tx, userId, aal = "aal2") {
  await tx`select set_config('request.jwt.claim.role', 'authenticated', true)`
  await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`
  await tx`select set_config('request.jwt.claim.aal', ${aal}, true)`
}

function isAdminRejection(error) {
  return /admin|mfa|privilege|authori/i.test(String(error.message))
}

test(
  "admin fraud resolution is gated, persists status, and writes audit evidence",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [membership] = await tx.unsafe(PICK_MEMBERSHIP)
      assert.ok(membership, "a seeded customer membership exists")

      const flagId = randomUUID()
      const reason = `Reviewed in DB test ${randomUUID()}`

      await tx`
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
          ${flagId}::uuid,
          ${membership.merchant_id}::uuid,
          ${membership.customer_id}::uuid,
          ${membership.membership_id}::uuid,
          'high_stamp_velocity',
          'medium',
          'open',
          '{"source":"db-test"}'::jsonb
        )`

      let refusedNonAdmin = false
      try {
        await tx.savepoint(async (sp) => {
          await actAsAuthenticated(sp, randomUUID())
          await sp`select public.admin_resolve_fraud_flag(
            ${flagId}::uuid, 'reviewed', ${reason})`
        })
      } catch (error) {
        refusedNonAdmin = isAdminRejection(error)
      }
      assert.ok(
        refusedNonAdmin,
        "a non-admin caller cannot resolve fraud flags"
      )

      // Admin access no longer requires AAL2 step-up (migration
      // 20260720100000): an active internal_admins row is sufficient, so an
      // admin at aal1 resolves fraud flags successfully.
      await actAsAuthenticated(tx, ADMIN_UID, "aal1")
      await tx`select public.admin_resolve_fraud_flag(
        ${flagId}::uuid, 'dismissed', ${reason})`

      const [flag] = await tx`
        select status from public.fraud_flags where id = ${flagId}::uuid`
      assert.equal(flag.status, "dismissed", "fraud flag status is persisted")

      // A transport retry of the same decision is a no-op, not a second
      // operator event. A conflicting terminal decision is rejected.
      await tx`select public.admin_resolve_fraud_flag(
        ${flagId}::uuid, 'dismissed', ${reason})`

      let refusedConflictingResolution = false
      try {
        await tx.savepoint(async (sp) => {
          await sp`select public.admin_resolve_fraud_flag(
            ${flagId}::uuid, 'reviewed', 'Conflicting terminal decision')`
        })
      } catch (error) {
        refusedConflictingResolution = /already resolved/i.test(
          String(error.message)
        )
      }
      assert.ok(
        refusedConflictingResolution,
        "a dismissed flag cannot be flipped to another terminal state"
      )

      const audits = await tx`
        select metadata
        from public.audit_logs
        where target_table = 'fraud_flags'
          and target_id = ${flagId}::uuid
          and action = 'fraud_flag_resolved'
        order by created_at desc`

      assert.equal(audits.length, 1, "a retry does not duplicate the audit row")
      const [audit] = audits
      assert.ok(audit, "fraud resolution writes an audit log row")
      assert.equal(audit.metadata.status, "dismissed")
      assert.equal(audit.metadata.previous_status, "open")
      assert.equal(audit.metadata.reason, reason)
    })
  }
)

test(
  "admin privacy request dispatcher is gated and routes access, export, and deletion",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [membership] = await tx.unsafe(PICK_MEMBERSHIP)
      assert.ok(membership, "a seeded customer membership exists")

      const accessNotes = `Access request ${randomUUID()}`
      const exportNotes = `Export request ${randomUUID()}`
      const deletionNotes = `Deletion request ${randomUUID()}`

      let refusedNonAdmin = false
      try {
        await tx.savepoint(async (sp) => {
          await actAsAuthenticated(sp, randomUUID())
          await sp`select public.admin_log_data_request(
            ${membership.customer_id}::uuid,
            ${membership.merchant_id}::uuid,
            'access',
            'email',
            ${accessNotes}
          )`
        })
      } catch (error) {
        refusedNonAdmin = isAdminRejection(error)
      }
      assert.ok(
        refusedNonAdmin,
        "a non-admin caller cannot log privacy requests"
      )

      // Admin access no longer requires AAL2 step-up (migration
      // 20260720100000): an admin at aal1 logs privacy requests successfully.
      await actAsAuthenticated(tx, ADMIN_UID, "aal1")

      const [{ result: accessResult }] = await tx`
        select public.admin_log_data_request(
          ${membership.customer_id}::uuid,
          ${membership.merchant_id}::uuid,
          'access',
          'email',
          ${accessNotes}
        ) as result`

      assert.equal(accessResult.ok, true)
      assert.equal(accessResult.request_type, "access")
      assert.equal(accessResult.manual_follow_up_required, true)

      const [{ result: exportResult }] = await tx`
        select public.admin_log_data_request(
          ${membership.customer_id}::uuid,
          ${membership.merchant_id}::uuid,
          'export',
          'email',
          ${exportNotes}
        ) as result`

      assert.equal(exportResult.schema, "nabaperks.customer-data-export.v1")
      assert.equal(exportResult.customer.id, membership.customer_id)
      assert.ok(
        Array.isArray(exportResult.memberships),
        "export returns portable membership data"
      )
      assert.ok(
        exportResult.stamp_events.every(
          (stampEvent) => "event_type" in stampEvent
        ),
        "export returns actual stamp ledger event types"
      )

      const [{ result: deletionResult }] = await tx`
        select public.admin_log_data_request(
          ${membership.customer_id}::uuid,
          ${membership.merchant_id}::uuid,
          'deletion',
          'email',
          ${deletionNotes}
        ) as result`

      assert.equal(deletionResult.ok, true)
      assert.equal(deletionResult.request_type, "deletion")
      assert.equal(deletionResult.ledger_retained, true)

      const [erased] = await tx`
        select email, full_name, phone_last4
        from public.customers
        where id = ${membership.customer_id}::uuid`
      assert.match(erased.email, /^erased\+[0-9a-f]+@privacy\.invalid$/i)
      assert.equal(erased.full_name, null)
      assert.equal(erased.phone_last4, null)

      const auditRows = await tx`
        select action, metadata
        from public.audit_logs
        where customer_id = ${membership.customer_id}::uuid
          and actor_id = ${ADMIN_UID}
          and (
            metadata ->> 'notes' = ${accessNotes}
            or metadata ->> 'notes' = ${exportNotes}
            or metadata ->> 'notes' = ${deletionNotes}
          )
        order by created_at`

      const actions = auditRows.map((row) => row.action).sort()
      assert.deepEqual(actions, [
        "customer_data_exported",
        "customer_pii_erased",
        "data_request_logged",
      ])
    })
  }
)
