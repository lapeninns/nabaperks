import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { test } from "node:test"

import { verifyStandardWebhook } from "@/lib/notifications/standard-webhook"

// Characterisation tests. These PIN the current behaviour of the Standard
// Webhooks verifier that authenticates every Supabase auth-hook request. If
// behaviour changes on purpose, update the pinned values in the same PR.

const RAW_KEY = "test_supabase_hook_secret_32_bytes"
const BASE64_KEY = Buffer.from(RAW_KEY).toString("base64")
const SECRET = `v1,whsec_${BASE64_KEY}`

function sign({ id, timestamp, body, key = RAW_KEY }) {
  return createHmac("sha256", Buffer.from(key))
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64")
}

function validInput(overrides = {}) {
  const now = Date.now()
  const id = "msg_characterisation"
  const timestamp = Math.floor(now / 1000).toString()
  const body = JSON.stringify({ user: { email: "venue@example.test" } })
  return {
    secret: SECRET,
    id,
    timestamp,
    body,
    signatureHeader: `v1,${sign({ id, timestamp, body })}`,
    now,
    ...overrides,
  }
}

test("accepts a correctly signed payload inside the timestamp tolerance", () => {
  assert.equal(verifyStandardWebhook(validInput()), true)
})

test("accepts the secret without the v1,whsec_ envelope prefixes", () => {
  assert.equal(verifyStandardWebhook(validInput({ secret: BASE64_KEY })), true)
  assert.equal(
    verifyStandardWebhook(validInput({ secret: `whsec_${BASE64_KEY}` })),
    true
  )
})

test("accepts a valid signature among multiple space-separated entries", () => {
  const input = validInput()
  assert.equal(
    verifyStandardWebhook({
      ...input,
      signatureHeader: `v1,bm90LXRoZS1yaWdodC1zaWc= ${input.signatureHeader}`,
    }),
    true
  )
})

test("rejects a signature computed with a different key", () => {
  const input = validInput()
  const forged = sign({
    id: input.id,
    timestamp: input.timestamp,
    body: input.body,
    key: "attacker_key_that_is_also_32_byte",
  })
  assert.equal(
    verifyStandardWebhook({ ...input, signatureHeader: `v1,${forged}` }),
    false
  )
})

test("rejects when the signed body was tampered with", () => {
  const input = validInput()
  assert.equal(
    verifyStandardWebhook({ ...input, body: `${input.body} ` }),
    false
  )
})

test("rejects timestamps drifted more than five minutes either way", () => {
  const now = Date.now()
  for (const driftSeconds of [301, -301]) {
    const timestamp = (Math.floor(now / 1000) - driftSeconds).toString()
    const id = "msg_drift"
    const body = "{}"
    assert.equal(
      verifyStandardWebhook({
        secret: SECRET,
        id,
        timestamp,
        body,
        signatureHeader: `v1,${sign({ id, timestamp, body })}`,
        now,
      }),
      false,
      `drift of ${driftSeconds}s must be rejected`
    )
  }
})

test("accepts timestamps exactly at the five-minute tolerance boundary", () => {
  const now = Date.now()
  const timestamp = (Math.floor(now / 1000) - 300).toString()
  const id = "msg_boundary"
  const body = "{}"
  assert.equal(
    verifyStandardWebhook({
      secret: SECRET,
      id,
      timestamp,
      body,
      signatureHeader: `v1,${sign({ id, timestamp, body })}`,
      now,
    }),
    true
  )
})

test("rejects non-numeric timestamps and missing envelope fields", () => {
  const input = validInput()
  assert.equal(
    verifyStandardWebhook({ ...input, timestamp: "not-a-number" }),
    false
  )
  assert.equal(verifyStandardWebhook({ ...input, secret: "" }), false)
  assert.equal(verifyStandardWebhook({ ...input, id: "" }), false)
  assert.equal(verifyStandardWebhook({ ...input, timestamp: "" }), false)
  assert.equal(verifyStandardWebhook({ ...input, signatureHeader: "" }), false)
})

test("rejects a secret that decodes to an empty key", () => {
  assert.equal(
    verifyStandardWebhook(validInput({ secret: "v1,whsec_" })),
    false
  )
})

test("rejects signature entries that are empty after the comma", () => {
  assert.equal(
    verifyStandardWebhook(validInput({ signatureHeader: "v1," })),
    false
  )
})
