import assert from "node:assert/strict"
import { test } from "node:test"

process.env.CUSTOMER_EMAIL_HMAC_SECRET ??= "unit-test-email-hmac-secret"

const { parseInviteEmailInput } =
  await import("@/lib/loyalty-invites/import-core")

/** Pure parse / normalise / dedupe for the merchant's pasted or uploaded list. */

test("parses newline and comma separated addresses", () => {
  const result = parseInviteEmailInput(
    "a@example.com, b@example.com\nc@example.com"
  )
  assert.deepEqual(
    [...result.emails],
    ["a@example.com", "b@example.com", "c@example.com"]
  )
  assert.equal(result.validCount, 3)
})

test("normalises case and whitespace", () => {
  const result = parseInviteEmailInput("  Alice@Example.COM  ")
  assert.deepEqual([...result.emails], ["alice@example.com"])
})

test("counts duplicates once, keeps the first", () => {
  const result = parseInviteEmailInput(
    "a@example.com\nA@example.com\nb@example.com"
  )
  assert.deepEqual([...result.emails], ["a@example.com", "b@example.com"])
  assert.equal(result.duplicateCount, 1)
})

test("counts invalid rows and excludes them", () => {
  const result = parseInviteEmailInput(
    "good@example.com\nnot-an-email\nalso bad@x"
  )
  assert.deepEqual([...result.emails], ["good@example.com"])
  assert.equal(result.invalidCount, 2)
})

test("reads the email column of a CSV with a header", () => {
  const csv = [
    "name,email,notes",
    "Alice,alice@example.com,vip",
    'Bob,"bob@example.com",regular',
  ].join("\n")
  const result = parseInviteEmailInput(csv)
  assert.deepEqual([...result.emails], ["alice@example.com", "bob@example.com"])
})

test("flags over-limit without silently trimming", () => {
  const many = Array.from(
    { length: 2001 },
    (_, i) => `user${i}@example.com`
  ).join("\n")
  const result = parseInviteEmailInput(many)
  assert.equal(result.validCount, 2001)
  assert.equal(result.overLimit, true)
})

test("empty input yields zero counts", () => {
  const result = parseInviteEmailInput("\n\n , ;\n")
  assert.equal(result.validCount, 0)
  assert.equal(result.overLimit, false)
})
