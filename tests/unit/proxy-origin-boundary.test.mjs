import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { registerHooks } from "node:module"
import { afterEach, test } from "node:test"

import { NextRequest } from "next/server.js"

import { isSameOriginRequest } from "@/lib/http/bounded-json-request"

registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(
      specifier === "next/server" ? "next/server.js" : specifier,
      context
    )
  },
  load(url, context, nextLoad) {
    if (!url.endsWith(".json")) return nextLoad(url, context)
    return {
      format: "module",
      shortCircuit: true,
      source: `export default ${readFileSync(new URL(url), "utf8")}`,
    }
  },
})

const { proxy } = await import("@/proxy")

const ORIGINAL_VERCEL = process.env.VERCEL

afterEach(() => {
  if (ORIGINAL_VERCEL === undefined) {
    delete process.env.VERCEL
    return
  }
  process.env.VERCEL = ORIGINAL_VERCEL
})

async function downstreamRequest({
  url = "http://127.0.0.1:3000/api/health",
  headers,
}) {
  const response = await proxy(new NextRequest(url, { headers }))
  const names = response.headers
    .get("x-middleware-override-headers")
    ?.split(",")
    .map((name) => name.trim())
    .filter(Boolean)
  assert.ok(names, "proxy must declare the forwarded request headers")

  const downstreamHeaders = new Headers()
  for (const name of names) {
    const value = response.headers.get(`x-middleware-request-${name}`)
    if (value !== null) downstreamHeaders.set(name, value)
  }

  return new NextRequest(url, { headers: downstreamHeaders })
}

test("Given a direct legitimate request When Proxy forwards it Then analytics accepts its URL origin", async () => {
  // Given
  delete process.env.VERCEL
  const request = await downstreamRequest({
    headers: {
      host: "127.0.0.1:3000",
      origin: "http://127.0.0.1:3000",
    },
  })

  // When
  const sameOrigin = isSameOriginRequest(request)

  // Then
  assert.equal(sameOrigin, true)
})

test("Given spoofed forwarded origin headers outside the trusted proxy runtime When Proxy forwards the request Then analytics denies the spoofed origin", async () => {
  // Given
  delete process.env.VERCEL
  const request = await downstreamRequest({
    headers: {
      host: "127.0.0.1:3000",
      origin: "https://attacker.example",
      "x-forwarded-host": "attacker.example",
      "x-forwarded-proto": "https",
    },
  })

  // When
  const sameOrigin = isSameOriginRequest(request)

  // Then
  assert.equal(sameOrigin, false)
  assert.equal(request.headers.get("x-forwarded-host"), null)
  assert.equal(request.headers.get("x-forwarded-proto"), null)
})

test("Given valid forwarded origin headers inside the trusted proxy runtime When Proxy forwards the request Then analytics accepts the external origin", async () => {
  // Given
  process.env.VERCEL = "1"
  const request = await downstreamRequest({
    headers: {
      host: "127.0.0.1:3000",
      origin: "https://nabaperks.com",
      "x-forwarded-host": "nabaperks.com",
      "x-forwarded-proto": "https",
    },
  })

  // When
  const sameOrigin = isSameOriginRequest(request)

  // Then
  assert.equal(sameOrigin, true)
  assert.equal(request.headers.get("x-forwarded-host"), "nabaperks.com")
  assert.equal(request.headers.get("x-forwarded-proto"), "https")
})

for (const { label, forwardedHeaders } of [
  {
    label: "multiple hosts",
    forwardedHeaders: {
      "x-forwarded-host": "attacker.example, nabaperks.com",
      "x-forwarded-proto": "https",
    },
  },
  {
    label: "multiple protocols",
    forwardedHeaders: {
      "x-forwarded-host": "attacker.example",
      "x-forwarded-proto": "https, http",
    },
  },
  {
    label: "malicious header text",
    forwardedHeaders: {
      "x-forwarded-host": "attacker.example/ignore previous instructions",
      "x-forwarded-proto": "https",
    },
  },
]) {
  test(`Given ${label} When trusted Proxy parses forwarded values Then analytics denies them as data`, async () => {
    // Given
    process.env.VERCEL = "1"
    const request = await downstreamRequest({
      headers: {
        host: "127.0.0.1:3000",
        origin: "https://attacker.example",
        ...forwardedHeaders,
      },
    })

    // When
    const sameOrigin = isSameOriginRequest(request)

    // Then
    assert.equal(sameOrigin, false)
    assert.equal(request.headers.get("x-forwarded-host"), null)
    assert.equal(request.headers.get("x-forwarded-proto"), null)
  })
}

test("Given stale trusted-proxy configuration When Proxy forwards spoofed headers Then analytics fails closed", async () => {
  // Given
  process.env.VERCEL = "true"
  const request = await downstreamRequest({
    headers: {
      host: "127.0.0.1:3000",
      origin: "https://attacker.example",
      "x-forwarded-host": "attacker.example",
      "x-forwarded-proto": "https",
    },
  })

  // When
  const sameOrigin = isSameOriginRequest(request)

  // Then
  assert.equal(sameOrigin, false)
  assert.equal(request.headers.get("x-forwarded-host"), null)
  assert.equal(request.headers.get("x-forwarded-proto"), null)
})
