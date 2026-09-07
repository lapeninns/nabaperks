import assert from "node:assert/strict"
import { test } from "node:test"

import { parseCustomerSessionLoadRow } from "@/lib/customer/session-load-row"

const activeRow = {
  status: "active",
  id: "11111111-1111-4111-8111-111111111111",
  email: "a@example.test",
  phone_last4: "0123",
  created_at: "2026-09-07T10:00:00+00:00",
}

test("an active row is returned with its identity columns", () => {
  const parsed = parseCustomerSessionLoadRow(activeRow)
  assert.equal(parsed.status, "active")
  assert.equal(parsed.status === "active" && parsed.row.phone_last4, "0123")
})

test("a one-element array (PostgREST returns table) is unwrapped", () => {
  const parsed = parseCustomerSessionLoadRow([activeRow])
  assert.equal(parsed.status, "active")
})

test("customer_missing is preserved so the app clears the cookie rather than bouncing to login", () => {
  assert.deepEqual(
    parseCustomerSessionLoadRow({ status: "customer_missing" }),
    {
      status: "customer_missing",
    }
  )
})

test("anything unrecognised fails closed to inactive", () => {
  for (const input of [
    { status: "inactive" },
    { status: "active" },
    { status: "active", id: "" },
    { status: "weird", id: activeRow.id },
    null,
    undefined,
    [],
    "active",
  ]) {
    assert.deepEqual(parseCustomerSessionLoadRow(input), { status: "inactive" })
  }
})
