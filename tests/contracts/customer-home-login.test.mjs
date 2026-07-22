import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

function readProjectFile(...segments) {
  return readFileSync(path.join(projectRoot, ...segments), "utf8")
}

test("Given a customer login phone is unknown When the request action runs Then lookup waits until OTP proof", () => {
  const actions = readProjectFile("app", "home", "actions.ts")

  assert.match(actions, /await startCustomerPhoneVerification\(contact\)/)
  const requestStart = actions.indexOf(
    "export async function requestCustomerLoginOtpAction"
  )
  const verifyStart = actions.indexOf(
    "export async function verifyCustomerLoginOtpAction"
  )
  const requestBlock = actions.slice(requestStart, verifyStart)
  assert.doesNotMatch(requestBlock, /findCustomerByVerifiedPhone/)
  assert.doesNotMatch(requestBlock, /customerId:/)
  assert.doesNotMatch(
    actions,
    /if \(!customer\) \{[\s\S]*fields: \{ contact, otpSent: true \}/
  )
  assert.match(
    actions,
    /const verification = await checkCustomerPhoneVerification\(contact, otp\)[\s\S]*findCustomerByVerifiedPhone[\s\S]*if \(!customer\)/
  )
  assert.match(actions, /await clearPendingPhoneVerification\(\)/)
  assert.match(actions, /No cards found for that number yet/)
})

test("Given customer OTP verification fails When the form renders Then verify feedback is shown from its own action state", () => {
  const form = readProjectFile(
    "components",
    "customer",
    "customer-login-form.tsx"
  )

  assert.match(
    form,
    /const \[verifyState, verifyAction, verifyPending\] = useActionState\([\s\S]*verifyCustomerLoginOtpAction/
  )
  assert.doesNotMatch(form, /const \[, verifyAction, verifyPending\]/)
  assert.match(
    form,
    /const state = hasLoginActionResult\(verifyState\) \? verifyState : requestState/
  )
  assert.match(form, /state\.errors\?\.form/)
  assert.match(form, /state\.errors\?\.otp/)
  assert.match(form, /state\.message/)
  assert.match(form, /value=\{contact\}/)
})
