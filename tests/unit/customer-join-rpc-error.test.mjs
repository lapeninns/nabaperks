import assert from "node:assert/strict"
import { test } from "node:test"

import { classifyJoinRpcFailure } from "../../lib/customer/join-rpc-error.ts"

test("join RPC failures expose bounded operational categories", () => {
  assert.equal(classifyJoinRpcFailure({ code: "42501" }), "permission_denied")
  assert.equal(classifyJoinRpcFailure({ code: "PGRST202" }), "schema_mismatch")
  assert.equal(
    classifyJoinRpcFailure({ code: "08006" }),
    "database_unavailable"
  )
  assert.equal(classifyJoinRpcFailure({ code: "23505" }), "database_conflict")
  assert.equal(
    classifyJoinRpcFailure({
      code: "P0001",
      message: "This loyalty card is unavailable",
    }),
    "invalid_join_context"
  )
  assert.equal(
    classifyJoinRpcFailure({ code: "P0001", message: "Unexpected failure" }),
    "database_rejected"
  )
})
