import assert from "node:assert/strict"
import { test } from "node:test"

import {
  hasTransientLaunchParam,
  parseLaunchSearchParams,
} from "@/lib/merchant/launch-search-params"

test("returns an empty object for undefined input", () => {
  assert.deepEqual(parseLaunchSearchParams(undefined), {})
})

test("keeps only known keys and drops unknown ones", () => {
  const parsed = parseLaunchSearchParams({
    tab: "rewards",
    saved: "1",
    bogus: "x",
    utm_source: "email",
  })

  assert.deepEqual(parsed, { tab: "rewards", saved: "1" })
})

test("keeps the exact Stripe return protocol for the billing panel", () => {
  assert.deepEqual(
    parseLaunchSearchParams({
      tab: "billing",
      checkout: "success",
      portal: "returned",
      session_id: ["cs_owned", "cs_other"],
      billing_error: "retry",
    }),
    {
      tab: "billing",
      checkout: "success",
      portal: "returned",
      session_id: "cs_owned",
      billing_error: "retry",
    }
  )
})

test("collapses array values to the first entry", () => {
  const parsed = parseLaunchSearchParams({ tab: ["rewards", "qr"] })
  assert.equal(parsed.tab, "rewards")
})

test("keeps QR workspace channel and poster state", () => {
  assert.deepEqual(
    parseLaunchSearchParams({
      tab: "qr",
      channel: "digital",
      poster: "northstar",
    }),
    { tab: "qr", channel: "digital", poster: "northstar" }
  )
})

test("omits keys whose value is undefined", () => {
  const parsed = parseLaunchSearchParams({ tab: undefined, saved: "1" })
  assert.equal("tab" in parsed, false)
  assert.equal(parsed.saved, "1")
})

test("hasTransientLaunchParam is true only for action-result flags", () => {
  for (const key of ["saved", "seeded", "created", "enabled", "disabled", "qr"]) {
    assert.equal(
      hasTransientLaunchParam({ [key]: "1" }),
      true,
      `${key} is transient`
    )
  }

  assert.equal(hasTransientLaunchParam({}), false)
  assert.equal(hasTransientLaunchParam({ tab: "qr" }), false)
  assert.equal(hasTransientLaunchParam({ error: "boom" }), false)
  assert.equal(hasTransientLaunchParam({ checkout: "success" }), false)
  assert.equal(hasTransientLaunchParam({ portal: "1" }), false)
})
