import assert from "node:assert/strict"
import { test } from "node:test"

import {
  customerEmailHmac,
  looksLikeEmail,
  maskEmail,
  normalizeEmail,
} from "@/lib/customer/email-pii-core"

/**
 * MS-rewards-merchant-sent (Phase 4) — the pure email PII codec used for invite
 * matching. The HMAC is read lazily, so it only needs the secret when called.
 */

test("normalizeEmail trims + lowercases and does NOT fold plus-addresses", () => {
  assert.equal(normalizeEmail("  Foo@Bar.COM "), "foo@bar.com")
  assert.equal(normalizeEmail("a+tag@x.com"), "a+tag@x.com")
})

test("maskEmail hides the local part", () => {
  assert.equal(maskEmail("regular@example.com"), "r***@example.com")
  assert.equal(maskEmail("not-an-email"), null)
})

test("looksLikeEmail distinguishes email from phone", () => {
  assert.equal(looksLikeEmail("regular@example.com"), true)
  assert.equal(looksLikeEmail("+447700900000"), false)
  assert.equal(looksLikeEmail("a b@x.com"), false)
})

test("customerEmailHmac is deterministic, case-insensitive, and needs the secret", () => {
  const original = process.env.CUSTOMER_EMAIL_HMAC_SECRET
  process.env.CUSTOMER_EMAIL_HMAC_SECRET = "unit-test-email-secret"
  try {
    const a = customerEmailHmac("Regular@Example.com")
    const b = customerEmailHmac("regular@example.com")
    assert.equal(a, b, "case-insensitive")
    assert.match(a, /^[a-f0-9]{64}$/)
    assert.notEqual(a, customerEmailHmac("other@example.com"))

    delete process.env.CUSTOMER_EMAIL_HMAC_SECRET
    assert.throws(() => customerEmailHmac("x@y.com"), /CUSTOMER_EMAIL_HMAC_SECRET/)
  } finally {
    if (original === undefined) delete process.env.CUSTOMER_EMAIL_HMAC_SECRET
    else process.env.CUSTOMER_EMAIL_HMAC_SECRET = original
  }
})
