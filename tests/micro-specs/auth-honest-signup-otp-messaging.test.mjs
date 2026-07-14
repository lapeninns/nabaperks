import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const actions = readFileSync("app/(auth)/actions.ts", "utf8")
const verifyPage = readFileSync(
  "app/(auth)/signup/verify/page.tsx",
  "utf8"
)

test("signup resend success stays honest when provider delivery is enumeration-neutral", () => {
  assert.match(
    actions,
    /If this email can receive a signup code, a fresh \$\{merchantEmailOtpAliasDigitLabel\(\)\} code may be on its way\./,
    "signup resend success must make delivery conditional"
  )
  assert.doesNotMatch(
    actions,
    /We sent a fresh \$\{merchantEmailOtpAliasDigitLabel\(\)\} code/,
    "signup resend success must not claim that the provider delivered a code"
  )
  assert.match(
    actions,
    /Used this email before\? Log in or reset your password\./,
    "enumeration-neutral signup success must point existing merchants to recovery"
  )
})

test("signup verification keeps code entry and account recovery paths", () => {
  assert.match(verifyPage, /enter the \$\{otpCodeLabel\} code/)
  assert.match(verifyPage, /log in or reset your password instead/)
})
