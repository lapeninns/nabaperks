import assert from "node:assert/strict"
import { test } from "node:test"

import { adminActionSuccess } from "@/lib/admin/action-state"

test("adminActionSuccess returns message-only success state", () => {
  assert.deepEqual(adminActionSuccess("ok"), {
    status: "success",
    message: "ok",
  })
})

test("admin action success cannot retain a raw export descriptor", () => {
  const untrustedArguments = [
    "ok",
    {
      filename: "customer-data-export.json",
      content: '{"private":"value"}',
      mimeType: "application/json",
    },
  ]
  const success = Reflect.apply(
    adminActionSuccess,
    undefined,
    untrustedArguments
  )

  assert.deepEqual(success, { status: "success", message: "ok" })
})
