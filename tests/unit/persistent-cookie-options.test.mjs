import assert from "node:assert/strict"
import test from "node:test"

import { persistentCookieOptions } from "../../lib/http/persistent-cookie-options.ts"

const NOW_MS = Date.parse("2026-09-12T10:00:00.000Z")

test("persistent cookies carry both Max-Age and an absolute Expires date", () => {
  const options = persistentCookieOptions(60, NOW_MS)

  assert.equal(options.httpOnly, true)
  assert.equal(options.sameSite, "lax")
  assert.equal(options.path, "/")
  assert.equal(options.maxAge, 60)
  assert.deepEqual(options.expires, new Date(NOW_MS + 60_000))
  assert.equal(options.secure, process.env.NODE_ENV === "production")
})

test("a zero or negative lifetime expires immediately rather than becoming a session cookie", () => {
  assert.deepEqual(persistentCookieOptions(0, NOW_MS).expires, new Date(NOW_MS))
  assert.equal(persistentCookieOptions(-15, NOW_MS).maxAge, 0)
})
