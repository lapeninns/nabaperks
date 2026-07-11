import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

function read(...segments) {
  return readFileSync(path.join(root, ...segments), "utf8")
}

test("Given pending customer identity When its codec is inspected Then only pending state uses context-bound authenticated encryption", () => {
  const core = read("lib", "customer", "session-cookie-core.ts")
  const crypto = read("lib", "customer", "pending-cookie-crypto.ts")

  assert.match(crypto, /aes-256-gcm/)
  assert.match(crypto, /randomBytes\(IV_BYTES\)/)
  assert.match(crypto, /setAAD\(authenticatedContext\(context\)\)/)
  assert.match(core, /context: "phone"/)
  assert.match(core, /context: "email"/)
  assert.match(
    core,
    /createCustomerSessionCookieValue[\s\S]{0,160}return signPayload/
  )
})

test("Given pending customer cookies When their adapter is inspected Then privacy attributes remain server-controlled", () => {
  const session = read("lib", "customer", "session.ts")

  assert.match(session, /httpOnly: true/)
  assert.match(session, /sameSite: "lax" as const/)
  assert.match(session, /secure: process\.env\.NODE_ENV === "production"/)
  assert.match(session, /path: "\/"/)
  assert.match(session, /const pendingPhoneTtlSeconds = 10 \* 60/)
  assert.match(session, /const pendingEmailTtlSeconds = 10 \* 60/)
})

test("Given OTP retries use encrypted pending state When actions answer Then raw contact is not serialized back to the browser", () => {
  const actions = read("app", "m", "[merchantSlug]", "join", "actions.ts")

  assert.match(actions, /!isTrustedResend \? \{ contact \} : \{\}/)
  assert.doesNotMatch(
    actions,
    /fields: \{ contact, merchantSlug, qrId, phoneOtpSent: true \}/
  )
})
