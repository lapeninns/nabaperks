import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { test } from "node:test"

import {
  EMAIL_SIGN_IN_TTL_SECONDS,
  createPendingEmailSignInCookieValue,
  createVerifiedEmailHandoffCookieValue,
  emailSignInCodeHmac,
  emailSignInDigestsMatch,
  generateEmailSignInCode,
  isEmailSignInCodeShape,
  newestSignedOutJoinChallenge,
  parsePendingEmailSignInPayload,
  parseVerifiedEmailHandoffPayload,
  readPendingEmailSignInCookieValue,
  readVerifiedEmailHandoffCookieValue,
  unguessableEmailSignInDigest,
  verifiedEmailHandoffMatches,
} from "@/lib/customer/email-sign-in-core"
import { createEncryptedPendingCookieValue } from "@/lib/customer/pending-cookie-crypto"

const SECRET = "s".repeat(48)
const HEX = (char) => char.repeat(64)
const BASE = {
  secret: SECRET,
  purpose: "join",
  challengeId: "5b0a3c1e-7a7e-4c43-9c43-7c9f1b0f2a11",
  email: "guest@example.com",
  code: "123456",
}

function pendingPayload(overrides = {}) {
  return {
    version: 1,
    purpose: "join",
    email: "guest@example.com",
    emailHmac: HEX("a"),
    challengeId: BASE.challengeId,
    codeHmac: emailSignInCodeHmac(BASE),
    delivery: "sent",
    issuedAt: 1_000,
    expiresAt: 1_000 + EMAIL_SIGN_IN_TTL_SECONDS,
    resendAvailableAt: 1_060,
    ...overrides,
  }
}

function handoffPayload(overrides = {}) {
  return {
    version: 1,
    handoffId: "8d2f1c0e-3b1a-4e5f-9a7b-1c2d3e4f5a6b",
    email: "guest@example.com",
    emailHmac: HEX("a"),
    deviceHash: HEX("d"),
    merchantSlug: "old-crown",
    qrId: "venue-qr",
    issuedAt: 1_000,
    expiresAt: 1_600,
    ...overrides,
  }
}

test("Given the D7 inputs When the code digest is derived Then it is the versioned, NUL-separated HMAC", () => {
  const expected = createHmac("sha256", SECRET)
    .update("nabaperks:customer-email-sign-in:v1")
    .update("\0")
    .update("join")
    .update("\0")
    .update(BASE.challengeId)
    .update("\0")
    .update("guest@example.com")
    .update("\0")
    .update("123456")
    .digest("hex")

  assert.equal(emailSignInCodeHmac(BASE), expected)
  // The address is compared normalised, as it is stored.
  assert.equal(
    emailSignInCodeHmac({ ...BASE, email: "  Guest@Example.COM " }),
    expected
  )
})

test("Given one changed binding When the digest is derived Then purpose, challenge, email, code and version each change it", () => {
  const original = emailSignInCodeHmac(BASE)
  for (const changed of [
    { purpose: "wallet" },
    { challengeId: "0f9f6c1e-0000-4000-8000-000000000000" },
    { email: "other@example.com" },
    { code: "123457" },
    { version: 2 },
    { secret: "t".repeat(48) },
  ]) {
    assert.notEqual(
      emailSignInCodeHmac({ ...BASE, ...changed }),
      original,
      JSON.stringify(changed)
    )
  }
})

test("Given digests When compared Then only equal well-formed hex matches", () => {
  const digest = emailSignInCodeHmac(BASE)
  assert.equal(emailSignInDigestsMatch(digest, digest), true)
  assert.equal(emailSignInDigestsMatch(digest, HEX("0")), false)
  assert.equal(emailSignInDigestsMatch("abc", digest), false)
  assert.equal(emailSignInDigestsMatch(digest, ""), false)
})

test("Given generated codes When shaped Then they are always six digits", () => {
  for (let i = 0; i < 50; i += 1) {
    assert.equal(isEmailSignInCodeShape(generateEmailSignInCode()), true)
  }
  for (const code of ["12345", "1234567", "12345a", ""]) {
    assert.equal(isEmailSignInCodeShape(code), false)
  }
})

test("Given a pending challenge cookie When read back Then it round-trips until it expires", () => {
  const payload = pendingPayload()
  const value = createPendingEmailSignInCookieValue(payload, SECRET)

  assert.deepEqual(readPendingEmailSignInCookieValue(value, SECRET, 1_001), {
    ok: true,
    payload,
  })
  assert.deepEqual(
    readPendingEmailSignInCookieValue(value, SECRET, payload.expiresAt),
    { ok: false, reason: "expired" }
  )
  assert.equal(
    readPendingEmailSignInCookieValue(value, "t".repeat(48), 1_001).ok,
    false
  )
})

