import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

function read(...segments) {
  return readFileSync(path.join(root, ...segments), "utf8")
}

test("Given Safari discards Max-Age-only cookies When customer cookies are set Then they also carry an absolute Expires date", () => {
  const cookie = read("lib", "http", "persistent-cookie-options.ts")
  const session = read("lib", "customer", "session.ts")
  const proxy = read("proxy.ts")

  assert.match(cookie, /expires: new Date\(nowMs \+ maxAge \* 1_000\)/)
  assert.match(session, /persistentCookieOptions\(customerSessionTtlSeconds\)/)
  assert.match(proxy, /persistentCookieOptions\(CUSTOMER_DEVICE_TTL_SECONDS\)/)
  assert.doesNotMatch(
    proxy,
    /persistentCookieOptions\(CUSTOMER_SESSION_TTL_SECONDS\)/
  )
})

test("Given a returning Safari visit When the proxy runs Then it refreshes the verified device cookie and keeps cookieless requests unscoped", () => {
  const proxy = read("proxy.ts")

  assert.match(proxy, /token: issueCustomerDeviceToken\(verified, secret\)/)
  assert.match(proxy, /customerDevice\?\.isNew \? undefined/)
  assert.doesNotMatch(
    proxy,
    /request\.cookies\.get\(CUSTOMER_SESSION_COOKIE\)\?\.value/
  )
})
