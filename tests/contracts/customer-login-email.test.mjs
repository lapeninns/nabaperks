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
  // A failed lookup or session after a matched code keeps that code usable.
  assert.match(source, /await keepEmailSignInForRetry\(verified\)/)
  // The same scan step as a phone with no cards (#387), not another code.
  assert.match(
    verify.body,
    /if \(!customer\) \{[\s\S]*?fields: \{ method: "email", email, noCards: true \}/
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
})

test("Given any email mode When /home/login opens Then phone leads and email is only the phone code step's fallback", () => {
  const form = read("components", "customer", "customer-login-form.tsx")
  // Phone until the customer has picked email from the fallback.
  assert.match(form, /\(state\.fields\?\.method \?\? "phone"\)/)
  assert.doesNotMatch(form, /ContactMethodOrder|defaultMethod/)
  assert.match(
    form,
    /codeAlternate=\{emailSwitch\(PHONE_CODE_EMAIL_FALLBACK_LABEL\)\}/
  )

  const phone = read("components", "customer", "customer-login-phone-step.tsx")
  // Beside the number, email appears only after a send that failed outright.
  const request = phone.slice(phone.indexOf("function PhoneRequestStep("))
  assert.doesNotMatch(request, /codeAlternate|scanAlternate|\balternate\b/)
  assert.match(
    request,
    /!editingContact && state\.fields\?\.phoneSendFailed\s*\? sendFailedAlternate\s*: null/
  )
  assert.match(
    form,
    /sendFailedAlternate=\{emailSwitch\("Use my email instead"\)\}/
  )
  // The code step counts down the server's seconds left, not a device-clock
  // deadline.
  const code = phone.slice(
    phone.indexOf("function PhoneCodeStep("),
    phone.indexOf("function PhoneRequestStep(")
  )
  // A new send time (a resend) remounts the countdown with the new wait.
  assert.match(
    code,
    /<CodeEmailFallback\s+key=\{state\.fields\?\.phoneCodeSentAt \?\? "code"\}\s+inSeconds=\{state\.fields\?\.emailFallbackInSeconds\}\s*>/
  )
  assert.doesNotMatch(code, /Date\.now/)
  assert.ok(
    code.indexOf("Wrong number? Use a different one") <
      code.indexOf("<CodeEmailFallback")
  )
  const countdown = phone.slice(phone.indexOf("function CodeEmailFallback("))
  assert.match(countdown, /useEmailFallbackReady\(inSeconds\)/)
  assert.match(countdown, /\{ready \? children : null\}/)

  // Every phone answer that keeps the code step carries the server's wait,
  // worked out from the pending code cookie's send time and the server clock.
  const actions = read("app", "home", "actions.ts")
  assert.match(
    actions,
    /\.\.\.phoneCodeStepTiming\(pending\.issuedAt, Date\.now\(\)\)/
  )
  assert.match(actions, /fields: loginPhoneCodeFields\(pendingCode\)/)
  const verify = actions.slice(
    actions.indexOf("export async function verifyCustomerLoginOtpAction(")
  )
  assert.match(verify, /const codeStep = loginPhoneCodeFields\(pending\)/)
  assert.doesNotMatch(verify, /otpSent: true/)
  assert.equal((verify.match(/fields: codeStep,/g) ?? []).length, 5)
  // Both send failures say so, so the number form can offer email.
  assert.equal(
    (actions.match(/fields: \{ contact, phoneSendFailed: true \}/g) ?? [])
      .length,
    2
  )

  // Taking the fallback keeps the phone code; leaving email returns to it.
  const emailActions = read("app", "home", "login", "email-actions.ts")
  const switchAction = emailActions.slice(
    emailActions.indexOf(
      "export async function switchCustomerLoginMethodAction("
    )
  )
  assert.doesNotMatch(switchAction, /clearPendingPhoneVerification/)
  assert.match(switchAction, /getPendingPhoneVerification\(\)/)
})

test("Given a wallet phone code is pending When /home/login is reloaded Then the page opens on its code step with the server's wait", () => {
  const page = read("app", "home", "login", "page.tsx")
  assert.match(page, /initialState=\{await pendingPhoneCodeStep\(\)\}/)
  const pending = page.slice(
    page.indexOf("async function pendingPhoneCodeStep(")
  )
  assert.match(pending, /await getPendingPhoneVerification\(\)/)
  assert.match(pending, /pending\?\.purpose !== "wallet"\) return \{\}/)
  assert.match(pending, /otpSent: true/)
  assert.match(
    pending,
    /\.\.\.phoneCodeStepTiming\(pending\.issuedAt, Date\.now\(\)\)/
  )
  const form = read("components", "customer", "customer-login-form.tsx")
  assert.match(form, /useActionState\(\s*loginAction,\s*initialState\s*\)/)
})

test("Given the email fallback record When the cookie notice is read Then it names the cookie and says what it holds", () => {
  const core = read("lib", "customer", "email-fallback-core.ts")
  assert.match(core, /EMAIL_FALLBACK_COOKIE_NAME = "nabaperks_email_fallback"/)
  assert.match(core, /EMAIL_FALLBACK_TTL_SECONDS = 10 \* 60/)
  const legal = read("lib", "legal", "content.ts")
  assert.match(
    legal,
    /nabaperks_email_fallback cookie lasts up to 10 minutes[^"]*not the number or the address/
  )
})
