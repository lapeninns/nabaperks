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
  // One locked transaction decides and writes the attach (QA BUG-002,
  // BUG-013); the app makes no write of its own.
  assert.match(attach, /\.rpc\("attach_verified_customer_phone"/)
  assert.doesNotMatch(attach, /\.update\(|\.insert\(/)
  assert.match(attach, /case "contact_conflict":/)
  assert.match(attach, /case "wallet_unavailable":/)
  assert.match(attach, /customerPhonePii\(phone\.e164\)/)
  const migration = read(
    "supabase",
    "migrations",
    "20261009110000_atomic_customer_phone_attach.sql"
  )
  assert.match(migration, /for update;[\s\S]*'wallet_unavailable'/)
  assert.match(
    migration,
    /grant execute on function public\.attach_verified_customer_phone\([^)]*\)\s+to service_role;/
  )
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
  // Phone reminders sit inside "Messages from venues", only with a phone.
  assert.match(
    page,
    /<CustomerProfileMessagesSection[\s\S]{0,80}hasPhone=\{hasPhone\}/
  )
  const messages = read(
    "components",
    "customer",
    "profile-messages-section.tsx"
  )
  assert.match(messages, /\{hasPhone \? \([\s\S]{0,160}<PhoneMessagingSettings/)

  // Text and WhatsApp marketing need a verified phone (QA BUG-033). The
  // consent RPC accepts any channel, so the lib decides before calling it and
  // the action reports the refusal instead of claiming the change was saved.
  const profileActions = read(
    "app",
    "home",
    "(authed)",
    "profile",
    "actions.ts"
  )
  assert.match(
    profileActions,
    /refusal = await updateCustomerMarketingConsent\(\{ channel, optedIn \}\)[\s\S]{0,200}if \(refusal\) \{\s*return \{ channel, optedIn: !optedIn, refusal \}/
  )
  const consent = read("lib", "customer", "consent.ts")
  assert.match(consent, /customerHasVerifiedPhone\(customer\.id\)/)
  assert.match(
    consent,
    /const refusal = marketingConsentRefusal\([\s\S]{0,160}if \(refusal\) return refusal[\s\S]{0,120}record_customer_marketing_consent/
  )
})

test("Given email sign-in is switched off When an email-only wallet adds a phone Then the attach action stays open, deliberately and in writing", () => {
  const actions = read("app", "home", "(authed)", "profile", "phone-actions.ts")
  // The email sign-in actions all check the mode; this one is the documented
  // exception, because phone is how an email-only wallet gets back in once
  // email sign-in is off.
  assert.match(actions, /Deliberately not gated on CUSTOMER_EMAIL_AUTH_MODE/)
  // The mode only picks the words after a link (whether the email fallback
  // may be mentioned); it never decides whether a phone can be added.
  const modeReads = actions.match(/emailSignInEnabled\(/g) ?? []
  const copyReads =
    actions.match(/walletLinkedMessage\(emailSignInEnabled\(\)\)/g) ?? []
  assert.equal(modeReads.length, copyReads.length)
  assert.doesNotMatch(
    actions,
    /customerEmailAuthMode|emailWalletCreationEnabled/
  )
  const page = read("app", "home", "(authed)", "profile", "page.tsx")
  assert.doesNotMatch(
    page,
    /emailSignInEnabled\(\)\s*&&\s*<CustomerProfileAddPhone|emailSignInEnabled\(\)\s*\?\s*<CustomerProfileAddPhone/
  )
  // Every other gate still holds: a session, the attach purpose and the
  // wallet the code was sent for.
  assert.match(
    actions,
    /if \(!customer\) \{\s*return \{\s*step: "phone",[\s\S]{0,80}errors: \{ form: SIGN_IN_FIRST \}/
  )
})

test("Given the reward gate's phone step When the number is confirmed Then the reward route shows the confirmation it redirects back with", () => {
  const gate = read("components", "customer", "profile-gate-forms.tsx")
  const page = read("app", "reward", "[rewardId]", "page.tsx")
  const card = read("components", "customer", "customer-card-experience.tsx")
  const harness = read("app", "dev", "reward-collection", "page.tsx")

  // The form names the reward so the phone action redirects back to it.
  assert.match(
    gate,
    /action=\{rewardPhoneAction\}\s+returnTo=\{`\/reward\/\$\{rewardId\}`\}/
  )
  // The reward route reads `?contact=` and renders the shared notice.
  assert.match(page, /contact\?: string \| string\[\]/)
  assert.match(
    page,
    /<ProfileContactNotice\s+value=\{query\.contact\}\s+confirmed=\{confirmedContacts\(/
  )
  // The flag alone is not proof: the notice shows only when the gate the
  // server read backs it (a confirmed phone, a locked email).
  assert.match(
    page,
    /phone: gate\.needsPhoneVerification !== true,\s+email: gate\.emailLocked,/
  )
  assert.match(card, /notice\?: ReactNode/)
  assert.match(card, /\{notice\}\s+<ExperiencePanel/)
  // The DB-free harness keeps a lane for the notice.
  assert.match(
    harness,
    /<ProfileContactNotice\s+value=\{params\.contact\}[\s\S]{0,200}confirmed=\{\{\s+phone: profileGate\.needsPhoneVerification !== true,/
  )
})
