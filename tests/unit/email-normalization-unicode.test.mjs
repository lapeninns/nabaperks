import assert from "node:assert/strict"
import { test } from "node:test"

import {
  customerEmailHmac,
  normalizeEmail,
} from "@/lib/customer/email-pii-core"

/**
 * One address, one key (QA BUG-024, BUG-054). `normalizeEmail` decides the
 * verified-email HMAC that email sign-in resolves and the address the unique
 * index compares, so every way of writing the same address must normalise to
 * the same string: any Unicode whitespace at either end is dropped, case is
 * folded, and the result is in Unicode NFC, so a precomposed e-acute (U+00E9) and
 * "e" + combining acute (U+0301) are one address.
 */

const NFC = "caf\u00e9@example.com"
const NFD = "cafe\u0301@example.com"

test("normalizeEmail composes NFD to NFC so both forms are one address", () => {
  assert.notEqual(NFC, NFD)
  assert.equal(normalizeEmail(NFD), NFC)
  assert.equal(normalizeEmail(NFC), NFC)
  // Case folding before composition still lands on the composed form.
  assert.equal(normalizeEmail("CAFE\u0301@EXAMPLE.COM"), NFC)
  assert.equal(normalizeEmail("CAF\u00c9@Example.com"), NFC)
})

test("normalizeEmail drops every kind of edge whitespace, not only spaces", () => {
  for (const edge of [
    " ",
    "\t",
    "\n",
    "\r\n",
    "\v",
    "\f",
    "\u00a0",
    "\u1680",
    "\u2003",
    "\u2028",
    "\u2029",
    "\u202f",
    "\u205f",
    "\u3000",
    "\ufeff",
  ]) {
    const label = JSON.stringify(edge)
    assert.equal(
      normalizeEmail(`${edge}Guest@Example.com${edge}`),
      "guest@example.com",
      label
    )
  }
  // Inner characters are the address itself and are kept.
  assert.equal(normalizeEmail("a+tag@x.com"), "a+tag@x.com")
})

test("the email HMAC is the same for NFC, NFD and padded forms of one address", () => {
  const original = process.env.CUSTOMER_EMAIL_HMAC_SECRET
  process.env.CUSTOMER_EMAIL_HMAC_SECRET = "unit-test-email-secret"
  try {
    const key = customerEmailHmac(NFC)
    assert.equal(customerEmailHmac(NFD), key)
    assert.equal(customerEmailHmac(`\u00a0${NFD.toUpperCase()}\t`), key)
    assert.notEqual(customerEmailHmac("cafe@example.com"), key)
  } finally {
    if (original === undefined) delete process.env.CUSTOMER_EMAIL_HMAC_SECRET
    else process.env.CUSTOMER_EMAIL_HMAC_SECRET = original
  }
})
