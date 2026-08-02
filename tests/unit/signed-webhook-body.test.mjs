import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { test } from "node:test"

import {
  MAX_SIGNED_WEBHOOK_BODY_BYTES,
  readSignedWebhookBody,
} from "@/lib/http/signed-webhook-body"
import { verifyStandardWebhook } from "@/lib/notifications/standard-webhook"

/**
 * The signed-webhook body ceiling. These routes buffer the whole body BEFORE
 * the HMAC is checked, so an unauthenticated caller otherwise chooses how much
 * memory is allocated and how much data is hashed.
 */

function streamedRequest(buffer, { chunkSize = 65_536, headers } = {}) {
  const stream = new ReadableStream({
    start(controller) {
      for (let i = 0; i < buffer.length; i += chunkSize) {
        controller.enqueue(new Uint8Array(buffer.subarray(i, i + chunkSize)))
      }
      controller.close()
    },
  })
  return new Request("http://localhost/api/resend/webhook", {
    method: "POST",
    body: stream,
    duplex: "half",
    headers,
  })
}

test("a chunked oversize body is refused without a declared length", async () => {
  // The bypass the finding turns on: no content-length at all, so only a
  // streamed counter can stop it.
  const body = await readSignedWebhookBody(
    streamedRequest(Buffer.alloc(MAX_SIGNED_WEBHOOK_BODY_BYTES + 1, 0x61))
  )
  assert.equal(body, null)
})

test("an oversize declared length is refused without touching the stream", async () => {
  let touched = false
  const request = {
    headers: new Headers({
      "content-length": String(MAX_SIGNED_WEBHOOK_BODY_BYTES + 1),
    }),
    get body() {
      touched = true
      throw new Error("body must not be read")
    },
  }

  assert.equal(await readSignedWebhookBody(request), null)
  assert.equal(touched, false, "the fast path must not allocate")
})

test("an understated content-length does not beat the streamed counter", async () => {
  const body = await readSignedWebhookBody(
    streamedRequest(Buffer.alloc(MAX_SIGNED_WEBHOOK_BODY_BYTES + 1, 0x61), {
      headers: new Headers({ "content-length": "10" }),
    })
  )
  assert.equal(body, null, "the counter, not the header, is authoritative")
})

test("a malformed content-length falls through instead of rejecting", async () => {
  // Deliberately lenient, matching the Stripe webhook reader rather than the
  // first-party analytics beacon. `Headers.get()` collapses a duplicated
  // Content-Length to "123, 123", which is RFC-legal from a provider; the
  // streamed counter bounds it anyway, so rejecting here would fail a real
  // delivery for no security gain. On an auth hook that means the customer
  // simply never receives their code.
  const payload = "{}"
  const body = await readSignedWebhookBody(
    streamedRequest(Buffer.from(payload, "utf8"), {
      headers: new Headers({ "content-length": "1e6" }),
    })
  )
  assert.equal(body, payload)
})

test("a body exactly at the ceiling is accepted", async () => {
  const body = await readSignedWebhookBody(
    streamedRequest(Buffer.alloc(MAX_SIGNED_WEBHOOK_BODY_BYTES, 0x61))
  )
  assert.equal(body?.length, MAX_SIGNED_WEBHOOK_BODY_BYTES)
})

test("the bounded read stays byte-exact so the signature still verifies", async () => {
  // The load-bearing control: if the reader re-encoded, trimmed, or split a
  // multibyte character the HMAC would break and every real delivery would 401.
  const rawKey = "test_supabase_hook_secret_32_bytes"
  const secret = `v1,whsec_${Buffer.from(rawKey).toString("base64")}`
  const payload = JSON.stringify({
    user: { email: "café@example.test" },
    sms: { otp: "424242" },
    note: "🍺 £299.99",
  })
  const id = "msg_bounded_reader"
  const timestamp = "1754000000"
  const signature = createHmac("sha256", Buffer.from(rawKey))
    .update(`${id}.${timestamp}.${payload}`)
    .digest("base64")

  // One byte per chunk: the worst case for a streaming decoder.
  const body = await readSignedWebhookBody(
    streamedRequest(Buffer.from(payload, "utf8"), { chunkSize: 1 })
  )

  assert.equal(body, payload)
  assert.equal(
    verifyStandardWebhook({
      secret,
      id,
      timestamp,
      body,
      signatureHeader: `v1,${signature}`,
      now: () => 1754000000000,
    }),
    true
  )
})

test("a transport failure propagates instead of masquerading as 413", async () => {
  // A client abort or connection reset must stay a transient 500. Reporting it
  // as 413 tells Svix the payload is permanently wrong — it counts toward the
  // endpoint auto-disable budget — and tells GoTrue the auth operation failed.
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([0x7b]))
      controller.error(new Error("ECONNRESET"))
    },
  })
  const request = new Request("http://localhost/api/resend/webhook", {
    method: "POST",
    body: stream,
    duplex: "half",
  })

  await assert.rejects(() => readSignedWebhookBody(request))
})

test("an absent body reads as empty rather than refused", async () => {
  const request = new Request("http://localhost/x", { method: "POST" })
  assert.equal(await readSignedWebhookBody(request), "")
})
