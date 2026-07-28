import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, db, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"
const ADMIN_UID = "00000000-0000-0000-0000-000000000001"

after(async () => {
  await closeDb()
})

async function actAsAuthenticated(tx, userId, aal = "aal2") {
  await tx`select set_config('request.jwt.claim.role', 'authenticated', true)`
  await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`
  await tx`select set_config('request.jwt.claim.aal', ${aal}, true)`
}

test(
  "unaffiliated privacy RPCs are explicitly allowlisted and global consent is nullable",
  { skip },
  async () => {
    const signatures = [
      "admin_log_unaffiliated_data_request(uuid,text,text,text)",
      "admin_record_unaffiliated_consent_opt_out(uuid,text,text,text,text)",
    ]

    for (const signature of signatures) {
      const [privileges] = await db()`
        select
          has_function_privilege('authenticated', ${signature}, 'EXECUTE') as authenticated,
          has_function_privilege('service_role', ${signature}, 'EXECUTE') as service_role,
          has_function_privilege('anon', ${signature}, 'EXECUTE') as anon,
          has_function_privilege('public', ${signature}, 'EXECUTE') as public`

      assert.equal(privileges.authenticated, true)
      assert.equal(privileges.service_role, true)
      assert.equal(privileges.anon, false)
      assert.equal(privileges.public, false)
    }

    const [merchantColumn] = await db()`
      select is_nullable
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'consent_records'
        and column_name = 'merchant_id'`
    assert.equal(merchantColumn.is_nullable, "YES")
  }
)

test(
  "unaffiliated consent, export and erasure are admin-gated, scoped and audited",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const customerId = randomUUID()
      const sessionId = randomUUID()
      const notificationId = randomUUID()
      const email = `unaffiliated-${randomUUID()}@test.local`
      const consentReason = `Account opt-out ${randomUUID()}`
      const exportNotes = `Account export ${randomUUID()}`
      const deletionNotes = `Account erasure ${randomUUID()}`

      await tx`
        insert into public.customers (
          id,
          email,
          email_verified_at,
          full_name,
          phone_last4,
          created_at,
          updated_at
        )
        values (
          ${customerId}::uuid,
          ${email},
          now(),
          'Unaffiliated Privacy Test',
          '0420',
          now(),
          now()
        )`
      await tx`
        insert into public.notification_preferences (
          customer_id,
          marketing_enabled
        )
        values (${customerId}::uuid, true)`
      await tx`
        insert into public.customer_sessions (
          id,
          customer_id,
          expires_at
        )
        values (
          ${sessionId}::uuid,
          ${customerId}::uuid,
          now() + interval '1 day'
        )`
      await tx`
        insert into public.notification_events (
          id,
          event_type,
          category,
          customer_id,
          dedupe_key,
          status
        )
        values (
          ${notificationId}::uuid,
          'push_permission_prompt_viewed',
          'operational',
          ${customerId}::uuid,
          ${`unaffiliated-privacy:${notificationId}`},
          'queued'
        )`

      let refusedNonAdmin = false
      try {
        await tx.savepoint(async (sp) => {
          await actAsAuthenticated(sp, randomUUID())
          await sp`
            select public.admin_log_unaffiliated_data_request(
              ${customerId}::uuid,
              'access',
              'email',
              'Unauthorised request'
            )`
        })
      } catch (error) {
        refusedNonAdmin = /admin|privilege|authori/i.test(String(error.message))
      }
      assert.ok(
        refusedNonAdmin,
        "a non-admin cannot use the customer-scoped RPC"
      )

      await actAsAuthenticated(tx, ADMIN_UID)

      const [{ result: consentResult }] = await tx`
        select public.admin_record_unaffiliated_consent_opt_out(
          ${customerId}::uuid,
          'email',
          'support_request',
          '2026-06-foundation',
          ${consentReason}
        ) as result`
      assert.equal(consentResult.ok, true)
      assert.equal(consentResult.scope, "account")

      const [consent] = await tx`
        select id, merchant_id, consent_status, metadata
        from public.consent_records
        where customer_id = ${customerId}::uuid
          and metadata ->> 'reason' = ${consentReason}`
      assert.equal(consent.merchant_id, null)
      assert.equal(consent.consent_status, "opted_out")
      assert.equal(consent.metadata.scope, "account")

      const [preferencesAfterOptOut] = await tx`
        select marketing_enabled
        from public.notification_preferences
        where customer_id = ${customerId}::uuid`
      assert.equal(preferencesAfterOptOut.marketing_enabled, false)

      const hiddenFromOutsider = await tx.savepoint(async (sp) => {
        await sp`set local role authenticated`
        await actAsAuthenticated(sp, randomUUID())
        try {
          const [{ count }] = await sp`
            select count(*)::int as count
            from public.consent_records
            where id = ${consent.id}::uuid`
          return count
        } finally {
          await sp`reset role`
          await sp`select set_config('request.jwt.claim.role', 'service_role', true)`
        }
      })
      assert.equal(
        hiddenFromOutsider,
        0,
        "a nullable merchant does not expose global consent to another user"
      )

      await actAsAuthenticated(tx, ADMIN_UID)
      const [{ result: exportResult }] = await tx`
        select public.admin_log_unaffiliated_data_request(
          ${customerId}::uuid,
          'export',
          'email',
          ${exportNotes}
        ) as result`

      assert.equal(exportResult.schema, "nabaperks.customer-data-export.v1")
      assert.equal(exportResult.customer.id, customerId)
      assert.deepEqual(exportResult.memberships, [])
      assert.deepEqual(exportResult.stamp_events, [])
      assert.deepEqual(exportResult.reward_events, [])
      assert.ok(Array.isArray(exportResult.loyalty_invitations))
      assert.equal(
        exportResult.notification_preferences.marketing_enabled,
        false
      )
      assert.equal(exportResult.customer_sessions.length, 1)
      assert.equal(exportResult.consent_records.length, 1)

      const [{ result: deletionResult }] = await tx`
        select public.admin_log_unaffiliated_data_request(
          ${customerId}::uuid,
          'deletion',
          'email',
          ${deletionNotes}
        ) as result`
      assert.equal(deletionResult.ok, true)
      assert.equal(deletionResult.scope, "account")
      assert.equal(deletionResult.ledger_retained, true)

      const [erased] = await tx`
        select
          email,
          email_verified_at,
          full_name,
          phone_last4
        from public.customers
        where id = ${customerId}::uuid`
      assert.match(erased.email, /^erased\+[0-9a-f]+@privacy\.invalid$/i)
      assert.equal(erased.email_verified_at, null)
      assert.equal(erased.full_name, null)
      assert.equal(erased.phone_last4, null)

      const [session] = await tx`
        select revoked_at
        from public.customer_sessions
        where id = ${sessionId}::uuid`
      assert.ok(session.revoked_at, "erasure revokes the live customer session")

      const [notification] = await tx`
        select status, cancelled_at
        from public.notification_events
        where id = ${notificationId}::uuid`
      assert.equal(notification.status, "cancelled")
      assert.ok(notification.cancelled_at)

      const audits = await tx`
        select action, merchant_id, metadata
        from public.audit_logs
        where customer_id = ${customerId}::uuid
          and actor_id = ${ADMIN_UID}
          and (
            metadata ->> 'reason' = ${consentReason}
            or metadata ->> 'notes' = ${exportNotes}
            or metadata ->> 'notes' = ${deletionNotes}
          )
        order by created_at`
      assert.deepEqual(audits.map((row) => row.action).sort(), [
        "consent_opt_out_recorded",
        "customer_data_exported",
        "customer_pii_erased",
      ])
      assert.ok(audits.every((row) => row.merchant_id === null))
      assert.ok(audits.every((row) => row.metadata.scope === "account"))
    })
  }
)

test(
  "customer-scoped privacy RPCs reject a customer who has joined a merchant",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [membership] = await tx`
        select customer_id
        from public.customer_memberships
        order by created_at
        limit 1`
      assert.ok(membership)

      await actAsAuthenticated(tx, ADMIN_UID)
      await assert.rejects(
        tx`
          select public.admin_log_unaffiliated_data_request(
            ${membership.customer_id}::uuid,
            'access',
            'email',
            'Stale unaffiliated browser row'
          )`,
        /unaffiliated customer context not found/i
      )
    })
  }
)
