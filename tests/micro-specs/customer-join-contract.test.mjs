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

function between(source, start, end) {
  const from = source.indexOf(start)
  assert.notEqual(from, -1, `Missing ${start}`)
  const to = end ? source.indexOf(end, from) : source.length
  assert.notEqual(to, -1, `Missing ${end}`)
  return source.slice(from, to)
}

test("Given join server actions redirect with QR form state When source is inspected Then every QR query value is encoded", () => {
  const actions = readProjectFile(
    "app",
    "m",
    "[merchantSlug]",
    "join",
    "actions.ts"
  )
  const requestIdentity = between(
    actions,
    "export async function requestCustomerIdentityAction",
    "function logVerificationSendFailure"
  )
  const verifyOtp = between(
    actions,
    "export async function verifyCustomerOtpAction",
    "export async function joinRewardsAction"
  )
  const joinRewards = between(
    actions,
    "export async function joinRewardsAction",
    undefined
  )

  assert.match(requestIdentity, /redirect\([\s\S]*encodeURIComponent\(qrId\)/)
  assert.match(verifyOtp, /redirect\([\s\S]*encodeURIComponent\(qrId\)/)
  assert.match(joinRewards, /encodeURIComponent\(qrId\)[\s\S]*membership=existing/)
  assert.doesNotMatch(actions, /\?qr=\$\{qrId\}/)
  assert.doesNotMatch(actions, /\?qr=\$\{qrId\}&/)
})

test("Given the OTP phone-step fallback link When source is inspected Then the QR query value is encoded", () => {
  const otpForm = readProjectFile(
    "components",
    "customer",
    "join-otp-form.tsx"
  )

  assert.match(otpForm, /encodeURIComponent\(qrId\)/)
  assert.doesNotMatch(otpForm, /qr=\$\{qrId\}/)
})
