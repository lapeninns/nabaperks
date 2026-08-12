import assert from "node:assert/strict"
import { test } from "node:test"

import { runAuthHookRouteHarness } from "./auth-hook-route-harness-client.mjs"

for (const routeName of ["email", "sms"]) {
  test(`Given two concurrent identical signed ${routeName} events When the real handler seam runs Then exactly one provider effect is eligible`, async () => {
    const result = await runAuthHookRouteHarness(routeName, "concurrent")

    assert.equal(result.requestCount, 2)
    assert.equal(result.uniqueClaimants, 1)
    assert.equal(
      result.providerEffects,
      1,
      "a concurrent non-owner must never become provider-eligible"
    )
  })

  test(`Given the ${routeName} claim database errors When the real handler seam runs Then it fails closed without a provider effect`, async () => {
    const result = await runAuthHookRouteHarness(routeName, "db-error")

    assert.equal(result.providerEffects, 0)
    assert.equal(result.statuses.length, 1)
    assert.ok(result.statuses[0] >= 500)
    assert.equal(result.retainedSensitiveError, false)
  })

  test(`Given an invalid ${routeName} signature When the real handler seam runs Then it rejects before claim or provider effects`, async () => {
    const result = await runAuthHookRouteHarness(routeName, "invalid-signature")

    assert.deepEqual(result.statuses, [401])
    assert.equal(result.claimCalls, 0)
    assert.equal(result.providerEffects, 0)
  })

  test(`Given a signed malformed ${routeName} request When the real handler seam runs Then it rejects before provider effects`, async () => {
    const result = await runAuthHookRouteHarness(routeName, "malformed-request")

    assert.deepEqual(result.statuses, [400])
    assert.equal(result.providerEffects, 0)
  })

  test(`Given a consumed ${routeName} claim When the signed event is replayed Then it returns the replay acknowledgement without a provider effect`, async () => {
    const result = await runAuthHookRouteHarness(routeName, "replay")

    assert.deepEqual(result.statuses, [200])
    assert.equal(result.providerEffects, 0)
  })

  test(`Given prompt-like ${routeName} payload text When the valid signed handler receives it Then it remains data and produces one stub effect`, async () => {
    const result = await runAuthHookRouteHarness(routeName, "prompt-data")

    assert.deepEqual(result.statuses, [200])
    assert.equal(result.providerEffects, 1)
  })
}

test("Given a hung claim database fake When the handler is interrupted Then the harness terminates it within the bound", async () => {
  await assert.rejects(
    runAuthHookRouteHarness("sms", "hung-db", 250),
    (error) =>
      error.code === 13 || error.killed === true || error.signal === "SIGTERM"
  )
})

test("Given a hung provider fake When the handler is interrupted Then the harness terminates it within the bound", async () => {
  await assert.rejects(
    runAuthHookRouteHarness("email", "hung-provider", 250),
    (error) =>
      error.code === 13 || error.killed === true || error.signal === "SIGTERM"
  )
})
