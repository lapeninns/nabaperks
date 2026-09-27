import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)
const read = (...segments) =>
  readFileSync(path.join(projectRoot, ...segments), "utf8")
const LOGIN_EMAIL_ACTIONS = ["app", "home", "login", "email-actions.ts"]

/** Each exported function's name and body, up to the next top-level function. */
function exportedFunctions(source) {
  const starts = [...source.matchAll(/^(export )?(async )?function (\w+)/gm)]
  return starts
    .map((match, index) => ({
      exported: Boolean(match[1]),
      name: match[3],
      body: source.slice(
        match.index,
        starts[index + 1]?.index ?? source.length
      ),
    }))
    .filter((fn) => fn.exported)
}

test("Given the /home/login email actions When each export is read Then it checks the server-side mode before doing anything", () => {
  const source = read(...LOGIN_EMAIL_ACTIONS)
  assert.match(source, /^"use server"/)
  const functions = exportedFunctions(source)
  assert.deepEqual(functions.map((fn) => fn.name).sort(), [
    "editCustomerLoginEmailAction",
    "requestCustomerLoginEmailAction",
    "switchCustomerLoginMethodAction",
    "verifyCustomerLoginEmailAction",
  ])
  for (const fn of functions) {
    const gate = fn.body.indexOf("emailSignInEnabled()")
    assert.ok(gate > 0, `${fn.name} must check emailSignInEnabled()`)
    const firstAwait = fn.body.indexOf("await ")
    assert.ok(
      firstAwait === -1 || gate < firstAwait,
      `${fn.name} must check the mode before any awaited work`
    )
  }
})

test("Given /home/login When a verified email holds no wallet Then it never creates one and says so only after the code", () => {
  const source = read(...LOGIN_EMAIL_ACTIONS)
  assert.doesNotMatch(source, /createCustomerByVerifiedEmail/)
  assert.doesNotMatch(source, /emailWalletCreationEnabled/)
  assert.match(source, /purpose: "wallet"/)
  const verify = exportedFunctions(source).find(
    (fn) => fn.name === "verifyCustomerLoginEmailAction"
  )
  assert.ok(
    verify.body.indexOf("checkEmailSignInChallenge(") <
      verify.body.indexOf("findCustomerByVerifiedEmail(")
  )
  assert.match(
    source,
    /"No wallet uses this email yet\. Scan a venue QR to join, or sign in with your phone\."/
  )
  for (const name of [
    "customer_login_code_requested",
    "customer_login_verified",
    "customer_login_no_wallet",
  ]) {
    assert.match(
      source,
      new RegExp(`eventName: "${name}",[\\s\\S]*?method: "email"`),
      name
    )
  }
})

test("Given the login dispatcher When an email intent arrives Then it routes to the email actions and the phone actions stay phone-only", () => {
  const dispatcher = read("app", "home", "login", "otp-action.ts")
  for (const intent of [
    "email-request",
    "email-verify",
    "email-edit",
    "switch-method",
  ]) {
    assert.match(dispatcher, new RegExp(`case "${intent}":`), intent)
  }
  const phone = read("app", "home", "actions.ts")
  assert.doesNotMatch(
    phone,
    /startEmailSignInChallenge|checkEmailSignInChallenge|findCustomerByVerifiedEmail/
  )
})

test("Given the login page When the form renders Then the mode comes from the server, never a client environment read", () => {
  const page = read("app", "home", "login", "page.tsx")
  const form = read("components", "customer", "customer-login-form.tsx")
  assert.match(page, /emailMode=\{customerEmailAuthMode\(\)\}/)
  assert.doesNotMatch(form, /process\.env/)
  assert.match(form, /<ContactMethodOrder/)
  assert.match(
    form,
    /defaultMethod=\{emailMode === "full" \? "email" : "phone"\}/
  )
})
