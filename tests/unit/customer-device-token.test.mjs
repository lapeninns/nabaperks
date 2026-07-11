import assert from "node:assert/strict"
import { test } from "node:test"

import {
  issueCustomerDeviceToken,
  verifyCustomerDeviceToken,
} from "@/lib/security/customer-device-token"

const DEVICE_ID = "11111111-1111-4111-8111-111111111111"
const SECRET = "customer-device-test-secret"

test("a signed device token round-trips for its fixed lifetime", () => {
  const token = issueCustomerDeviceToken(DEVICE_ID, SECRET, 1_000)

  assert.equal(verifyCustomerDeviceToken(token, SECRET, 1_001), DEVICE_ID)
  assert.equal(
    verifyCustomerDeviceToken(token, SECRET, 365 * 24 * 60 * 60 * 1_000 + 1_000),
    null
  )
})

test("forged and tampered device cookies are rejected", () => {
  const token = issueCustomerDeviceToken(DEVICE_ID, SECRET, 1_000)
  const replacement = token.endsWith("A") ? "B" : "A"

  assert.equal(
    verifyCustomerDeviceToken(`${token.slice(0, -1)}${replacement}`, SECRET, 1_001),
    null
  )
  assert.equal(
    verifyCustomerDeviceToken(
      issueCustomerDeviceToken(DEVICE_ID, "another-device-secret", 1_000),
      SECRET,
      1_001
    ),
    null
  )
})
