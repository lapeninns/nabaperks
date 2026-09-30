import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

function read(...segments) {
  return readFileSync(path.join(root, ...segments), "utf8")
}

test("Given Safari discards Max-Age-only cookies When customer cookies are set Then they carry an absolute Expires date", () => {
  const cookie = read("lib", "http", "persistent-cookie-options.ts")
  const fixedExpiry = read("lib", "customer", "session-cookie-options.ts")
  const session = read("lib", "customer", "session.ts")
  const proxy = read("proxy.ts")

  assert.match(cookie, /expires: new Date\(nowMs \+ maxAge \* 1_000\)/)
  // The device and session cookies keep that Expires and drop
  // Max-Age, so Next cannot recompute Expires when a redirect re-serialises
  // them (QA BUG-067). Expires alone still persists across Safari restarts.
  assert.match(
    fixedExpiry,
    /const \{ httpOnly, sameSite, secure, path, expires \} = persistentCookieOptions\(/
  )
  assert.match(
    fixedExpiry,
    /return \{ httpOnly, sameSite, secure, path, expires \}/
  )
  assert.match(session, /fixedExpiryCookieOptions\(customerSessionTtlSeconds\)/)
  assert.match(proxy, /fixedExpiryCookieOptions\(CUSTOMER_DEVICE_TTL_SECONDS\)/)
})

test("Given a returning Safari visit When the proxy runs Then it refreshes the verified device cookie on GET and keeps cookieless requests unscoped", () => {
  const proxy = read("proxy.ts")

  assert.match(proxy, /token: issueCustomerDeviceToken\(verified, secret\)/)
  assert.match(proxy, /customerDevice\?\.isNew \? undefined/)
  assert.match(
    proxy,
    /if \(joinJourney && canPersistFirstPartyCookies\(request\)\)/
  )
  assert.match(
    proxy,
    /if \(customerDevice && canPersistFirstPartyCookies\(request\)\)/
  )
  assert.match(
    proxy,
    /request\.method === "GET" \|\| request\.method === "HEAD"/
  )
  assert.doesNotMatch(proxy, /isNew \|\| canPersistFirstPartyCookies/)
})

test("Given sessions last until log-out When the proxy renews a session cookie Then it re-signs it on GET beside a valid device, never re-setting the old value", () => {
  const proxy = read("proxy.ts")
  const renewal = read("lib", "customer", "session-renewal-core.ts")
  const session = read("lib", "customer", "session.ts")

  // Renewal is gated like the device cookie, and only for an existing device:
  // a session cannot be used from a freshly minted one.
  assert.match(
    proxy,
    /customerDevice &&\s+!customerDevice\.isNew &&\s+canPersistFirstPartyCookies\(request\)/
  )
  assert.match(proxy, /renewCustomerSessionCookieValue\(\{/)
  assert.match(
    proxy,
    /CUSTOMER_SESSION_COOKIE,\s*renewedSession,\s*fixedExpiryCookieOptions\(CUSTOMER_SESSION_TTL_SECONDS\)/
  )
  // The 12 September rule still holds: the cookie is never stretched past its
  // signed expiry, because renewal signs a new expiry rather than re-setting
  // the presented value.
  assert.doesNotMatch(
    proxy,
    /request\.cookies\.get\(CUSTOMER_SESSION_COOKIE\)\?\.value,\s*(persistentCookieOptions|fixedExpiryCookieOptions)/
  )
  assert.match(
    renewal,
    /readCustomerSessionCookieValue\(value, secret, nowSeconds\)/
  )
  assert.match(renewal, /expiresAt: nowSeconds \+ ttlSeconds/)

  // The server-side session row is open-ended; the cookie carries the window.
  assert.match(session, /p_expires_at: CUSTOMER_SESSION_SERVER_EXPIRY/)
  assert.match(session, /const CUSTOMER_SESSION_SERVER_EXPIRY = "infinity"/)
})
