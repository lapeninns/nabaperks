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

/** Every top-level function's name and body, exported or not. */
function allFunctions(source) {
  const starts = [...source.matchAll(/^(export )?(async )?function (\w+)/gm)]
  return starts.map((match, index) => ({
    name: match[3],
    body: source.slice(match.index, starts[index + 1]?.index ?? source.length),
  }))
}

test("Given the join email actions When they reach identity Then a wallet is created only in mode full, by the legacy choice or the disclosed code step", () => {
  const source = read(...EMAIL_ACTIONS)
  const functions = allFunctions(source)
  const creators = functions
    .filter((fn) => /createCustomerByVerifiedEmail\(/.test(fn.body))
    .map((fn) => fn.name)
    .sort()
  assert.deepEqual(creators, [
    "startEmailWalletAction",
    "startWalletFromVerifiedCode",
  ])
  // The code step reaches creation only behind the server-side mode check;
  // mode `existing` takes the no-card answer and creates nothing.
  const verify = functions.find(
    (fn) => fn.name === "verifyCustomerEmailOtpAction"
  )
  assert.match(
    verify.body,
    /emailWalletCreationEnabled\(\)\s*\?\s*startWalletFromVerifiedCode\([^)]*\)\s*:\s*noCardForVerifiedEmail\(/
  )
  const callers = functions
    .filter((fn) => /startWalletFromVerifiedCode\(/.test(fn.body))
    .map((fn) => fn.name)
    .filter((name) => name !== "startWalletFromVerifiedCode")
  assert.deepEqual(callers, ["verifyCustomerEmailOtpAction"])
  // Creating at the code step is the informed choice the published terms
  // describe only because the email step says so before the code is sent,
  // and only in mode `full`.
  const copy = read("lib", "customer", "experience", "copy.ts")
  assert.match(
    copy,
    /JOIN_EMAIL_NEW_CARD_DISCLOSURE =\s*"If no Nabaperks card uses this email yet, confirming the code starts one with it\."/
  )
  const wizard = read("components", "customer", "join-wizard.tsx")
  assert.match(
    wizard,
    /exp\.emailMode === "full" \? JOIN_EMAIL_NEW_CARD_DISCLOSURE : undefined/
  )
  const legal = read("lib", "legal", "content.ts")
  assert.match(legal, /after you choose to start one/)
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

test("Given public offer campaigns stay phone-only When an email-only wallet claims one Then only a live offer is refused with the reason", () => {
  const join = read("app", "m", "[merchantSlug]", "join", "actions.ts")
  const branch = join.slice(
    join.indexOf("async function claimOfferCampaignIfPresent"),
    join.indexOf("export async function joinRewardsAction")
  )
  // Checked before the claim, so a stale or ended link (also 'invalid' from
  // the claim) still falls through to an ordinary join.
  assert.ok(
    branch.indexOf("offerNeedsConfirmedPhone(") <
      branch.indexOf('supabase.rpc("claim_offer_campaign"')
  )
  assert.match(branch, /if \(!hasVerifiedPhone\) \{/)
  assert.doesNotMatch(branch, /status === "invalid" && !hasVerifiedPhone/)
  const gate = join.slice(
    join.indexOf("async function offerNeedsConfirmedPhone"),
    join.indexOf("async function claimOfferCampaignIfPresent")
  )
  assert.match(gate, /isOfferClaimAvailable\(claimTokenHash, merchantSlug\)/)
  assert.match(gate, /if \(!available\) return null/)
  assert.ok(
    gate.indexOf("await clearOfferCookie()") <
      gate.indexOf("This offer needs a confirmed phone number")
  )
  // A stored but unconfirmed number is not a confirmed phone (QA BUG-044).
  assert.match(branch, /await customerHasVerifiedPhone\(customerId\)/)
  assert.doesNotMatch(join, /customer\.phoneLast4 !== null/)

  const pendingOffer = read("lib", "customer", "pending-join-offer.ts")
  const available = pendingOffer.slice(
    pendingOffer.indexOf("export async function isOfferClaimAvailable")
  )
  assert.match(available, /"get_offer_claim_context"/)
  assert.match(available, /row\?\.claim_status === "available"/)
  assert.match(available, /row\.business_slug === merchantSlug/)
  assert.doesNotMatch(available, /claim_offer_campaign"/)
})

test("Given a phone code is requested on the join page When it is sent Then no email challenge or handoff is left to hide the code step", () => {
  const join = read("app", "m", "[merchantSlug]", "join", "actions.ts")
  const request = join.slice(
    join.indexOf("export async function requestCustomerIdentityAction"),
    join.indexOf("function logVerificationSendFailure")
  )
  assert.match(
    request,
    /await clearPendingEmailSignIn\(\)\s*await clearVerifiedEmailHandoff\(\)/
  )

  // Signing in or out drops both signed-out email cookies too.
  const session = read("lib", "customer", "session.ts")
  for (const fn of [
    "export async function setCustomerSession",
    "export async function clearAllCustomerSessions",
    "export async function clearCustomerSession",
  ]) {
    const body = session.slice(
      session.indexOf(fn),
      session.indexOf("\n}\n", session.indexOf(fn))
    )
    assert.match(body, /clearSignedOutEmailSignIn\(cookieStore\)/, fn)
  }
  assert.match(
    session,
    /cookieStore\.delete\(PENDING_EMAIL_SIGN_IN_COOKIE_NAME\)/
  )
  assert.match(
    session,
    /cookieStore\.delete\(VERIFIED_EMAIL_HANDOFF_COOKIE_NAME\)/
  )

  // And the loader follows whichever challenge was started last.
  const loader = read("lib", "customer", "experience", "load-join.ts")
  assert.match(loader, /newestSignedOutJoinChallenge\(/)
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
  const confirmed = read("components", "customer", "join-email-confirmed.tsx")
  const otp = read("components", "customer", "join-email-otp-form.tsx")
  const copy = read("lib", "customer", "experience", "copy.ts")

  // J4: one field, one button, and the way back to the phone code.
  assert.match(forms, /type="email"/)
  assert.match(forms, /autoComplete="email"/)
  assert.match(forms, /"Send code by email"/)
  assert.match(
    copy,
    /JOIN_EMAIL_WIFI_HINT =\s*"Useful when there's no mobile signal\. Works on the venue's Wi-Fi\."/
  )
  assert.match(copy, /JOIN_EMAIL_FALLBACK_HEADLINE = "Get your code by email"/)
  assert.doesNotMatch(forms, /wallet|verify your phone|older stamps/i)

  // No choice screen: the three competing actions and their copy are gone
  // (J7 and the owner rule "never ask the guest to repeat a decision").
  assert.doesNotMatch(forms, /CustomerEmailChoiceForm/)
  for (const source of [forms, confirmed, copy]) {
    assert.doesNotMatch(source, /Continue with email/)
    assert.doesNotMatch(source, /Open my existing wallet with my phone/)
    assert.doesNotMatch(source, /Continue with your email/)
    assert.doesNotMatch(source, /No wallet uses this email yet/)
  }
  assert.doesNotMatch(confirmed, /Use a different email/)
  // Each case has exactly one action: J7's way back to the phone, or the
  // legacy handoff's Continue (the phone appears only beside an error).
  assert.match(copy, /headline: "No card uses this email"/)
  assert.match(copy, /supportLine: "Join with your mobile number instead\."/)
  assert.match(
    confirmed,
    /if \(!canCreate\) return <div className="grid gap-4">\{phoneForm\(true\)\}<\/div>/
  )
  assert.match(confirmed, /action=\{switchJoinToPhoneAction\}/)
  assert.match(confirmed, /action=\{continueAction\}/)
  assert.match(
    confirmed,
    /\{state\.errors\?\.form \? phoneForm\(false\) : null\}/
  )

  // J5, the code step: shared code field, a countdown on the server's resend
  // time, then the quiet ways out in order.
  assert.match(otp, /CustomerOtpInput/)
  assert.match(otp, /useOtpRetryCountdown/)
  assert.match(otp, /name="resend" value="1"/)
  assert.doesNotMatch(otp, /name="email"/)
  const resend = otp.indexOf('"Send a new code"')
  const change = otp.indexOf("Change email")
  const back = otp.lastIndexOf("JOIN_EMAIL_BACK_TO_PHONE_CODE_LABEL")
  assert.ok(resend > 0 && resend < change && change < back)
  assert.match(
    copy,
    /JOIN_EMAIL_BACK_TO_PHONE_CODE_LABEL =\s*"Back to the text code"/
  )
  assert.match(otp, /JOIN_EMAIL_SPAM_HINT/)
  assert.match(
    copy,
    /JOIN_EMAIL_SPAM_HINT = "Not there\? Check spam or junk\."/
  )
  assert.match(otp, /SPAM_HINT_AFTER_MS = 30_000/)
})

test("Given any email mode When the contact step renders Then it is the phone form alone and email is only the code step's fallback", () => {
  const wizard = read("components", "customer", "join-wizard.tsx")
  const contact = wizard.slice(
    wizard.indexOf("function ContactStep("),
    wizard.indexOf("function PhoneStep(")
  )
  const phoneBranch = contact.slice(
    contact.indexOf('if (exp.kind === "join_phone")'),
    contact.indexOf("return (\n    <EmailStep")
  )
  assert.match(phoneBranch, /<PhoneStep/)
  assert.doesNotMatch(phoneBranch, /alternate=|email/i)
  // The email step, reached only from the fallback, keeps phone one tap away:
  // back to a phone code still pending, else the number form.
  assert.match(
    contact,
    /<EmailStep[\s\S]*exp\.phoneCodePending\s*\?\s*JOIN_EMAIL_BACK_TO_PHONE_CODE_LABEL\s*:\s*JOIN_USE_MOBILE_NUMBER_LABEL/
  )
  assert.match(contact, /step: exp\.phoneCodePending \? undefined : "phone"/)
  const loader = read("lib", "customer", "experience", "load-join.ts")
  assert.match(loader, /phoneCodePending: phoneCode !== null/)

  // The number form offers email only after a send that failed outright,
  // and only while email sign-in is on.
  const forms = read("components", "customer", "join-forms.tsx")
  assert.doesNotMatch(forms, /alternate/)
  assert.match(
    forms,
    /\{state\.fields\?\.phoneSendFailed && emailStepHref \? \(/
  )
  const phoneStep = wizard.slice(
    wizard.indexOf("function PhoneStep("),
    wizard.indexOf("function EmailStep(")
  )
  assert.match(phoneStep, /emailStepHref=\{\s*exp\.emailSignIn\s*\?/)
  const actions = read("app", "m", "[merchantSlug]", "join", "actions.ts")
  for (const reason of ["provider_unavailable", "pending_state_failed"]) {
    const failure = actions.slice(actions.indexOf(`"${reason}")`))
    assert.match(
      failure.slice(0, 300),
      /fields: \{ \.\.\.requestFields, phoneSendFailed: true \}/,
      reason
    )
    // The server records the failure too, so the email link it offers opens.
    assert.match(
      failure.slice(0, 300),
      /await openEmailFallback\("join", "phone_send_failed"\)/,
      reason
    )
  }

  // The welcome CTA always opens the phone step.
  const welcome = read("components", "customer", "join-welcome-step.tsx")
  assert.match(welcome, /step: "phone"/)
  assert.doesNotMatch(welcome, /step: "email"/)
  const copy = read("lib", "customer", "experience", "copy.ts")
  assert.doesNotMatch(copy, /step: exp\.contactStep|Save it with your email/)
  // Nor does the welcome mention email at all (J1).
  assert.doesNotMatch(welcome, /EMAIL|email/)
  assert.doesNotMatch(copy, /JOIN_WELCOME_EMAIL_REASSURANCE|Joined by email/)

  // The phone code step passes the server's fallback time and the email step
  // (keeping the QR and referral params) to the form.
  const otpStep = wizard.slice(wizard.indexOf("function OtpStep("))
  assert.match(
    otpStep,
    /emailFallbackInSeconds=\{exp\.contact\.emailFallbackInSeconds\}/
  )
  assert.match(
    otpStep,
    /emailStepHref=\{buildCustomerJoinHref\(exp\.merchant\.slug, \{\s*qrId: exp\.qrId,\s*referralCode,\s*step: "email",/
  )
})

test("Given a phone code was sent When the code step renders Then email appears 30 seconds after the server's send time, beside the phone recovery", () => {
  const fallback = read("lib", "customer", "phone-code-email-fallback.ts")
  assert.match(fallback, /PHONE_CODE_EMAIL_FALLBACK_DELAY_SECONDS = 30$/m)
  const derive = read("lib", "customer", "experience", "derive.ts")
  const phoneFallback = derive.slice(
    derive.indexOf("function phoneCodeFallback(")
  )
  // Email off: only the send time, which times "Send a new code"; no email.
  assert.match(
    phoneFallback,
    /joinEmailMode\(context\) === "off"\) return sentAt/
  )
  assert.match(
    phoneFallback,
    /emailFallbackInSeconds: context\.pendingPhoneEmailFallbackInSeconds/
  )
  // The server works out the seconds left from the pending code cookie's send
  // time (re-issued by every resend) and its own clock.
  const loader = read("lib", "customer", "experience", "load-join.ts")
  assert.match(
    loader,
    /pendingPhoneEmailFallbackInSeconds: phoneCodeEmailFallbackInSeconds\(\s*phoneCode\.issuedAt,\s*Date\.now\(\)\s*\)/
  )

  const phoneOtp = read("components", "customer", "join-otp-form.tsx")
  assert.match(phoneOtp, /useEmailFallbackReady\(inSeconds\)/)
  assert.match(phoneOtp, /PHONE_CODE_EMAIL_FALLBACK_LABEL/)
  // Added below the phone's own recovery, never in place of it.
  // J3 order: a new code, text instead, a different number, then email.
  let previous = -1
  for (const recovery of [
    "Send a new code",
    "{OTP_TEXT_FALLBACK_LABEL}",
    "Wrong number? Change it",
    "<EmailFallback",
  ]) {
    const at = phoneOtp.indexOf(recovery)
    assert.ok(at > previous, recovery)
    previous = at
  }
  // Before the server's wait ends: one calm line, never a ticking number.
  assert.match(phoneOtp, /PHONE_CODE_EMAIL_FALLBACK_PENDING/)
  const copy = read("lib", "customer", "experience", "copy.ts")
  assert.match(
    copy,
    /PHONE_CODE_EMAIL_FALLBACK_LABEL =\s*"No code\? Get one by email instead"/
  )
  assert.match(
    copy,
    /PHONE_CODE_EMAIL_FALLBACK_PENDING =\s*"If nothing arrives, more options appear shortly\."/
  )
  assert.match(copy, /JOIN_EMAIL_FALLBACK_HEADLINE = "Get your code by email"/)

  // The channel is not named: the code may have gone by WhatsApp.
  assert.match(copy, /eyebrow: "Your email"/)
  assert.doesNotMatch(copy, /No text yet/)

  // Hidden in the server render and on hydration, then the server's seconds
  // counted down from the mount. The device clock never takes part, so a
  // clock running ahead cannot offer email early.
  const hook = read("hooks", "use-email-fallback-ready.ts")
  assert.match(hook, /useState\(false\)/)
  assert.match(hook, /phoneCodeEmailFallbackWaitMs\(wait\)/)
  assert.doesNotMatch(hook, /Date\.now/)
  assert.doesNotMatch(fallback, /Date\.now/)
})

test("Given email is a fallback When the join and login screens load Then no device memory reorders the contact methods", () => {
  const legal = read("lib", "legal", "content.ts")
  const forget = path.join("hooks", "use-forget-legacy-contact-method.ts")
  for (const file of walk(path.join(projectRoot, "components"))
    .concat(walk(path.join(projectRoot, "lib")))
    .concat(walk(path.join(projectRoot, "app")))
    .concat(walk(path.join(projectRoot, "hooks")))) {
    // The privacy notice names the retired key only to say it is removed.
    if (file.endsWith(path.join("lib", "legal", "content.ts"))) continue
    if (file.endsWith(forget)) continue
    assert.doesNotMatch(
      readFileSync(file, "utf8"),
      /last-contact-method|ContactMethodOrder|rememberContactMethod/,
      path.relative(projectRoot, file)
    )
  }
  // The retired key is only ever removed, from both phone forms.
  const forgetSource = read(...forget.split(path.sep))
  assert.match(forgetSource, /"nabaperks\.last-contact-method"/)
  assert.match(
    forgetSource,
    /localStorage\.removeItem\(LEGACY_CONTACT_METHOD_KEY\)/
  )
  assert.doesNotMatch(forgetSource, /getItem|setItem/)
  for (const form of [
    read("components", "customer", "join-forms.tsx"),
    read("components", "customer", "customer-login-form.tsx"),
  ]) {
    assert.match(form, /useForgetLegacyContactMethod\(\)/)
  }

  const signIn = read("lib", "customer", "email-sign-in-core.ts")
  for (const cookie of [
    "nabaperks_pending_email_sign_in",
    "nabaperks_email_handoff",
  ]) {
    assert.match(signIn, new RegExp(`"${cookie}"`), `set as ${cookie}`)
    assert.match(legal, new RegExp(cookie), `disclosed: ${cookie}`)
  }
})
