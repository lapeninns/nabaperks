import assert from "node:assert/strict"
import { test } from "node:test"

import { runClaimOfferBoundaryHarness } from "./claim-offer-boundary-harness-client.mjs"

for (const kind of ["invite", "offer"]) {
  test(`Given an oversized ${kind} token When claim context resolves Then it fails before hash and RPC`, async () => {
    const result = await runClaimOfferBoundaryHarness(kind, "oversized")

    assert.equal(result.status, "unavailable")
    assert.equal(result.hashEffects, 0)
    assert.equal(result.rpcEffects, 0)
  })

  test(`Given a valid opaque ${kind} token When claim context resolves Then existing lookup behaviour remains`, async () => {
    const result = await runClaimOfferBoundaryHarness(kind, "valid")

    assert.equal(result.status, "available")
    assert.equal(result.hashEffects, 1)
    assert.equal(result.rpcEffects, 1)
  })
}
