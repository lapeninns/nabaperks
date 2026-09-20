import assert from "node:assert/strict"
import { test } from "node:test"

import {
  parseAdminMerchantId,
  parseCustomerMessagingEnabled,
  parseMerchantSuspensionReason,
} from "@/lib/admin/merchant-control-fields"

test("Given a merchant control When its ID is parsed Then only a complete UUID is accepted", () => {
  const id = "92fc8106-02d6-48d8-a6c9-34efbfac9380"
  assert.equal(parseAdminMerchantId(` ${id} `), id)
  for (const value of [
    null,
    "",
    "merchant",
    `${id},other`,
    new File([], "id"),
  ]) {
    assert.equal(parseAdminMerchantId(value), null)
  }
})

test("Given a messaging toggle When its target state is parsed Then missing or malformed input cannot disable messages", () => {
  assert.equal(parseCustomerMessagingEnabled("true"), true)
  assert.equal(parseCustomerMessagingEnabled("false"), false)
  for (const value of [null, "", "on", "1", "yes", new File([], "enabled")]) {
    assert.equal(parseCustomerMessagingEnabled(value), null)
  }
})

test("Given a suspension reason When it is parsed Then trimmed audit context of 4 to 500 characters is required", () => {
  assert.equal(
    parseMerchantSuspensionReason(" Review required "),
    "Review required"
  )
  assert.equal(parseMerchantSuspensionReason("test"), "test")
  assert.equal(parseMerchantSuspensionReason("a".repeat(500)), "a".repeat(500))
  for (const value of [
    null,
    "",
    "   ",
    "abc",
    " abc ",
    "a".repeat(501),
    new File([], "reason"),
  ]) {
    assert.equal(parseMerchantSuspensionReason(value), null)
  }
})
