import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const auth = readFileSync("lib/admin/auth.ts", "utf8")

test("admin MFA assurance verifies factors through the access-token path", () => {
  assert.match(auth, /supabase\.auth\.getSession\(\)/)
  assert.match(
    auth,
    /getAuthenticatorAssuranceLevel\(\s*session\.access_token\s*\)/,
    "passing the JWT makes Supabase verify the user and factor list"
  )
  assert.doesNotMatch(
    auth,
    /getAuthenticatorAssuranceLevel\(\s*\)/,
    "the cookie-backed session user must not determine factor enrolment"
  )
})
