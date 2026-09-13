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

  assert.match(actions, /await startCustomerPhoneVerification\(\s*contact,?/)
  const requestStart = actions.indexOf(
    "export async function requestCustomerLoginOtpAction"
  )
  const verifyStart = actions.indexOf(
    "export async function verifyCustomerLoginOtpAction"
  )
  const requestBlock = actions.slice(requestStart, verifyStart)
  assert.doesNotMatch(requestBlock, /findCustomerByVerifiedPhone/)
  assert.doesNotMatch(requestBlock, /customerId:/)
  const unknownCustomerBlock = actions.slice(
    actions.indexOf("if (!customer)"),
    actions.indexOf('let access: "authenticated" | "recovery"')
  )
  assert.doesNotMatch(unknownCustomerBlock, /otpSent: true/)
  assert.match(
    actions,
    /const verification = await checkCustomerPhoneVerification\(contact, otp\)[\s\S]*findCustomerByVerifiedPhone[\s\S]*if \(!customer\)/
  )
  assert.match(actions, /await clearPendingPhoneVerification\(\)/)
  assert.match(actions, /No cards found for that number yet/)
})
