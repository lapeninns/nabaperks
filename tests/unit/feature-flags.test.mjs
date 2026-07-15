import assert from "node:assert/strict"
import { test } from "node:test"

import { isFeatureEnabled } from "../../lib/feature-flags.ts"

test("Given no override When the error-reporting flag is read Then its safe default is used", () => {
  const enabled = isFeatureEnabled("platform_error_reporting", {})

  assert.equal(enabled, true)
})

test("Given an explicit false override When the flag is read Then the capability is disabled", () => {
  const enabled = isFeatureEnabled("platform_error_reporting", {
    NABAPERKS_FEATURE_PLATFORM_ERROR_REPORTING: "false",
  })

  assert.equal(enabled, false)
})

test("Given an invalid override When the flag is read Then it fails closed", () => {
  const enabled = isFeatureEnabled("platform_error_reporting", {
    NABAPERKS_FEATURE_PLATFORM_ERROR_REPORTING: "sometimes",
  })

  assert.equal(enabled, false)
})
