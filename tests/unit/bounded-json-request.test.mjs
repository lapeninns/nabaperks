import assert from "node:assert/strict"
import test from "node:test"

import {
  isSameOriginRequest,
  readBoundedJsonRequest,
} from "../../lib/http/bounded-json-request.ts"

function originRequest(url, origin, extraHeaders = {}) {
  return new Request(url, {
    headers: { origin, ...extraHeaders },
  })
}

test("forged forwarding headers cannot authorise an attacker origin", () => {
  const request = originRequest(
    "https://nabaperks.com/api/analytics/funnel",
    "https://evil.example",
    {
      host: "evil.example",
      "x-forwarded-host": "evil.example",
      "x-forwarded-proto": "https",
    }
  )

  assert.equal(isSameOriginRequest(request, "https://nabaperks.com"), false)
})

test("alternate forged host and protocol inputs remain rejected", () => {
  const request = originRequest(
    "https://nabaperks.com/api/analytics/web-vitals",
    "http://evil.example:8080",
    {
      host: "evil.example:8080",
      "x-forwarded-host": "evil.example:8080, nabaperks.com",
      "x-forwarded-proto": "http, https",
    }
  )

  assert.equal(isSameOriginRequest(request, "https://nabaperks.com"), false)
})

test("the exact canonical application origin remains accepted", () => {
  const request = originRequest(
    "https://internal-adapter.invalid/api",
    "https://nabaperks.com",
    {
      host: "evil.example",
      "x-forwarded-host": "evil.example",
      "x-forwarded-proto": "http",
    }
  )

  assert.equal(isSameOriginRequest(request, "https://nabaperks.com"), true)
})

test("local development accepts only the actual loopback request origin", () => {
  const local = originRequest(
    "http://127.0.0.1:3146/api/analytics/funnel",
    "http://127.0.0.1:3146"
  )
  const remote = originRequest(
    "https://preview.example/api/analytics/funnel",
    "https://preview.example"
  )

  assert.equal(isSameOriginRequest(local, "http://localhost:3000"), true)
  assert.equal(isSameOriginRequest(remote, "http://localhost:3000"), false)
})

test("missing or non-origin application URLs fail closed", () => {
  const request = originRequest(
    "https://nabaperks.com/api/analytics/funnel",
    "https://nabaperks.com"
  )

  for (const configured of [
    undefined,
    "",
    "https://nabaperks.com/",
    "https://nabaperks.com/path",
    "javascript:alert(1)",
  ]) {
    assert.equal(isSameOriginRequest(request, configured), false)
  }
})

test("declared overflow is rejected before the body is accessed", async () => {
  const request = {
    headers: new Headers({
      "content-length": "9000",
      "content-type": "application/json",
    }),
    get body() {
      throw new Error("body must not be read")
    },
  }

  assert.deepEqual(await readBoundedJsonRequest(request, 8_192), {
    ok: false,
    status: 413,
    error: "payload_too_large",
  })
})

test("streamed and understated bodies cannot bypass the byte ceiling", async () => {
  const payload = JSON.stringify({ body: "x".repeat(200) })
  for (const declaredLength of [undefined, "20"]) {
    const headers = { "content-type": "application/json" }
    if (declaredLength) headers["content-length"] = declaredLength
    const request = new Request("https://nabaperks.test/api", {
      method: "POST",
      headers,
      body: payload,
    })
    const result = await readBoundedJsonRequest(request, 64)
    assert.equal(result.ok, false)
    assert.equal(result.status, 413)
  }
})

test("bounded JSON distinguishes malformed input and preserves valid multibyte data", async () => {
  const malformed = new Request("https://nabaperks.test/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{not-json",
  })
  assert.deepEqual(await readBoundedJsonRequest(malformed, 64), {
    ok: false,
    status: 400,
    error: "invalid_json",
  })

  const value = { title: "Fresh ☕" }
  const valid = new Request("https://nabaperks.test/api", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(value),
  })
  assert.deepEqual(await readBoundedJsonRequest(valid, 64), {
    ok: true,
    value,
  })
})

test("non-JSON media types fail closed", async () => {
  const request = new Request("https://nabaperks.test/api", {
    method: "POST",
    body: "{}",
  })
  const result = await readBoundedJsonRequest(request, 64)
  assert.equal(result.ok, false)
  assert.equal(result.status, 415)
})

test("invalid UTF-8 is malformed JSON, not an oversized payload", async () => {
  const request = new Request("https://nabaperks.test/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: new Uint8Array([0x7b, 0xff, 0x7d]),
  })
  assert.deepEqual(await readBoundedJsonRequest(request, 64), {
    ok: false,
    status: 400,
    error: "invalid_json",
  })
})
