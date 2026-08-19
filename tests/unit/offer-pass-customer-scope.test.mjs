import assert from "node:assert/strict"
import { test } from "node:test"

import { runClaimOfferBoundaryHarness } from "./claim-offer-boundary-harness-client.mjs"

test("Given a foreign entitlement When the owner loads that id Then it is not found before row materialisation", async () => {
  const result = await runClaimOfferBoundaryHarness("pass", "foreign")

  assert.equal(result.status, "not_found")
  assert.equal(result.customerPredicate, true)
  assert.equal(result.materializedRows, 0)
})

test("Given an owned entitlement When the owner loads that id Then the pass remains ready", async () => {
  const result = await runClaimOfferBoundaryHarness("pass", "owned")

  assert.equal(result.status, "ready")
  assert.equal(result.customerPredicate, true)
  assert.equal(result.materializedRows, 1)
})
