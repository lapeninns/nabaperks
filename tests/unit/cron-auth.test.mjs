import assert from "node:assert/strict"
import { test } from "node:test"

import {
  isAuthorizedCronRequest,
  matchesCronSecret,
} from "@/lib/security/cron-auth"

test("Given no configured secret When any header is presented Then the gate fails closed", () => {
  assert.equal(matchesCronSecret("Bearer anything", undefined), false)
  assert.equal(matchesCronSecret("Bearer ", ""), false)
  assert.equal(matchesCronSecret("Bearer    ", "   "), false)
})

test("Given a configured secret When the header is missing or not exact-Bearer Then it is rejected", () => {
  assert.equal(matchesCronSecret(null, "s3cret"), false)
  assert.equal(matchesCronSecret("", "s3cret"), false)
  assert.equal(matchesCronSecret("s3cret", "s3cret"), false)
  assert.equal(matchesCronSecret("bearer s3cret", "s3cret"), false)
  assert.equal(matchesCronSecret("Basic s3cret", "s3cret"), false)
  assert.equal(matchesCronSecret("Bearer", "s3cret"), false)
})

test("Given a configured secret When the token mismatches at any length Then it is rejected", () => {
  assert.equal(matchesCronSecret("Bearer wrong!", "s3cret"), false)
  assert.equal(matchesCronSecret("Bearer s3cre", "s3cret"), false)
  assert.equal(matchesCronSecret("Bearer s3crets", "s3cret"), false)
  assert.equal(matchesCronSecret("Bearer S3CRET", "s3cret"), false)
  assert.equal(matchesCronSecret("Bearer  s3cret", "s3cret"), false)
})

test("Given a configured secret When the exact bearer token is presented Then it is accepted", () => {
  assert.equal(matchesCronSecret("Bearer s3cret", "s3cret"), true)
  // Env values often carry stray whitespace; only the configured side is trimmed.
  assert.equal(matchesCronSecret("Bearer s3cret", "  s3cret\n"), true)
})

test("Given a request When the gate runs Then it authorizes against CRON_SECRET from the environment", () => {
  const previous = process.env.CRON_SECRET
  try {
    process.env.CRON_SECRET = "env-secret"
    const authorized = new Request("https://cron.test/api/cron/job", {
      headers: { authorization: "Bearer env-secret" },
    })
    const rejected = new Request("https://cron.test/api/cron/job", {
      headers: { authorization: "Bearer env-secre7" },
    })
    const missingHeader = new Request("https://cron.test/api/cron/job")

    assert.equal(isAuthorizedCronRequest(authorized), true)
    assert.equal(isAuthorizedCronRequest(rejected), false)
    assert.equal(isAuthorizedCronRequest(missingHeader), false)

    delete process.env.CRON_SECRET
    assert.equal(isAuthorizedCronRequest(authorized), false)
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = previous
  }
})
