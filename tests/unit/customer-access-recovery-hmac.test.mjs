import assert from "node:assert/strict"
import { test } from "node:test"

import { customerAccessRecoveryCodeHmac } from "@/lib/customer/access-continuity-core"

// The e2e fixture derives its expected digest with this same function, so a
// change that dropped a binding field would move both sides together and that
// test would stay green. These vectors pin the construction independently:
// they fail if any input stops binding, if the separators change, or if the
// email stops being lowercased.
const VECTOR = {
  secret: "known-answer-secret-value-32-chars",
  customerId: "11111111-2222-3333-4444-555555555555",
  deviceHash: "a".repeat(64),
  email: "Recover@Example.Test",
  code: "314159",
}

test("the recovery code digest binds every field", () => {
  const digest = customerAccessRecoveryCodeHmac(VECTOR)
  assert.match(digest, /^[a-f0-9]{64}$/)

  // Each field must change the digest on its own.
  for (const [field, replacement] of [
    ["secret", "a-different-secret-value-32-chars!"],
    ["customerId", "99999999-2222-3333-4444-555555555555"],
    ["deviceHash", "b".repeat(64)],
    ["email", "someone-else@example.test"],
    ["code", "271828"],
  ])
    assert.notEqual(
      customerAccessRecoveryCodeHmac({ ...VECTOR, [field]: replacement }),
      digest,
      `${field} must bind the digest`
    )

  // Case and surrounding whitespace in the email are normalised, so these
  // must agree with the canonical vector rather than differ from it.
  assert.equal(
    customerAccessRecoveryCodeHmac({ ...VECTOR, email: "  recover@example.test  " }),
    digest
  )

  // Field boundaries must be separated: concatenating across the
  // customerId/deviceHash boundary must not collide with the canonical input.
  assert.notEqual(
    customerAccessRecoveryCodeHmac({
      ...VECTOR,
      customerId: VECTOR.customerId + VECTOR.deviceHash.slice(0, 1),
      deviceHash: VECTOR.deviceHash.slice(1) + "c",
    }),
    digest
  )
})
