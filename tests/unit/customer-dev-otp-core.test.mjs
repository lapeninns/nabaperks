import assert from "node:assert/strict"
import { test } from "node:test"

import {
  approvedLocalDevOtp,
  isLocalDevelopment,
  isLocalDevOtpConfigured,
  localDevOtpCode,
} from "@/lib/customer/dev-otp-core"

const LOCAL = { NODE_ENV: "development", CUSTOMER_DEV_OTP_CODE: "424242" }

test("Given a local run with a dev code When a code is checked Then only that code is approved", () => {
  assert.equal(isLocalDevelopment(LOCAL), true)
  assert.equal(localDevOtpCode(LOCAL), "424242")
  assert.equal(isLocalDevOtpConfigured(LOCAL), true)
  assert.equal(approvedLocalDevOtp("424242", LOCAL), true)
  assert.equal(approvedLocalDevOtp("424243", LOCAL), false)
})

test("Given a Vercel preview When a dev code is configured Then the bypass is refused", () => {
  const preview = { ...LOCAL, VERCEL_ENV: "preview" }
  assert.equal(isLocalDevelopment(preview), false)
  assert.equal(localDevOtpCode(preview), null)
  assert.equal(isLocalDevOtpConfigured(preview), false)
  assert.equal(approvedLocalDevOtp("424242", preview), false)
})

test("Given a production build or deployment When a dev code is configured Then the bypass is refused", () => {
  for (const env of [
    { ...LOCAL, NODE_ENV: "production" },
    { ...LOCAL, VERCEL_ENV: "production" },
  ]) {
    assert.equal(isLocalDevelopment(env), false)
    assert.equal(approvedLocalDevOtp("424242", env), false)
  }
})

test("Given no or a blank dev code When a local code is checked Then nothing is approved", () => {
  for (const code of [undefined, "", "   "]) {
    const env = { NODE_ENV: "development", CUSTOMER_DEV_OTP_CODE: code }
    assert.equal(isLocalDevOtpConfigured(env), false)
    assert.equal(approvedLocalDevOtp("", env), false)
  }
})
