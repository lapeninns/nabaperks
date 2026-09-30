import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

function read(...segments) {
  return readFileSync(path.join(root, ...segments), "utf8")
}

const customer = (name) => read("components", "customer", name)

test("Given a phone code step When a new code is offered Then it waits visibly, as the email steps do, and the countdown is never a live region", () => {
  for (const [name, sentAt] of [
    [
      "join-otp-form.tsx",
      /phoneCodeResendAt\(\s*requestState\.fields\?\.phoneCodeSentAt \?\? phoneCodeSentAt\s*\)/,
    ],
    [
      "customer-login-phone-step.tsx",
      /phoneCodeResendAt\(state\.fields\?\.phoneCodeSentAt\)/,
    ],
    ["profile-add-phone.tsx", /phoneCodeResendAt\(state\.codeSentAt\)/],
  ]) {
    const source = customer(name)
    assert.match(source, sentAt, name)
    assert.match(source, /useOtpRetryCountdown\(/, name)
    assert.match(source, /\{sendNewCodeLabel\(resendCountdown\)\}/, name)
    // "Text me instead" waits with the resend.
    assert.match(
      source,
      /disabled=\{[^}]*(?:resendWaiting\(resendCountdown\)|waiting)[^}]*\}[\s\S]{0,120}OTP_TEXT_FALLBACK_LABEL/,
      name
    )
  }

  // The join code step: the wrapper of the ways out is not live; one status
  // line that stays mounted carries a resend's outcome.
  const joinOtp = customer("join-otp-form.tsx")
  assert.doesNotMatch(
    joinOtp,
    /<div className="grid gap-1 text-left" aria-live/
  )
  assert.match(
    joinOtp,
    /role="status"\s+aria-live="polite"[\s\S]{0,300}\{resendStatus \?\? ""\}/
  )
  // An expired code moves focus to the one way on.
  assert.match(
    joinOtp,
    /if \(needsFreshCode\) freshCodeLinkRef\.current\?\.focus\(\)/
  )
  assert.match(
    joinOtp,
    /<Link ref=\{freshCodeLinkRef\} href=\{phoneStepHref\}>/
  )

  const joinEmailOtp = customer("join-email-otp-form.tsx")
  assert.doesNotMatch(
    joinEmailOtp,
    /<div className="grid gap-1 text-left" aria-live/
  )
  assert.match(
    joinEmailOtp,
    /\{resendError \?\? delayedNotice \?\? resendMessage \?\? ""\}/
  )

  // Sign-in by email: the address shows once (the support line), and the
  // wait reads as the same clock.
  const loginEmail = customer("customer-login-email-step.tsx")
  assert.doesNotMatch(
    loginEmail,
    /<span className="text-muted-foreground">Sent to <\/span>/
  )
  assert.match(loginEmail, /resendClock\(countdown\.remainingSeconds\)/)
  assert.doesNotMatch(loginEmail, /remainingSeconds\}s`/)
})

test("Given the redesigned guest screens When they are read Then the review's copy and structure fixes hold", () => {
  // Q2 leads with the guest's cards; Q3 speaks about the connection.
  const qrPage = read("app", "q", "[qrId]", "page.tsx")
  assert.match(
    qrPage,
    /<UnavailableRecoveryActions\s+primary="cards"\s+scanLabel="Scan a venue QR"/
  )
  const qrError = read("app", "q", "[qrId]", "error.tsx")
  assert.match(qrError, /title="We couldn't load this card"/)
  assert.match(qrError, /Check your signal or Wi-Fi, then try again\./)

  // R4: the brightness hint sits beside the code, from the copy source.
  const collectionQr = customer("reward-collection-qr.tsx")
  assert.match(collectionQr, /\{REWARD_CODE_BRIGHTNESS_HINT\}/)
  assert.match(
    read("lib", "customer", "experience", "copy.ts"),
    /REWARD_CODE_BRIGHTNESS_HINT =\s+"Turn your screen brightness up so staff can scan it\."/
  )

  // C: the shell says "Welcome to {Venue}"; the banner names the outcome.
  const card = customer("customer-card-experience.tsx")
  assert.doesNotMatch(card, /title=\{`Welcome to \$\{exp\.merchantName\}\.`\}/)
  assert.match(card, /title="Your first stamp is on your card\."/)
  // A reward held by setup never takes the ready ticket.
  assert.match(card, /cardRewardTicket\(exp\)/)

  // R5: collect, never redeem, on the guest receipt.
  const panels = customer("reward-panels.tsx")
  assert.match(panels, /eyebrow="Reward collected"/)
  assert.match(panels, /footerRight="COLLECTED"/)
  assert.doesNotMatch(panels, /footerRight="REDEEMED"/)

  // No em dashes in these guest strings, and no "no app" pitch.
  assert.doesNotMatch(
    customer("offer-pass-qr.tsx"),
    /signed out on this phone —/
  )
  assert.doesNotMatch(customer("invite-claim-panel.tsx"), /no app to download/)

  // J4 keeps to the email: no phone-verification policy on the fallback.
  assert.doesNotMatch(
    customer("join-wizard.tsx"),
    /This offer needs a mobile number/
  )

  // Principle 9: the step count shows only from the terms step.
  const wizard = customer("join-wizard.tsx")
  assert.match(
    wizard,
    /kind === "join_terms"\s+\? \{ step: ONBOARDING_STEPS, total: ONBOARDING_STEPS, label \}\s+: \{ label \}/
  )
  assert.match(
    customer("join-welcome-step.tsx"),
    /progress=\{\{ label: "Your card" \}\}/
  )

  // Reward names sit under their section's h2.
  const list = customer("reward-list-cards.tsx")
  assert.doesNotMatch(list, /<h2 /)
  assert.equal((list.match(/<h3 /g) ?? []).length, 3)
})

test("Given home's optional suggestions When the guest acts on them Then focus is kept and sign-in comes back home", () => {
  const prompt = customer("home-email-prompt.tsx")
  assert.match(
    prompt,
    /<WalletLinkNextStep\s+linked=\{state\.walletLinked\}\s+recovery=\{state\.recovery\}\s+returnTo="\/home"/
  )
  assert.doesNotMatch(prompt, /surface === "stamp_prompt"/)
  assert.match(prompt, /dismissSuggestion\("email"\)\s+onDismissed\?\.\(\)/)

  const slot = customer("home-setup-suggestion.tsx")
  assert.match(
    slot,
    /if \(dismissals > 0\) focusAfterDismissal\(slotRef\.current\)/
  )
  assert.match(slot, /dismissSuggestion\(kind\)\s+onDismissed\(\)/)

  // "Code sent" and the confirmation land in one status line that stays
  // mounted across the task's steps.
  const previous = customer("profile-previous-stamps-email.tsx")
  assert.equal((previous.match(/role="status"/g) ?? []).length, 1)
  assert.match(previous, /id="previous-stamps-email-status"/)
})

test("Given the harnesses When the review's missing states are asked for Then each has a lane", () => {
  const fixtures = read("app", "dev", "welcome-offer", "fixtures.ts")
  assert.match(fixtures, /"returning",\n\] as const/)
  assert.match(fixtures, /pendingChannel: channel,\s+primaryChannel: channel,/)
  assert.match(fixtures, /justJoined,/)
  const page = read("app", "dev", "welcome-offer", "page.tsx")
  assert.match(page, /channel: welcomeJoinChannel\(query\.channel\)/)
  assert.match(page, /query\.joined === "1"/)

  const modes = read("app", "dev", "home-harness", "stamp", "modes.ts")
  for (const mode of [
    "unmatched-missing",
    "unmatched-venue",
    "first-stamp-rescan",
    "first-stamp-retry",
    "first-stamp-venue",
  ]) {
    assert.match(modes, new RegExp(`"${mode}"`))
  }
  const stampPage = read("app", "dev", "home-harness", "stamp", "page.tsx")
  assert.match(stampPage, /if \(isStampHarnessCardMode\(requested\)\)/)
  // The lanes render inside the production-guarded page.
  assert.match(
    stampPage,
    /process\.env\.NODE_ENV === "production"\) notFound\(\)/
  )
})
