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
  "the first delivery owns an exclusive finite lease",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const first = await claim(tx, "sms", id())
      assert.equal(first.status, "claimed")
      assert.match(first.lease_id, UUID)
    })
  }
)

test("a concurrent replay is busy and cannot send", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const webhookId = id()
    const first = await claim(tx, "sms", webhookId)
    const second = await claim(tx, "sms", webhookId)
    assert.equal(first.status, "claimed")
    assert.deepEqual(second, { status: "busy" })
  })
})

test(
  "a completed delivery replays without a provider side effect",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const webhookId = id()
      const first = await claim(tx, "sms", webhookId)
      assert.equal(await complete(tx, "sms", webhookId, first.lease_id), true)
      assert.deepEqual(await claim(tx, "sms", webhookId), { status: "replay" })
    })
  }
)

test(
  "failed ownership transfers once and stale owners are fenced",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const webhookId = id()
      const first = await claim(tx, "email", webhookId)
      assert.equal(await fail(tx, "email", webhookId, first.lease_id), true)

      const retry = await claim(tx, "email", webhookId)
      assert.equal(retry.status, "claimed")
      assert.notEqual(retry.lease_id, first.lease_id)
      assert.equal(
        await complete(tx, "email", webhookId, first.lease_id),
        false
      )
      assert.deepEqual(await claim(tx, "email", webhookId), { status: "busy" })
    })
  }
)

test("an expired lease transfers once", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const webhookId = id()
    const first = await claim(tx, "sms", webhookId)
    await tx`
      update public.auth_hook_deliveries
      set lease_expires_at = now() - interval '1 second'
      where channel = 'sms' and webhook_id = ${webhookId}`

    const retry = await claim(tx, "sms", webhookId)
    assert.equal(retry.status, "claimed")
    assert.notEqual(retry.lease_id, first.lease_id)
    assert.deepEqual(await claim(tx, "sms", webhookId), { status: "busy" })
  })
})

test(
  "distinct channels and opaque ids remain legitimate",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const webhookId = "msg@weird/id+with=chars"
      assert.equal((await claim(tx, "sms", webhookId)).status, "claimed")
      assert.equal((await claim(tx, "email", webhookId)).status, "claimed")
      assert.equal(
        (await claim(tx, "email", "x".repeat(400))).status,
        "claimed"
      )
    })
  }
)

test("missing delivery identity fails closed", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    await assert.rejects(() => tx.savepoint((sp) => claim(sp, "sms", "   ")))
  })
})

test(
  "retention preserves active leases and removes old terminal rows",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const activeId = id()
      await claim(tx, "sms", activeId)
      await tx`
      update public.auth_hook_deliveries
      set created_at = now() - interval '2 days'
      where webhook_id = ${activeId}`

      const terminalId = id()
      const terminal = await claim(tx, "sms", terminalId)
      await fail(tx, "sms", terminalId, terminal.lease_id)
      await tx`
      update public.auth_hook_deliveries
      set updated_at = now() - interval '2 days'
      where webhook_id = ${terminalId}`

      await tx`select public.purge_auth_hook_deliveries()`
      const rows = await tx`
      select webhook_id from public.auth_hook_deliveries
      where webhook_id in (${activeId}, ${terminalId})`
      assert.deepEqual(
        rows.map((row) => row.webhook_id),
        [activeId]
      )
    })
  }
)

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function id() {
  return `msg_${randomUUID()}`
}

async function claim(tx, channel, webhookId) {
  const [row] = await tx`
    select public.claim_auth_hook_delivery(${channel}, ${webhookId}) as outcome`
  return row.outcome
}

async function complete(tx, channel, webhookId, leaseId) {
  const [row] = await tx`
    select public.complete_auth_hook_delivery(
      ${channel}, ${webhookId}, ${leaseId}::uuid) as ok`
  return row.ok
}

async function fail(tx, channel, webhookId, leaseId) {
  const [row] = await tx`
    select public.fail_auth_hook_delivery(
      ${channel}, ${webhookId}, ${leaseId}::uuid) as ok`
  return row.ok
}
