import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

// QA BUG-007 (38c42a1..2c45031): the reward-invite email fatigue cap uses a
// 30-day window (2,592,000,000 ms), which overflowed the int4 p_window_ms and
// turned the first invite to a new email into a 500.
const skip = (await isLiveDbReady()) ? false : "local Supabase is not available"
const THIRTY_DAYS_MS = 30 * 86_400_000

after(async () => {
  await closeDb()
})

function bucketKey(label) {
  return `db-test:rate-limit:${label}:${randomUUID()}`
}

test(
  "Given PostgREST resolves RPCs by name When enforce_rate_limit is inspected Then exactly one overload exists with a bigint window and service-role-only execute",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const rows = await tx`
        select
          pg_get_function_identity_arguments(oid) as args,
          prosecdef,
          coalesce(array_to_string(proconfig, ','), '') as config,
          pg_get_userbyid(proowner) as owner,
          has_function_privilege('service_role', oid, 'execute') as service_role,
          has_function_privilege('authenticated', oid, 'execute') as authenticated,
          has_function_privilege('anon', oid, 'execute') as anon
        from pg_proc
        where pronamespace = 'public'::regnamespace
          and proname = 'enforce_rate_limit'`
      assert.deepEqual(
        rows.map((row) => ({ ...row })),
        [
          {
            args: "p_bucket_key text, p_limit integer, p_window_ms bigint",
            prosecdef: true,
            config: "search_path=public",
            owner: "postgres",
            service_role: true,
            authenticated: false,
            anon: false,
          },
        ]
      )
    })
  }
)

test(
  "Given a 30-day window When enforce_rate_limit runs Then the bucket resets in 30 days and the limit still applies",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const key = bucketKey("thirty-days")
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await tx`select public.enforce_rate_limit(${key}, 3, ${THIRTY_DAYS_MS}::bigint)`
      }
      const [bucket] = await tx`
        select count, reset_at > now() + interval '29 days 23 hours' as reset_in_thirty_days
        from public.rate_limit_buckets
        where bucket_key = ${key}`
      assert.deepEqual({ ...bucket }, { count: 3, reset_in_thirty_days: true })
      await assert.rejects(
        () =>
          tx.savepoint(
            (sp) =>
              sp`select public.enforce_rate_limit(${key}, 3, ${THIRTY_DAYS_MS}::bigint)`
          ),
        /rate limit exceeded/i
      )
    })
  }
)

test(
  "Given callers that pass an integer window When enforce_rate_limit runs Then they still resolve to the single function",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const key = bucketKey("int-window")
      await tx`select public.enforce_rate_limit(${key}, 2, 60000)`
      await tx`select public.enforce_rate_limit(${key}::text, 2::integer, 60000::integer)`
      await assert.rejects(
        () =>
          tx.savepoint(
            (sp) => sp`select public.enforce_rate_limit(${key}, 2, 60000)`
          ),
        /rate limit exceeded/i
      )
      await assert.rejects(
        () =>
          tx.savepoint(
            (sp) =>
              sp`select public.enforce_rate_limit(${bucketKey("short")}, 2, 999::bigint)`
          ),
        /invalid rate limit configuration/i
      )
    })
  }
)
