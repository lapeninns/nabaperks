import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"
import postgres from "postgres"

import {
  closeDb,
  dbUrl,
  inRolledBackTxn,
  isLiveDbReady,
} from "./helpers/db.mjs"

/**
 * Auth-hook replay consumption.
 *
 * Only the request that inserts the claim may call a provider. Every existing
 * processing, completed, or failed row lacks provider authority.
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
  "a concurrent attempt is not eligible for the provider effect",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const webhookId = id()
      assert.equal(await claim(tx, "sms", webhookId), "claimed")

      assert.equal(
        await claim(tx, "sms", webhookId),
        "unavailable",
        "only the unique row inserter may become provider-eligible"
      )
    })
  }
)

test(
  "two simultaneous claims produce exactly one provider-eligible claimant",
  { skip },
  async () => {
    const url = dbUrl()
    assert.ok(url)
    const sql = postgres(url, { max: 2 })
    const webhookId = id()
    let arrivals = 0
    let releaseClaims = () => {}
    const claimsReady = new Promise((resolve) => {
      releaseClaims = resolve
    })
    const simultaneousClaim = () =>
      sql.begin(async (tx) => {
        await tx`select set_config('request.jwt.claim.role', 'service_role', true)`
        arrivals += 1
        if (arrivals === 2) releaseClaims()
        await claimsReady
        return claim(tx, "sms", webhookId)
      })

    try {
      const outcomes = await Promise.all([
        simultaneousClaim(),
        simultaneousClaim(),
      ])
      assert.deepEqual(
        outcomes.sort(),
        ["claimed", "unavailable"],
        "two database sessions must expose exactly one unique claimant"
      )
    } finally {
      await sql`
        delete from public.auth_hook_deliveries
        where channel = 'sms' and webhook_id = ${webhookId}`
      await sql.end({ timeout: 5 })
    }
  }
)

test(
  "a failed delivery cannot create a second provider claimant",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const webhookId = id()
      await claim(tx, "sms", webhookId)
      await fail(tx, "sms", webhookId)

      assert.equal(
        await claim(tx, "sms", webhookId),
        "unavailable",
        "a stale failed claim must not reopen provider authority"
      )
    })
  }
)

test(
  "completion only settles the unique processing claimant",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const webhookId = id()

      // A claims; B cannot send; A's own send then fails.
      assert.equal(await claim(tx, "sms", webhookId), "claimed")
      assert.equal(await claim(tx, "sms", webhookId), "unavailable")
      await fail(tx, "sms", webhookId)

      assert.equal(await complete(tx, "sms", webhookId), false)

      assert.equal(
        await claim(tx, "sms", webhookId),
        "unavailable",
        "a failed claim remains closed to subsequent provider attempts"
      )
    })
  }
)

test("an unusable webhook id fails closed", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    assert.equal(await claim(tx, "sms", "   "), "unavailable")
    assert.equal(await claim(tx, "sms", null), "unavailable")
  })
})

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
