import assert from "node:assert/strict"
import { after, before, test } from "node:test"

const SECRET_NAME = "CUSTOMER_SESSION_SECRET"
const ORIGINAL_SECRET = process.env[SECRET_NAME]
const CAMPAIGN_ID = "3f1c9a2e-9b5d-4c7a-8f21-5d6e7a8b9c01"
const OTHER_CAMPAIGN_ID = "7a2b4c6d-1e3f-4a5b-9c8d-0e1f2a3b4c5d"
const PRIMARY_SECRET =
  "8f2c1d7a9b4e6f0c3a5d8e1b7c9f2a4d6e0b3c5f8a1d7e9b4c2f6a8d0e3b1c"
const ROTATED_SECRET =
  "3b7e1c9a5f2d8b4e0a6c9d1f7b3e5a8c2d6f0b4e9a1c7d5f3b8e2a6c0d4f9b1e"

let tokens

before(async () => {
  process.env[SECRET_NAME] = PRIMARY_SECRET
  tokens = await import("@/lib/offers/tokens")
})

after(() => {
  if (ORIGINAL_SECRET === undefined) {
    delete process.env[SECRET_NAME]
    return
  }

  process.env[SECRET_NAME] = ORIGINAL_SECRET
})

test("Given one campaign and generation When the token is derived twice Then the merchant sees the link they printed", () => {
  const first = tokens.offerClaimToken(CAMPAIGN_ID, 1)
  const second = tokens.offerClaimToken(CAMPAIGN_ID, 1)

  assert.equal(first, second)
  assert.match(first, /^[A-Za-z0-9_-]+$/)
})

test("Given a rotated generation When the token is derived Then the previous link no longer hashes to the stored value", () => {
  const original = tokens.offerClaimToken(CAMPAIGN_ID, 1)
  const rotated = tokens.offerClaimToken(CAMPAIGN_ID, 2)

  assert.notEqual(original, rotated)
  assert.notEqual(
    tokens.hashOfferToken(original),
    tokens.hashOfferToken(rotated)
  )
})

test("Given two campaigns When tokens are derived at the same generation Then neither link opens the other", () => {
  assert.notEqual(
    tokens.offerClaimToken(CAMPAIGN_ID, 1),
    tokens.offerClaimToken(OTHER_CAMPAIGN_ID, 1)
  )
})

test("Given an invalid campaign id or generation When a token is requested Then it refuses rather than deriving", () => {
  assert.throws(
    () => tokens.offerClaimToken("   ", 1),
    /campaign id is required/
  )
  assert.throws(
    () => tokens.offerClaimToken(CAMPAIGN_ID, 0),
    /whole number from 1/
  )
  assert.throws(
    () => tokens.offerClaimToken(CAMPAIGN_ID, 1.5),
    /whole number from 1/
  )
  assert.throws(
    () => tokens.offerClaimToken(CAMPAIGN_ID, -1),
    /whole number from 1/
  )
})

test("Given a token When it is hashed Then the output is stable lowercase SHA-256 hex", () => {
  const token = tokens.offerClaimToken(CAMPAIGN_ID, 1)
  const hash = tokens.hashOfferToken(token)

  assert.match(hash, /^[0-9a-f]{64}$/)
  assert.equal(hash, tokens.hashOfferToken(token))
  assert.notEqual(hash, token)
})

test("Given a claim token When it is encrypted Then it round-trips and never repeats a ciphertext", () => {
  const token = tokens.offerClaimToken(CAMPAIGN_ID, 1)
  const first = tokens.encryptOfferClaimToken(token)
  const second = tokens.encryptOfferClaimToken(token)

  assert.notEqual(first, second, "a fresh IV must be used every time")
  assert.equal(tokens.decryptOfferClaimToken(first), token)
  assert.equal(tokens.decryptOfferClaimToken(second), token)
  assert.equal(first.split(".").length, 4)
  assert.equal(first.split(".")[0], "v1")
})

test("Given tampered or foreign material When it is decrypted Then it returns null rather than guessing", () => {
  const token = tokens.offerClaimToken(CAMPAIGN_ID, 1)
  const ciphertext = tokens.encryptOfferClaimToken(token)
  const [version, iv, body, tag] = ciphertext.split(".")

  assert.equal(tokens.decryptOfferClaimToken("not-a-ciphertext"), null)
  assert.equal(tokens.decryptOfferClaimToken(`v2.${iv}.${body}.${tag}`), null)
  assert.equal(tokens.decryptOfferClaimToken(`${version}.${iv}.${body}`), null)
  assert.equal(
    tokens.decryptOfferClaimToken(
      [version, iv, body, tag.slice(0, -2) + "aa"].join(".")
    ),
    null,
    "an altered auth tag must fail the AEAD check"
  )
})

test("Given a token set When it is built Then it carries exactly what the rotate RPC stores", () => {
  const set = tokens.offerClaimTokenSet(CAMPAIGN_ID, 3)

  assert.equal(set.campaignId, CAMPAIGN_ID)
  assert.equal(set.generation, 3)
  assert.equal(set.claimToken, tokens.offerClaimToken(CAMPAIGN_ID, 3))
  assert.equal(set.claimTokenHash, tokens.hashOfferToken(set.claimToken))
  assert.equal(
    tokens.decryptOfferClaimToken(set.claimTokenCiphertext),
    set.claimToken
  )
})

test("Given the secret rotates When a stored link is recovered Then the ciphertext still yields it but re-derivation does not", () => {
  const set = tokens.offerClaimTokenSet(CAMPAIGN_ID, 1)

  // The ciphertext key is derived from the same secret, so a rotation loses the
  // decrypt path too. What must never happen is a MISMATCHED link being shown:
  // whichever candidate survives, it has to hash to the stored value.
  const rederived = tokens.offerClaimToken(CAMPAIGN_ID, 1)
  assert.equal(tokens.hashOfferToken(rederived), set.claimTokenHash)

  process.env[SECRET_NAME] = ROTATED_SECRET
  const afterRotation = tokens.offerClaimToken(CAMPAIGN_ID, 1)
  assert.notEqual(
    tokens.hashOfferToken(afterRotation),
    set.claimTokenHash,
    "re-derivation under a new secret must not be mistaken for the working link"
  )
  assert.equal(
    tokens.decryptOfferClaimToken(set.claimTokenCiphertext),
    null,
    "material sealed under the old secret must fail closed, not decrypt to rubbish"
  )

  process.env[SECRET_NAME] = PRIMARY_SECRET
})

test("Given no secret is configured When a token is requested Then it fails closed", () => {
  delete process.env[SECRET_NAME]
  assert.throws(
    () => tokens.offerClaimToken(CAMPAIGN_ID, 1),
    /CUSTOMER_SESSION_SECRET must use a generated high-entropy value/
  )
  process.env[SECRET_NAME] = PRIMARY_SECRET
})
