import assert from "node:assert/strict"
import { after, test } from "node:test"

import { runAuthHookRouteHarness } from "../unit/auth-hook-route-harness-client.mjs"
import { closeDb, dbUrl, isLiveDbReady } from "./helpers/db.mjs"

const ready = await isLiveDbReady()
const url = dbUrl()
const loopback =
  url && ["127.0.0.1", "localhost"].includes(new URL(url).hostname)
const skip =
  ready && loopback
    ? false
    : "guarded loopback Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

for (const routeName of ["email", "sms"]) {
  test(
    `two concurrent signed ${routeName} route requests produce one local claim and one provider-stub effect`,
    { skip },
    async () => {
      const result = await runAuthHookRouteHarness(routeName, "db-concurrent")

      assert.equal(result.requestCount, 2)
      assert.equal(result.claimCalls, 2)
      assert.equal(result.uniqueClaimants, 1)
      assert.equal(result.providerEffects, 1)
      assert.equal(result.retainedSensitiveError, false)
    }
  )
}
