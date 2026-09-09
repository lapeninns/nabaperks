import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const { createEncryptedPendingCookieValue, readEncryptedPendingCookieValue } =
  await import("@/lib/customer/pending-cookie-crypto")

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

/**
 * AES-256-GCM tag length across the cookie codecs.
 *
 * Unless a cipher is created with an explicit authTagLength, Node accepts ANY
 * valid GCM tag on decrypt — 4 bytes upwards — and verifies only the bytes it
 * is handed. An attacker holding a sealed value could therefore re-present it
 * with a truncated tag, which is orders of magnitude cheaper to forge than a
 * full one. Every value these codecs have written carries Node's 16-byte
 * default, so demanding 16 turns away truncated tags and nothing else.
 *
 * The pending-cookie codec is pure and driven here. invite-cookie and
 * offer-cookie keep their encrypt/decrypt helpers module-private behind
 * `next/headers`, so those two are pinned at the source instead.
 */

const SECRET = "unit-test-customer-session-secret"
const PAYLOAD = { expiresAt: 900 }

function sealPendingCookie() {
  return createEncryptedPendingCookieValue({
    payload: PAYLOAD,
    secret: SECRET,
    context: "phone",
  })
}

function readPendingCookie(value) {
  return readEncryptedPendingCookieValue({
    value,
    secret: SECRET,
    context: "phone",
    nowSeconds: 100,
    parse: (payload) => payload,
  })
}

test("Given a pending cookie When it is sealed Then the tag is the full 16 bytes and still reads", () => {
  const value = sealPendingCookie()

  assert.equal(Buffer.from(value.split(".")[3], "base64url").byteLength, 16)
  assert.deepEqual(readPendingCookie(value), { ok: true, payload: PAYLOAD })
})

test("Given a pending cookie with a truncated tag When it is read Then it is refused", () => {
  const parts = sealPendingCookie().split(".")
  parts[3] = Buffer.from(parts[3], "base64url")
    .subarray(0, 4)
    .toString("base64url")

  // This codec already measured the tag before decrypting, so the refusal reads
  // as "malformed" rather than a failed AEAD check. authTagLength shuts the
  // same door one layer down, where the other codecs had nothing at all.
  assert.deepEqual(readPendingCookie(parts.join(".")), {
    ok: false,
    reason: "malformed",
  })
})

for (const modulePath of [
  "lib/loyalty-invites/invite-cookie.ts",
  "lib/offers/offer-cookie.ts",
]) {
  test(`Given ${modulePath} When its ciphers are inspected Then every one pins the tag length`, () => {
    const source = readFileSync(path.join(root, modulePath), "utf8")
    const ciphers = source.match(/create(?:Cipher|Decipher)iv\(/g) ?? []
    const pinned = source.match(/authTagLength: TAG_BYTES/g) ?? []

    assert.match(source, /const TAG_BYTES = 16\b/)
    assert.ok(ciphers.length > 0, "the module still builds its own ciphers")
    assert.equal(
      pinned.length,
      ciphers.length,
      "a cipher without authTagLength would accept a 4-byte tag"
    )
  })
}
