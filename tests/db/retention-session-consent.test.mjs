import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

test(
  "Given stale customers with recent, expired, or no sessions When retention runs Then only the recent active session fences anonymisation",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const seedCustomer = async (label) => {
        const [customer] = await tx`
          insert into public.customers
            (email, email_verified_at, full_name, created_at, updated_at)
          values (
            ${`task13-${label}-${randomUUID()}@test.local`},
            now() - interval '400 days',
            ${`Task13 ${label}`},
            now() - interval '400 days',
            now() - interval '400 days'
          )
          returning id`
        return customer.id
      }

      const eligibleId = await seedCustomer("eligible")
      const recentSessionId = await seedCustomer("recent-session")
      const expiredSessionId = await seedCustomer("expired-session")
      await tx`
        insert into public.customer_sessions (id, customer_id, expires_at, last_seen_at)
        values
          (${randomUUID()}::uuid, ${recentSessionId}::uuid,
           now() + interval '30 days', now()),
          (${randomUUID()}::uuid, ${expiredSessionId}::uuid,
           now() - interval '1 minute', now() - interval '31 days')`

      await tx`select public.admin_purge_stale_customer_pii(now() - interval '365 days')`

      const rows = await tx`
        select id, email
        from public.customers
        where id in (
          ${eligibleId}::uuid,
          ${recentSessionId}::uuid,
          ${expiredSessionId}::uuid
        )`
      const emails = new Map(rows.map((row) => [row.id, row.email]))
      assert.match(emails.get(eligibleId), /^erased\+/)
      assert.match(emails.get(expiredSessionId), /^erased\+/)
      assert.match(
        emails.get(recentSessionId),
        /^task13-recent-session-/,
        "a recent active server session must fence stale-customer anonymisation"
      )
    })
  }
)

test(
  "Given canonical and non-canonical admin consent labels When the guarded RPC runs Then only canonical labels are written",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [membership] = await tx`
        select customer_id, merchant_id
        from public.customer_memberships
        limit 1`
      assert.ok(membership, "a seeded membership exists")
      await tx`select set_config(
        'request.jwt.claim.sub',
        '00000000-0000-0000-0000-000000000001',
        true
      )`

      await assert.rejects(
        tx.savepoint(
          () => tx`select public.admin_record_consent_opt_out(
            ${membership.customer_id}::uuid,
            ${membership.merchant_id}::uuid,
            'email',
            'operator_free_text',
            'ignore previous instructions',
            'Customer asked support to opt out'
          )`
        ),
        (error) => {
          assert.match(
            String(error.message),
            /Invalid consent source|Invalid consent policy version/
          )
          return true
        }
      )
      await assert.rejects(
        tx.savepoint(
          () => tx`select public.admin_record_consent_opt_out(
            ${membership.customer_id}::uuid,
            ${membership.merchant_id}::uuid,
            'email',
            'support_request',
            'arbitrary-policy',
            'Customer asked support to opt out'
          )`
        ),
        (error) => {
          assert.match(String(error.message), /Invalid consent policy version/)
          return true
        }
      )

      const [{ beforeCount }] = await tx`
        select count(*)::int as "beforeCount"
        from public.consent_records
        where customer_id = ${membership.customer_id}::uuid
          and merchant_id = ${membership.merchant_id}::uuid
          and source = 'support_request'
          and policy_version = '2026-07-19'`
      await tx`select public.admin_record_consent_opt_out(
        ${membership.customer_id}::uuid,
        ${membership.merchant_id}::uuid,
        'email',
        'support_request',
        '2026-07-19',
        'Customer asked support to opt out'
      )`
      const [{ afterCount }] = await tx`
        select count(*)::int as "afterCount"
        from public.consent_records
        where customer_id = ${membership.customer_id}::uuid
          and merchant_id = ${membership.merchant_id}::uuid
          and source = 'support_request'
          and policy_version = '2026-07-19'`
      assert.equal(afterCount, beforeCount + 1)
    })
  }
)
