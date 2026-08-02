import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * Auth-hook replay consumption.
 *
 * The contract is deliberately asymmetric, because these hooks are synchronous
 * and sit inside an auth flow: fail CLOSED on replay, fail OPEN on anything
 * else. A duplicate OTP is an annoyance; a missing OTP is a lockout.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

test("the first delivery is claimed", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    assert.equal(await claim(tx, "sms", id()), "claimed")
  })
})

test(
  "a replay of a completed delivery is refused the side effect",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const webhookId = id()
      assert.equal(await claim(tx, "sms", webhookId), "claimed")
      await complete(tx, "sms", webhookId)

      assert.equal(
        await claim(tx, "sms", webhookId),
        "replay",
        "a captured envelope replayed inside the ±300s window must not resend"
      )
    })
  }
)

test(
  "the same id on a different channel is a different delivery",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const webhookId = id()
      await claim(tx, "sms", webhookId)
      await complete(tx, "sms", webhookId)

      assert.equal(await claim(tx, "email", webhookId), "claimed")
    })
  }
)

test(
  "a concurrent attempt still sends rather than risking a lockout",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const webhookId = id()
      assert.equal(await claim(tx, "sms", webhookId), "claimed")

      assert.equal(
        await claim(tx, "sms", webhookId),
        "concurrent",
        "an in-flight delivery is not proof of delivery — fail open"
      )
    })
  }
)

test("a failed delivery may be retried by the provider", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const webhookId = id()
    await claim(tx, "sms", webhookId)
    await fail(tx, "sms", webhookId)

    assert.equal(
      await claim(tx, "sms", webhookId),
      "claimed",
      "a wholly failed delivery must be re-sendable"
    )
  })
})

test(
  "a concurrent success is recorded over the owner's failure",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const webhookId = id()

      // A claims; B fails open and also sends; A's own send then fails.
      assert.equal(await claim(tx, "sms", webhookId), "claimed")
      assert.equal(await claim(tx, "sms", webhookId), "concurrent")
      await fail(tx, "sms", webhookId)

      // B succeeded. If completion required 'processing' it would match
      // nothing here, leaving NO record of a message that was provably
      // delivered — and reopening replay for the rest of the window.
      assert.equal(await complete(tx, "sms", webhookId), true)

      assert.equal(
        await claim(tx, "sms", webhookId),
        "replay",
        "the proven delivery must be remembered"
      )
    })
  }
)

test(
  "an unusable webhook id sends rather than stranding the customer",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      assert.equal(await claim(tx, "sms", "   "), "concurrent")
      assert.equal(await claim(tx, "sms", null), "concurrent")
    })
  }
)

test(
  "an arbitrary opaque id is accepted, not rejected by a pattern",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      // A CHECK stricter than the function's own validation would make such an
      // id fail permanently on EVERY retry — a self-inflicted auth outage.
      assert.equal(
        await claim(tx, "email", "msg@weird/id+with=chars"),
        "claimed"
      )
      assert.equal(await claim(tx, "email", "x".repeat(400)), "claimed")
    })
  }
)

test("retention purges deliveries past the window", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const webhookId = id()
    await claim(tx, "sms", webhookId)
    await tx`
      update public.auth_hook_deliveries
      set created_at = now() - interval '2 days'
      where webhook_id = ${webhookId}`

    const [row] = await tx`select public.purge_auth_hook_deliveries() as n`
    assert.ok(row.n >= 1)
  })
})

function id() {
  return `msg_${randomUUID()}`
}

async function claim(tx, channel, webhookId) {
  const [row] = await tx`
    select public.claim_auth_hook_delivery(${channel}, ${webhookId}) as outcome`
  return row.outcome
}

async function complete(tx, channel, webhookId) {
  const [row] = await tx`
    select public.complete_auth_hook_delivery(${channel}, ${webhookId}) as ok`
  return row.ok
}

async function fail(tx, channel, webhookId) {
  const [row] = await tx`
    select public.fail_auth_hook_delivery(${channel}, ${webhookId}) as ok`
  return row.ok
}
