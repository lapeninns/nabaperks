import assert from "node:assert/strict"
import test from "node:test"

import { hasLaunchPilotEnded } from "@/lib/merchant/launch-pilot-status"

const NOW = new Date("2026-08-02T12:00:00.000Z")

test("active billing completes the pilot regardless of the recorded trial date", () => {
  assert.equal(
    hasLaunchPilotEnded(
      {
        billingStatus: "active",
        syncStatus: "synchronised",
        confirmedStripeTrialEnd: "2026-09-01T12:00:00.000Z",
      },
      NOW
    ),
    true
  )
})

test("a settled confirmed trial completes when its end has passed", () => {
  assert.equal(
    hasLaunchPilotEnded(
      {
        billingStatus: "trialing",
        syncStatus: "synchronised",
        confirmedStripeTrialEnd: "2026-08-01T12:00:00.000Z",
      },
      NOW
    ),
    true
  )
})

test("future and still-syncing trial ends remain in progress", () => {
  assert.equal(
    hasLaunchPilotEnded(
      {
        billingStatus: "trialing",
        syncStatus: "synchronised",
        confirmedStripeTrialEnd: "2026-08-03T12:00:00.000Z",
      },
      NOW
    ),
    false
  )
  assert.equal(
    hasLaunchPilotEnded(
      {
        billingStatus: "trialing",
        syncStatus: "pending",
        confirmedStripeTrialEnd: "2026-08-01T12:00:00.000Z",
      },
      NOW
    ),
    false
  )
})