test("Given a cookie minted for another context When read as a challenge Then it is refused", () => {
  const payload = pendingPayload()
  for (const context of ["email", "email-handoff", "phone"]) {
    const value = createEncryptedPendingCookieValue({
      payload,
      secret: SECRET,
      context,
    })
    assert.equal(
      readPendingEmailSignInCookieValue(value, SECRET, 1_001).ok,
      false,
      context
    )
  }
})

test("Given malformed challenge payloads When parsed Then each is refused", () => {
  assert.ok(parsePendingEmailSignInPayload(pendingPayload()))
  for (const broken of [
    { version: 2 },
    { purpose: "attach" },
    { email: "" },
    { emailHmac: "not-hex" },
    { codeHmac: HEX("A") },
    { challengeId: 7 },
    { expiresAt: "1600" },
    { resendAvailableAt: 1.5 },
    { delivery: undefined },
    { delivery: "queued" },
    { delivery: true },
  ]) {
    assert.equal(
      parsePendingEmailSignInPayload(pendingPayload(broken)),
      null,
      JSON.stringify(broken)
    )
  }
  assert.equal(parsePendingEmailSignInPayload(null), null)
  assert.equal(parsePendingEmailSignInPayload([]), null)
})

test("Given a handoff When its binding is checked Then only the same device, venue and QR match", () => {
  const payload = handoffPayload()
  const binding = {
    deviceHash: HEX("d"),
    merchantSlug: "old-crown",
    qrId: "venue-qr",
  }
  assert.equal(verifiedEmailHandoffMatches(payload, binding), true)
  for (const changed of [
    { deviceHash: HEX("e") },
    { deviceHash: null },
    { merchantSlug: "the-bell" },
    { qrId: "other-qr" },
    { qrId: undefined },
  ]) {
    assert.equal(
      verifiedEmailHandoffMatches(payload, { ...binding, ...changed }),
      false,
      JSON.stringify(changed)
    )
  }

  const direct = handoffPayload({ qrId: null })
  assert.equal(
    verifiedEmailHandoffMatches(direct, { ...binding, qrId: "" }),
    true
  )
  assert.equal(
    verifiedEmailHandoffMatches(direct, { ...binding, qrId: "venue-qr" }),
    false
  )
})

test("Given a handoff cookie When read back Then it round-trips and never reads as a challenge", () => {
  const payload = handoffPayload()
  const value = createVerifiedEmailHandoffCookieValue(payload, SECRET)
  assert.deepEqual(readVerifiedEmailHandoffCookieValue(value, SECRET, 1_001), {
    ok: true,
    payload,
  })
  assert.equal(
    readVerifiedEmailHandoffCookieValue(value, SECRET, 1_600).ok,
    false
  )
  assert.equal(
    readPendingEmailSignInCookieValue(value, SECRET, 1_001).ok,
    false
  )
})

test("Given each delivery state When the cookie is sealed Then every one round-trips at the same length", () => {
  const lengths = new Set()
  for (const delivery of ["sent", "held", "fail"]) {
    const payload = pendingPayload({ delivery })
    const value = createPendingEmailSignInCookieValue(payload, SECRET)
    assert.deepEqual(readPendingEmailSignInCookieValue(value, SECRET, 1_001), {
      ok: true,
      payload,
    })
    lengths.add(value.length)
  }
  // A refused (`held`) send cannot be told from a sent one by cookie size.
  assert.equal(lengths.size, 1)
})

test("Given a held challenge's digest When minted Then it has a real digest's shape but is random", () => {
  const first = unguessableEmailSignInDigest()
  assert.match(first, /^[0-9a-f]{64}$/)
  assert.notEqual(unguessableEmailSignInDigest(), first)
  assert.ok(parsePendingEmailSignInPayload(pendingPayload({ codeHmac: first })))
})

test("Given a handoff without its single-use id When parsed Then it is refused", () => {
  assert.ok(parseVerifiedEmailHandoffPayload(handoffPayload()))
  for (const handoffId of [undefined, "", 7]) {
    assert.equal(
      parseVerifiedEmailHandoffPayload(handoffPayload({ handoffId })),
      null,
      String(handoffId)
    )
  }
})

test("Given several signed-out join cookies When the screen is chosen Then the newest challenge wins", () => {
  assert.equal(newestSignedOutJoinChallenge({}), null)
  // A handoff left behind must not hide the phone code requested after it.
  assert.equal(
    newestSignedOutJoinChallenge({ emailHandoff: 1_000, phoneCode: 1_030 }),
    "phone_code"
  )
  assert.equal(
    newestSignedOutJoinChallenge({ emailHandoff: 1_030, phoneCode: 1_000 }),
    "email_handoff"
  )
  assert.equal(
    newestSignedOutJoinChallenge({ emailCode: 1_050, phoneCode: 1_000 }),
    "email_code"
  )
  assert.equal(
    newestSignedOutJoinChallenge({ emailCode: null, phoneCode: 1_000 }),
    "phone_code"
  )
  assert.equal(
    newestSignedOutJoinChallenge({ emailHandoff: 1_000, emailCode: 1_000 }),
    "email_handoff"
  )
})
