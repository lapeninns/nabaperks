import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { closeDb, db, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * MS-db-notification-durability — Blocker 1: the delivery worker calls
 * `record_notification_delivery` with a named argument the SQL function does
 * not declare, so PostgREST resolves no overload and returns PGRST202 (404).
 * Every delivery-record attempt then throws "Unable to record notification
 * delivery", so the notification ledger never gains a delivery row.
 *
 * PostgREST resolves an RPC by matching the SET of supplied argument NAMES
 * against a function signature. A live-DB tier cannot go through PostgREST, but
 * a named-argument SQL call reproduces the exact same name-resolution: an
 * unknown named argument raises "function ... does not exist". So these tests
 * derive the argument names straight from the worker source and prove the DB
 * function accepts precisely that set — the executable definition of the
 * TS↔SQL calling contract.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(closeDb)

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)
const workerPath = path.join(
  projectRoot,
  "lib/notifications/delivery-worker.ts"
)

// The exact argument names the worker passes to record_notification_delivery,
// read from source so a future rename on either side fails this contract.
function workerRecordDeliveryArgNames() {
  const src = readFileSync(workerPath, "utf8")
  const call = src.match(
    /record_notification_delivery"\s*,\s*\{([\s\S]*?)\}\s*\)/
  )
  assert.ok(call, "record_notification_delivery rpc call not found in worker")
  const names = [...call[1].matchAll(/\b(p_[a-z_]+)\s*:/g)].map((m) => m[1])
  assert.ok(names.length > 0, "no p_* arguments parsed from the rpc call")
  return names
}

async function declaredParameterNames() {
  const [row] = await db()`
    select proargnames
    from pg_proc
    where proname = 'record_notification_delivery'
      and pronamespace = 'public'::regnamespace`
  assert.ok(row, "record_notification_delivery is not defined in public")
  return new Set(row.proargnames)
}

test(
  "every argument the worker sends is a declared parameter of the SQL function",
  { skip },
  async () => {
    const argNames = workerRecordDeliveryArgNames()
    const declared = await declaredParameterNames()
    const unknown = argNames.filter((name) => !declared.has(name))
    assert.deepEqual(
      unknown,
      [],
      `worker sends argument names the SQL function does not declare (PGRST202 in production): ${unknown.join(", ")}`
    )
  }
)

test(
  "record_notification_delivery is callable with the exact argument set the worker sends",
  { skip },
  async () => {
    const argNames = workerRecordDeliveryArgNames()

    await inRolledBackTxn(async (tx) => {
      const [customer] = await tx`
        insert into public.customers (email, email_verified_at, created_at, updated_at)
        values (${`rec-${randomUUID()}@test.local`}, now(), now(), now())
        returning id`
      const [event] = await tx`
        insert into public.notification_events
          (event_type, category, customer_id, status, due_at, dedupe_key,
           payload, metadata, created_at, updated_at)
        values ('reward_ready', 'transactional', ${customer.id}, 'delivering',
                now(), ${`rec-${randomUUID()}`}, '{}'::jsonb, '{}'::jsonb,
                now(), now())
        returning id`

      // Values keyed by the worker's argument names, so the call is exactly
      // what the delivery worker sends. An unknown name here raises, matching
      // the production PGRST202.
      const valueByName = {
        p_notification_event_id: event.id,
        p_push_subscription_id: null,
        p_customer_id: customer.id,
        p_status: "sent",
        p_attempt_number: 1,
        p_response_status: 201,
        p_failure_reason: null,
        p_metadata: "{}",
      }
      const params = argNames.map((name) =>
        name in valueByName ? valueByName[name] : null
      )
      const named = argNames
        .map((name, index) =>
          name === "p_metadata"
            ? `${name} => $${index + 1}::jsonb`
            : `${name} => $${index + 1}`
        )
        .join(", ")

      const [row] = await tx.unsafe(
        `select public.record_notification_delivery(${named}) as delivery_id`,
        params
      )
      assert.ok(row.delivery_id, "the delivery is recorded and returns an id")

      const [{ n }] = await tx`
        select count(*)::int as n
        from public.notification_deliveries
        where notification_event_id = ${event.id} and status = 'sent'`
      assert.equal(n, 1, "exactly one delivery row is recorded")
    })
  }
)
