import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

function read(...segments) {
  return readFileSync(path.join(root, ...segments), "utf8")
}

test("customer OTP actions prepare every pending-cookie prerequisite before provider send", () => {
  const join = read("app", "m", "[merchantSlug]", "join", "actions.ts")
  const wallet = read("app", "home", "actions.ts")

  for (const source of [join, wallet]) {
    const prepare = source.indexOf(
      "const preparedVerification = await preparePendingPhoneVerification"
    )
    const send = source.indexOf("startCustomerPhoneVerification(contact)")
    const commit = source.indexOf(
      "commitPendingPhoneVerification(preparedVerification)"
    )

    assert.ok(prepare >= 0, "pending verification must be prepared")
    assert.ok(prepare < commit, "pending verification must be prepared first")
    assert.ok(
      commit < send,
      "pending cookie must be writable before provider dispatch"
    )
  }
})

test("pending-phone preparation resolves cookie and cryptographic dependencies eagerly", () => {
  const session = read("lib", "customer", "session.ts")

  assert.match(
    session,
    /preparePendingPhoneVerification[\s\S]*customerPhoneHmac\(input\.phone\)/
  )
  assert.match(
    session,
    /preparePendingPhoneVerification[\s\S]*customerSessionSecret\(\)/
  )
  assert.match(
    session,
    /preparePendingPhoneVerification[\s\S]*await cookies\(\)/
  )
  assert.match(
    session,
    /preparePendingPhoneVerification[\s\S]*createPendingPhoneCookieValue/
  )
})
