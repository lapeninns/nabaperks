import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)
const read = (...segments) =>
  readFileSync(path.join(projectRoot, ...segments), "utf8")
const EMAIL_ACTIONS = ["app", "m", "[merchantSlug]", "join", "email-actions.ts"]

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full)
  }
  return out
}

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

test("Given the join email actions When each export is read Then it checks the server-side mode before doing anything", () => {
  const source = read(...EMAIL_ACTIONS)
  assert.match(source, /^"use server"/)
  const functions = exportedFunctions(source)
  assert.deepEqual(functions.map((fn) => fn.name).sort(), [
    "requestCustomerEmailIdentityAction",
    "startEmailWalletAction",
    "switchJoinToPhoneAction",
    "verifyCustomerEmailOtpAction",
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
  const create = functions.find((fn) => fn.name === "startEmailWalletAction")
  assert.match(
    create.body,
    /!emailSignInEnabled\(\) \|\| !emailWalletCreationEnabled\(\)/
  )
  assert.ok(
    create.body.indexOf("emailWalletCreationEnabled()") <
      create.body.indexOf("createCustomerByVerifiedEmail(")
  )
})

test("Given the join email actions When they reach identity Then only the choice action creates a wallet", () => {
  const source = read(...EMAIL_ACTIONS)
  const functions = exportedFunctions(source)
  for (const fn of functions) {
    const creates = /createCustomerByVerifiedEmail\(/.test(fn.body)
    assert.equal(creates, fn.name === "startEmailWalletAction", fn.name)
  }
  // The pinned phone action file stays phone-only.
  const phone = read("app", "m", "[merchantSlug]", "join", "actions.ts")
  assert.doesNotMatch(
    phone,
    /startEmailSignInChallenge|findCustomerByVerifiedEmail/
  )
  assert.match(phone, /"Confirm your phone or email before joining\."/)
})

test("Given email lookups When identity is read Then only a verified email opens a wallet", () => {
  const identity = read("lib", "customer", "identity.ts")
  const find = identity.slice(
    identity.indexOf("export async function findCustomerByVerifiedEmail"),
    identity.indexOf("export async function createCustomerByVerifiedEmail")
  )
  assert.match(find, /\.eq\("email_hmac", customerEmailHmac\(email\)\)/)
  assert.match(find, /\.not\("email_verified_at", "is", null\)/)
})

test("Given email sign-in codes When the module is read Then send failures log a category, never the provider message", () => {
  const signIn = read("lib", "customer", "email-sign-in.ts")
  assert.match(signIn, /^import "server-only"/)
  assert.match(signIn, /category: sendFailureCategory\(error\)/)
  assert.doesNotMatch(signIn, /error\.message\s*[,}]/)
  assert.match(signIn, /admit_anonymous_customer_email_otp_send/)
  assert.match(signIn, /customer-email-otp:cooldown:\$\{email\}/)
  assert.match(signIn, /email-sign-in:consumed:\$\{pending\.challengeId\}/)
  // The dev code is the local-only one, never NODE_ENV alone.
  assert.match(signIn, /from "@\/lib\/customer\/dev-otp-core"/)
  assert.doesNotMatch(signIn, /NODE_ENV/)
})

test("Given the join email funnel events When the vocabulary is read Then each is registered and emitted", () => {
  const events = read("lib", "analytics", "events.ts")
  const funnel = read("lib", "customer", "join-funnel.ts")
  const actions = read(...EMAIL_ACTIONS)
  for (const name of [
    "join_email_requested",
    "join_email_no_wallet",
    "join_new_email_wallet_confirmed",
  ]) {
    assert.match(events, new RegExp(`"${name}"`), `events.ts: ${name}`)
    assert.match(funnel, new RegExp(`"${name}"`), `join-funnel.ts: ${name}`)
    assert.match(actions, new RegExp(`eventName: "${name}"`), `emit: ${name}`)
  }
  assert.match(actions, /eventName: "join_otp_verified"[\s\S]*?method: "email"/)
})

test("Given the new cookies When they are encrypted Then each has its own pending-cookie context", () => {
  const crypto = read("lib", "customer", "pending-cookie-crypto.ts")
  const core = read("lib", "customer", "email-sign-in-core.ts")
  assert.match(crypto, /"email-sign-in"/)
  assert.match(crypto, /"email-handoff"/)
  assert.match(core, /context: "email-sign-in"/)
  assert.match(core, /context: "email-handoff"/)
  assert.match(core, /nabaperks:customer-email-sign-in:v\$\{version\}/)
  assert.doesNotMatch(core, /^import "server-only"/m)
  assert.doesNotMatch(core, /from "(next\/|@\/lib\/supabase)/)
})

test("Given public offer campaigns stay phone-only When an email-only wallet claims one Then it is told why", () => {
  const join = read("app", "m", "[merchantSlug]", "join", "actions.ts")
  const branch = join.slice(
    join.indexOf("async function claimOfferCampaignIfPresent"),
    join.indexOf("export async function joinRewardsAction")
  )
  assert.match(branch, /status === "invalid" && !hasVerifiedPhone/)
  assert.match(branch, /This offer needs a confirmed phone number/)
  assert.ok(
    branch.indexOf("await clearOfferCookie()") <
      branch.indexOf('status === "invalid" && !hasVerifiedPhone')
  )
  assert.match(join, /customer\.phoneLast4 !== null/)
})

test("Given the join email modules When the app is scanned Then no client component imports the server-only sign-in module", () => {
  const offenders = ["app", "components"]
    .flatMap((dir) => walk(path.join(projectRoot, dir)))
    .filter((file) => {
      const source = readFileSync(file, "utf8")
      return (
        /^["']use client["']/.test(source) &&
        /@\/lib\/customer\/(email-sign-in|email-auth-mode)"/.test(source)
      )
    })
  assert.deepEqual(offenders, [])
})

test("Given the join email screens When they are read Then they carry the agreed copy and controls", () => {
  const forms = read("components", "customer", "join-email-forms.tsx")
  const otp = read("components", "customer", "join-email-otp-form.tsx")
  const copy = read("lib", "customer", "experience", "copy.ts")

  assert.match(forms, /type="email"/)
  assert.match(forms, /autoComplete="email"/)
  assert.match(forms, /OTP_SEND_LABEL/)
  assert.match(forms, /JOIN_EMAIL_WIFI_HINT/)
  assert.match(
    copy,
    /"Works over the venue's Wi-Fi, even with no mobile signal\."/
  )

  // The choice: the create button exists only when the server allows it, and
  // neither answer is styled as the expected one.
  const choice = forms.slice(
    forms.indexOf("export function CustomerEmailChoiceForm")
  )
  assert.match(choice, /\{canCreate \? \(\s*<form action=\{createAction\}/)
  assert.match(choice, /No, I&rsquo;m new here: start my wallet/)
  assert.match(choice, /Yes, with my phone number: use my phone/)
  assert.match(choice, /action=\{switchJoinToPhoneAction\}/)
  assert.equal((choice.match(/variant="outline"/g) ?? []).length, 2)
  assert.doesNotMatch(choice, /variant="default"/)

  // The code step: masked address, shared code field, a countdown on the
  // server's resend time, and both ways out.
  assert.match(otp, /Sent to /)
  assert.match(otp, /CustomerOtpInput/)
  assert.match(otp, /useOtpRetryCountdown/)
  assert.match(otp, /name="resend" value="1"/)
  assert.doesNotMatch(otp, /name="email"/)
  assert.match(otp, /Use a different email/)
  assert.match(otp, /Use my phone instead/)
  assert.match(otp, /JOIN_EMAIL_SPAM_HINT/)
  assert.match(otp, /SPAM_HINT_AFTER_MS = 30_000/)
})

test("Given email sign-in is off When the contact step renders Then it is the phone form alone", () => {
  const wizard = read("components", "customer", "join-wizard.tsx")
  const contact = wizard.slice(
    wizard.indexOf("function ContactStep("),
    wizard.indexOf("function contactExperiences(")
  )
  const offBranch = contact.slice(
    contact.indexOf('exp.emailMode === "off"'),
    contact.indexOf("const { phoneExp, emailExp }")
  )
  assert.match(offBranch, /<PhoneStep/)
  assert.doesNotMatch(offBranch, /alternate=|ContactMethodOrder/)
  // A requested method is never reordered, and an offer in progress leads
  // with phone because public offer claims need a confirmed phone.
  assert.ok(
    contact.indexOf("if (exp.methodRequested)") <
      contact.indexOf("<ContactMethodOrder")
  )
  assert.ok(
    contact.indexOf("if (pendingOffer) return phone") <
      contact.indexOf("<ContactMethodOrder")
  )
})

test("Given the device remembers its sign-in method When it is stored Then it is convenience only and disclosed", () => {
  const order = read("components", "customer", "contact-method-order.tsx")
  const legal = read("lib", "legal", "content.ts")
  const phoneOtp = read("components", "customer", "join-otp-form.tsx")
  const emailOtp = read("components", "customer", "join-email-otp-form.tsx")

  assert.match(order, /^"use client"/)
  assert.match(order, /"nabaperks\.last-contact-method"/)
  // The server snapshot is the mode default: no hydration mismatch.
  assert.match(
    order,
    /useSyncExternalStore\([\s\S]*?\(\) => serverDefault\s*\)/
  )
  assert.match(phoneOtp, /useRememberContactMethodOnVerify\("phone"/)
  assert.match(emailOtp, /useRememberContactMethodOnVerify\("email"/)

  assert.match(legal, /\(nabaperks\.last-contact-method\)/)
  const signIn = read("lib", "customer", "email-sign-in.ts")
  for (const cookie of [
    "nabaperks_pending_email_sign_in",
    "nabaperks_email_handoff",
  ]) {
    assert.match(signIn, new RegExp(`"${cookie}"`), `set as ${cookie}`)
    assert.match(legal, new RegExp(cookie), `disclosed: ${cookie}`)
  }
})
