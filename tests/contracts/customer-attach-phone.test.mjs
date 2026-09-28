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

test("Given an email-only wallet adds a phone When the code is sent Then it uses the attach admission scope the database accepts", () => {
  const actions = read("app", "home", "(authed)", "profile", "phone-actions.ts")
  const core = read("lib", "customer", "otp-rate-limit-core.ts")
  const migration = read(
    "supabase",
    "migrations",
    "20261006100600_otp_dispatch_attach_scope.sql"
  )
  assert.match(actions, /^"use server"/)
  assert.match(actions, /scope: "attach"/)
  assert.match(actions, /purpose: "attach"/)
  assert.match(actions, /customerId: customer\.id/)
  assert.match(
    core,
    /export type CustomerOtpDispatchScope = "wallet" \| "join" \| "attach"/
  )
  assert.match(migration, /p_scope not in \('wallet', 'join', 'attach'\)/)
})

test("Given the attach code When it is checked Then it must be an attach code bound to the signed-in wallet", () => {
  const actions = read("app", "home", "(authed)", "profile", "phone-actions.ts")
  const verify = actions.slice(
    actions.indexOf("async function verifyAttachPhone")
  )
  assert.match(verify, /pending\.purpose !== "attach"/)
  assert.match(verify, /pending\.customerId !== customer\.id/)
  assert.ok(
    verify.indexOf("pending.customerId !== customer.id") <
      verify.indexOf("checkAttachCode(")
  )
  assert.ok(
    verify.indexOf("checkAttachCode(") <
      verify.indexOf("attachVerifiedPhoneToCustomer(")
  )
  // A code for joining or wallet sign-in never adds a phone, and neither
  // parser branch accepts an attach cookie without its wallet.
  const cookie = read("lib", "customer", "session-cookie-core.ts")
  assert.match(
    cookie,
    /export type PendingPhonePurpose = "join" \| "wallet" \| "attach"/
  )
  assert.match(
    cookie,
    /if \(purpose === "attach"\) \{\s*if \(typeof customerId !== "string" \|\| !customerId\) return null/
  )
  for (const file of [
    ["app", "home", "actions.ts"],
    ["app", "m", "[merchantSlug]", "join", "actions.ts"],
  ]) {
    assert.doesNotMatch(read(...file), /purpose === "attach"|purpose: "attach"/)
  }
})

test("Given a verified phone When it is attached Then it never overwrites a phone and another wallet's phone is a conflict", () => {
  const identity = read("lib", "customer", "identity.ts")
  const attach = identity.slice(
    identity.indexOf("export async function attachVerifiedPhoneToCustomer"),
    identity.indexOf("export function firstOf")
  )
  assert.match(attach, /findCustomerByVerifiedPhone\(phone\)/)
  assert.match(attach, /status: "contact_conflict"/)
  assert.match(attach, /\.is\("phone_verified_at", null\)/)
  assert.match(attach, /error\.code === UNIQUE_VIOLATION/)
  assert.match(attach, /customerPhonePii\(phone\.e164\)/)
  assert.match(
    attach,
    /after\(\(\) => attachRewardInvitesForCustomer\(customer\.id\)\)/
  )
  assert.doesNotMatch(attach, /phone: phone\.e164|\bphone:\s*pii/)

  const actions = read("app", "home", "(authed)", "profile", "phone-actions.ts")
  assert.match(actions, /eventName: "customer_contact_conflict"/)
  assert.match(actions, /reason: "phone_in_use"/)
  assert.doesNotMatch(actions, /setCustomerSession\(/)
})

test("Given the profile When the wallet has no phone Then it offers to add one and no phone-only settings", () => {
  const page = read("app", "home", "(authed)", "profile", "page.tsx")
  // Mounted for every wallet so the "added" confirmation survives the
  // re-render that follows it; the form hides itself once a phone is held.
  assert.match(
    page,
    /addPhone=\{<CustomerProfileAddPhone hasPhone=\{hasPhone\} \/>\}/
  )
  const addPhone = read("components", "customer", "profile-add-phone.tsx")
  assert.match(
    addPhone,
    /if \(hasPhone && state\.step !== "attached"\) return null/
  )
  assert.match(page, /hasPhone=\{hasPhone\}/)
  assert.match(page, /\{hasPhone \? \(\s*<PhoneMessagingSettings/)

  // Text and WhatsApp marketing need a phone, in the action and at the lib
  // boundary, because the consent RPC accepts any channel.
  const profileActions = read(
    "app",
    "home",
    "(authed)",
    "profile",
    "actions.ts"
  )
  assert.match(
    profileActions,
    /optedIn && PHONE_MARKETING_CHANNELS\.has\(channel\)[\s\S]{0,160}customer\?\.phoneLast4/
  )
  const consent = read("lib", "customer", "consent.ts")
  assert.match(
    consent,
    /optedIn &&\s*PHONE_MARKETING_CHANNELS\.has\(channel\) &&\s*!customer\.phoneLast4/
  )
})

test("Given email sign-in is switched off When an email-only wallet adds a phone Then the attach action stays open, deliberately and in writing", () => {
  const actions = read("app", "home", "(authed)", "profile", "phone-actions.ts")
  // The email sign-in actions all check the mode; this one is the documented
  // exception, because phone is how an email-only wallet gets back in once
  // email sign-in is off.
  assert.match(actions, /Deliberately not gated on CUSTOMER_EMAIL_AUTH_MODE/)
  assert.doesNotMatch(actions, /email-auth-mode|emailSignInEnabled\(/)
  const page = read("app", "home", "(authed)", "profile", "page.tsx")
  assert.doesNotMatch(
    page,
    /emailSignInEnabled\(\)\s*&&\s*<CustomerProfileAddPhone|emailSignInEnabled\(\)\s*\?\s*<CustomerProfileAddPhone/
  )
  // Every other gate still holds: a session, the attach purpose and the
  // wallet the code was sent for.
  assert.match(
    actions,
    /if \(!customer\) return \{ step: "phone", errors: \{ form: SIGN_IN_FIRST \} \}/
  )
})
