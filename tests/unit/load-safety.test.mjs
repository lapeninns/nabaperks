import assert from "node:assert/strict"
import test from "node:test"

import {
  assertFinalRaceState,
  summariseRaceResponses,
} from "../load/race-contract.js"
import {
  assertLoadEnvironment,
  resolveSafeLoadTarget,
} from "../load/target-safety.js"

test("load tests allow loopback and refuse arbitrary or production hosts", () => {
  assert.deepEqual(
    resolveSafeLoadTarget({
      urls: ["http://127.0.0.1:3000/stamp", "http://127.0.0.1:3000/redeem"],
    }),
    { mode: "local", origin: "http://127.0.0.1:3000" }
  )
  assert.throws(
    () =>
      resolveSafeLoadTarget({
        urls: ["https://preview.example.test/stamp"],
      }),
    /loopback/
  )
  assert.throws(
    () =>
      resolveSafeLoadTarget({
        urls: ["https://nabaperks.com/api/stamp"],
        mode: "isolated-staging",
        isolatedStagingOrigin: "https://nabaperks.com",
        isolatedStagingConfirmed: "1",
      }),
    /refusing to load-test production/
  )
})

test("hosted load tests require an exact confirmed staging origin", () => {
  const input = {
    urls: [
      "https://nabaperks-staging-a1.vercel.app/api/stamp",
      "https://nabaperks-staging-a1.vercel.app/api/redeem",
    ],
    mode: "isolated-staging",
    isolatedStagingOrigin: "https://nabaperks-staging-a1.vercel.app",
    isolatedStagingConfirmed: "1",
  }
  assert.equal(resolveSafeLoadTarget(input).mode, "isolated-staging")
  assert.throws(
    () =>
      resolveSafeLoadTarget({
        ...input,
        isolatedStagingConfirmed: "",
      }),
    /explicit confirmation/
  )
  assert.throws(
    () =>
      resolveSafeLoadTarget({
        ...input,
        isolatedStagingOrigin: "https://other-staging.vercel.app",
      }),
    /not the allowlisted/
  )
})

test("hosted load target must identify itself as staging at runtime", () => {
  assert.doesNotThrow(() =>
    assertLoadEnvironment(
      { environment: "preview", targetEnvironment: "staging" },
      "isolated-staging"
    )
  )
  assert.throws(
    () =>
      assertLoadEnvironment(
        { environment: "production", targetEnvironment: "production" },
        "isolated-staging"
      ),
    /did not identify as isolated staging/
  )
})

test("race outcome requires exactly one winner and recognised contention", () => {
  assert.deepEqual(
    summariseRaceResponses([
      { status: 200, body: "{}" },
      { status: 409, body: "already stamped" },
      { status: 400, body: "Reward already used" },
    ]),
    { expectedLoserCount: 2, settled: true, winnerCount: 1 }
  )
  assert.deepEqual(
    summariseRaceResponses([
      { status: 200, body: "{}" },
      { status: 400, body: "malformed payload" },
    ]),
    { expectedLoserCount: 0, settled: false, winnerCount: 1 }
  )
})

test("race readback proves single-winner database invariants", () => {
  const state = {
    runId: "nightly-123",
    isolated: true,
    targetEnvironment: "staging",
    stamp: { winnerCount: 1, earnedEventDelta: 1 },
    redeem: { winnerCount: 1, redeemedRewardDelta: 1 },
  }
  assert.doesNotThrow(() =>
    assertFinalRaceState(state, {
      mode: "isolated-staging",
      runId: "nightly-123",
    })
  )
  assert.throws(
    () =>
      assertFinalRaceState(
        {
          ...state,
          redeem: { winnerCount: 2, redeemedRewardDelta: 2 },
        },
        { mode: "isolated-staging", runId: "nightly-123" }
      ),
    /redeem winner count/
  )
})
