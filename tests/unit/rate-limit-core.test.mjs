import assert from "node:assert/strict"
import { test } from "node:test"

import {
  rateLimitIdentityFromHeaders,
  trustedClientIp,
} from "@/lib/security/rate-limit-core"

test("Given a Vercel forwarded IP When identity is derived Then it is the trusted bucket input", () => {
  const headers = new Headers({
    "x-vercel-forwarded-for": " 203.0.113.10 ",
    "x-forwarded-for": "198.51.100.20, 198.51.100.21",
    "x-real-ip": "198.51.100.99",
  })

  assert.equal(trustedClientIp(headers), "203.0.113.10")
})

test("Given only x-forwarded-for When identity is derived Then the nearest proxy hop wins", () => {
  const headers = new Headers({
    "x-forwarded-for": "198.51.100.20, 198.51.100.21",
    "x-real-ip": "198.51.100.99",
  })

  assert.equal(trustedClientIp(headers), "198.51.100.21")
})

test("Given only spoofable raw IP headers When identity is derived Then the bucket falls back to unknown", () => {
  const headers = new Headers({
    "x-real-ip": "198.51.100.99",
  })

  assert.equal(trustedClientIp(headers), "unknown")
})

test("Given equivalent headers When identity hashes are derived Then the hash is stable and bounded", () => {
  const headers = new Headers({
    "x-vercel-forwarded-for": "203.0.113.10",
    "user-agent": "Nabaperks test browser",
  })

  const first = rateLimitIdentityFromHeaders(headers)
  const second = rateLimitIdentityFromHeaders(headers)

  assert.equal(first, second)
  assert.match(first, /^[0-9a-f]{32}$/)
})

test("Given different trusted inputs When identity hashes are derived Then the buckets differ", () => {
  const first = rateLimitIdentityFromHeaders(
    new Headers({
      "x-vercel-forwarded-for": "203.0.113.10",
      "user-agent": "Nabaperks test browser",
    })
  )
  const second = rateLimitIdentityFromHeaders(
    new Headers({
      "x-vercel-forwarded-for": "203.0.113.11",
      "user-agent": "Nabaperks test browser",
    })
  )

  assert.notEqual(first, second)
})
