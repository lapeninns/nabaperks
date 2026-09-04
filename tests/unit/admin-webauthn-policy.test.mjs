import assert from "node:assert/strict"
import { test } from "node:test"

import {
  ADMIN_MFA_BOOTSTRAP_ORIGIN,
  resolveAdminWebAuthnContext,
} from "@/lib/admin/webauthn-policy"

test("the canonical application origin uses the pinned apex relying party", () => {
  assert.deepEqual(resolveAdminWebAuthnContext("https://nabaperks.com"), {
    rpId: "nabaperks.com",
    rpOrigins: ["https://nabaperks.com", ADMIN_MFA_BOOTSTRAP_ORIGIN],
  })
})

test("the reviewed bootstrap subdomain shares the same relying party", () => {
  assert.equal(
    resolveAdminWebAuthnContext(ADMIN_MFA_BOOTSTRAP_ORIGIN).rpId,
    "nabaperks.com"
  )
})

test("lookalike and arbitrary preview origins cannot choose the ceremony origin", () => {
  for (const origin of [
    "https://nabaperks.com.evil.example",
    "https://preview.example",
  ]) {
    assert.throws(
      () => resolveAdminWebAuthnContext(origin),
      /approved application origin/
    )
  }
})
