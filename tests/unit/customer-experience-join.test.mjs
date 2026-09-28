import assert from "node:assert/strict"
import { test } from "node:test"

import { deriveCustomerExperience } from "@/lib/customer/experience/derive"
import {
  getCustomerExperienceViewModel,
  JOIN_WELCOME_EMAIL_REASSURANCE,
  JOIN_WELCOME_PHONE_REASSURANCE,
  joinCompletionHint,
} from "@/lib/customer/experience/copy"

const merchant = {
  name: "The Old Crown",
  slug: "old-crown",
  termsUrl: "/terms",
}
const card = {
  name: "Regulars Card",
  stampsRequired: 5,
  rewardTerms: "House terms",
}
const location = { requireGeofence: false, geofenceRadiusMeters: 150 }

function context(overrides = {}) {
  return {
    merchant,
    card,
    hasSession: false,
    pendingOtp: false,
    membership: null,
    location,
    ...overrides,
  }
}

test("a QR welcome leads with value and keeps progress linked to the number", () => {
  const experience = deriveCustomerExperience({
    entry: "join",
    context: context({ qrId: "venue-qr" }),
  })
  const viewModel = getCustomerExperienceViewModel(experience)

  assert.equal(experience.kind, "join_welcome")
  assert.equal(viewModel.headline, "Your first stamp is ready")
  assert.match(viewModel.supportLine, /^Save it to your number/)
  assert.match(viewModel.supportLine, /No app, no password/)
  assert.equal(viewModel.primaryAction?.label, "Claim my first stamp")
})

test("join completion copy keeps the promise without overstating QR proof or leaking policy", () => {
  assert.match(joinCompletionHint({ hasQr: true }), /stamp and card stay saved/)
  assert.match(
    joinCompletionHint({ hasQr: false }),
    /ready for your first visit/
  )
  for (const hasQr of [true, false]) {
    assert.doesNotMatch(joinCompletionHint({ hasQr }), /location|business day/i)
  }
})

test("a direct verified join uses honest save-card copy", () => {
  const experience = deriveCustomerExperience({
    entry: "join",
    context: context({ hasSession: true }),
  })
  assert.equal(experience.kind, "join_terms")
  assert.equal(
    getCustomerExperienceViewModel(experience).headline,
    "Save your loyalty card"
  )
})

test("a QR verified join keeps first-stamp copy", () => {
  const experience = deriveCustomerExperience({
    entry: "join",
    context: context({ hasSession: true, qrId: "venue-qr" }),
  })
  assert.equal(experience.kind, "join_terms")
  assert.equal(
    getCustomerExperienceViewModel(experience).headline,
    "Collect your first stamp"
  )
})

function join(overrides) {
  return deriveCustomerExperience({
    entry: "join",
    context: context(overrides),
  })
}

test("with email sign-in off the join page is phone only, whatever the step asks", () => {
  for (const step of [undefined, "email", "phone"]) {
    const experience = join({ step })
    assert.equal(experience.kind, "join_phone")
    assert.equal("emailMode" in experience, false)
  }
  const welcome = join({ qrId: "venue-qr" })
  assert.equal(welcome.kind, "join_welcome")
  assert.match(
    getCustomerExperienceViewModel(welcome).primaryAction.href,
    /step=phone$/
  )
})

test("phone is the contact step in every mode, and the welcome CTA always opens it", () => {
  for (const emailMode of ["off", "existing", "full"]) {
    assert.equal(join({ emailMode }).kind, "join_phone", emailMode)
    assert.equal(join({ emailMode, step: "phone" }).kind, "join_phone")

    const welcome = join({ emailMode, qrId: "venue-qr" })
    assert.equal(welcome.kind, "join_welcome")
    assert.deepEqual(Object.keys(welcome).sort(), [
      "card",
      "emailSignIn",
      "kind",
      "merchant",
      "qrId",
    ])
    const viewModel = getCustomerExperienceViewModel(welcome)
    assert.match(viewModel.primaryAction.href, /step=phone$/)
    assert.match(viewModel.supportLine, /^Save it to your number/)
  }
})

test("the email step exists only as the fallback address, and never while email is off", () => {
  for (const emailMode of ["existing", "full"]) {
    const email = join({ emailMode, step: "email", emailFallbackOpen: true })
    assert.equal(email.kind, "join_email")
    assert.equal(email.emailMode, emailMode)
    const viewModel = getCustomerExperienceViewModel(email)
    assert.equal(viewModel.headline, "Get your code by email instead")
    assert.doesNotMatch(viewModel.headline, /!/)
  }
  assert.equal(
    join({ emailMode: "off", step: "email", emailFallbackOpen: true }).kind,
    "join_phone"
  )
})

test("a step=email the server has not opened is the phone step, not the email form", () => {
  for (const emailMode of ["existing", "full"]) {
    assert.equal(join({ emailMode, step: "email" }).kind, "join_phone")
    assert.equal(
      join({ emailMode, step: "email", emailFallbackOpen: false }).kind,
      "join_phone"
    )
    // Still an explicit contact step: never the QR welcome instead.
    assert.equal(
      join({ emailMode, qrId: "venue-qr", step: "email" }).kind,
      "join_phone"
    )
    // A phone code still pending outranks it: its code step.
    const code = join({
      emailMode,
      step: "email",
      pendingOtp: true,
      pendingPhone: "+447700900123",
      pendingPhoneEmailFallbackInSeconds: 20,
    })
    assert.equal(code.kind, "join_otp")
    assert.equal(code.contact.method, "phone")
  }
})

test("an explicit contact step skips the QR welcome", () => {
  assert.equal(
    join({
      emailMode: "full",
      qrId: "venue-qr",
      step: "email",
      emailFallbackOpen: true,
    }).kind,
    "join_email"
  )
  assert.equal(
    join({ emailMode: "full", qrId: "venue-qr", step: "phone" }).kind,
    "join_phone"
  )
})

test("a pending email code shows the code step with the masked address only", () => {
  const experience = join({
    emailMode: "full",
    pendingEmail: { maskedEmail: "j***@example.com", resendAvailableAt: 100 },
  })
  assert.equal(experience.kind, "join_otp")
  assert.deepEqual(experience.contact, {
    method: "email",
    maskedEmail: "j***@example.com",
    resendAvailableAt: 100,
    phoneCodePending: false,
  })
  assert.equal(
    getCustomerExperienceViewModel(experience).eyebrow,
    "Check your email"
  )
})

test("a pending email code whose send failed is never described as just sent", () => {
  const experience = join({
    emailMode: "full",
    pendingEmail: {
      maskedEmail: "j***@example.com",
      resendAvailableAt: 100,
      deliveryDelayed: true,
    },
  })
  assert.equal(experience.kind, "join_otp")
  assert.deepEqual(experience.contact, {
    method: "email",
    maskedEmail: "j***@example.com",
    resendAvailableAt: 100,
    deliveryDelayed: true,
    phoneCodePending: false,
  })
  const viewModel = getCustomerExperienceViewModel(experience)
  assert.equal(
    viewModel.supportLine,
    "If the email doesn't arrive, send a new code or use your phone."
  )
  assert.doesNotMatch(viewModel.supportLine, /just sent/)
})

test("a pending phone code keeps the phone contact on the code step", () => {
  const experience = join({
    pendingOtp: true,
    pendingPhone: "+447700900123",
    pendingChannel: "whatsapp",
    pendingPhoneEmailFallbackInSeconds: 30,
  })
  assert.deepEqual(experience.contact, {
    method: "phone",
    last4: "0123",
    channel: "whatsapp",
  })
})

test("a phone code step carries the server's seconds left before email, never while email is off", () => {
  const pendingPhone = {
    pendingOtp: true,
    pendingPhone: "+447700900123",
    pendingChannel: "sms",
    pendingPhoneEmailFallbackInSeconds: 12,
    pendingPhoneSentAt: 1_800_000_000,
  }
  for (const emailMode of ["existing", "full"]) {
    const experience = join({ ...pendingPhone, emailMode })
    assert.equal(experience.kind, "join_otp")
    assert.deepEqual(experience.contact, {
      method: "phone",
      last4: "0123",
      channel: "sms",
      emailFallbackInSeconds: 12,
      // A resend changes it, and the step restarts its wait.
      phoneCodeSentAt: 1_800_000_000,
    })
  }
  const off = join({ ...pendingPhone, emailMode: "off" })
  assert.equal("emailFallbackInSeconds" in off.contact, false)
  assert.equal("phoneCodeSentAt" in off.contact, false)
  // No send time known: no fallback rather than a guessed one.
  const unknown = join({
    ...pendingPhone,
    pendingPhoneEmailFallbackInSeconds: undefined,
    emailMode: "full",
  })
  assert.equal("emailFallbackInSeconds" in unknown.contact, false)
})

test("the email fallback's phone link knows whether a phone code is still pending", () => {
  const open = { step: "email", emailFallbackOpen: true }
  assert.equal(
    join({ emailMode: "full", ...open, phoneCodePending: true })
      .phoneCodePending,
    true
  )
  assert.equal(join({ emailMode: "existing", ...open }).phoneCodePending, false)
})

test("the email code step's phone link knows whether a phone code is still pending", () => {
  const pendingEmail = {
    maskedEmail: "j***@example.com",
    resendAvailableAt: 100,
    deliveryDelayed: true,
  }
  assert.equal(
    join({ emailMode: "full", pendingEmail, phoneCodePending: true }).contact
      .phoneCodePending,
    true
  )
  assert.equal(
    join({ emailMode: "full", pendingEmail }).contact.phoneCodePending,
    false
  )
})

test("a failed phone send may offer email only while email sign-in is on", () => {
  assert.equal(join({ emailMode: "off" }).emailSignIn, false)
  assert.equal(join({}).emailSignIn, false)
  assert.equal(join({ emailMode: "existing" }).emailSignIn, true)
  assert.equal(join({ emailMode: "full" }).emailSignIn, true)
})

test("the welcome note tells an email-joined customer where email is, only while it is on", () => {
  assert.equal(join({ qrId: "venue-qr" }).emailSignIn, false)
  assert.equal(join({ qrId: "venue-qr", emailMode: "full" }).emailSignIn, true)
  assert.match(JOIN_WELCOME_EMAIL_REASSURANCE, /Joined by email\?/)
  assert.match(JOIN_WELCOME_EMAIL_REASSURANCE, /after 30 seconds\./)
  assert.doesNotMatch(JOIN_WELCOME_EMAIL_REASSURANCE, /!/)
  assert.doesNotMatch(JOIN_WELCOME_PHONE_REASSURANCE, /email/i)
})

test("the email step's eyebrow names no channel, since the code may have gone by WhatsApp", () => {
  const viewModel = getCustomerExperienceViewModel(
    join({ emailMode: "full", step: "email", emailFallbackOpen: true })
  )
  assert.equal(viewModel.eyebrow, "No code yet?")
  assert.doesNotMatch(viewModel.eyebrow, /text|sms|whatsapp/i)
})

test("a verified email with no wallet shows the choice, and only mode full may create", () => {
  const full = join({
    emailMode: "full",
    emailHandoff: { maskedEmail: "j***@example.com" },
    pendingEmail: { maskedEmail: "j***@example.com", resendAvailableAt: 1 },
  })
  assert.equal(full.kind, "join_email_choice")
  assert.equal(full.canCreate, true)
  assert.equal(full.maskedEmail, "j***@example.com")
  assert.equal(
    getCustomerExperienceViewModel(full).headline,
    "Have you collected stamps with Nabaperks before?"
  )

  const existing = join({
    emailMode: "existing",
    emailHandoff: { maskedEmail: "j***@example.com" },
  })
  assert.equal(existing.canCreate, false)
})

test("a signed-in customer outranks any email handoff and the terms step knows their channels", () => {
  const experience = join({
    emailMode: "full",
    hasSession: true,
    emailHandoff: { maskedEmail: "j***@example.com" },
    customerChannels: { phone: false, email: true },
  })
  assert.equal(experience.kind, "join_terms")
  assert.deepEqual(experience.contactChannels, { phone: false, email: true })
})

test("a contact step carries the configured first channel", () => {
  assert.equal(join({ emailMode: "full" }).channel, "whatsapp")
  assert.equal(
    join({ emailMode: "full", primaryChannel: "sms" }).channel,
    "sms"
  )
})

test("in mode existing the choice screen says no wallet uses the email and offers phone only", () => {
  const existing = join({
    emailMode: "existing",
    emailHandoff: { maskedEmail: "j***@example.com" },
  })
  const viewModel = getCustomerExperienceViewModel(existing)
  assert.equal(viewModel.headline, "No wallet uses this email yet")
  assert.match(viewModel.supportLine, /^Use the phone number you joined with/)
})

test("join copy stays true for a wallet joined by email", () => {
  assert.equal(
    joinCompletionHint({ hasQr: true, savedTo: "email" }),
    "Your stamp and card stay saved to your email."
  )
  assert.equal(
    joinCompletionHint({ hasQr: false, savedTo: "email" }),
    "Your card is saved to your email, ready for your first visit."
  )
  // Phone wallets keep the original wording.
  assert.equal(
    joinCompletionHint({ hasQr: true }),
    "Your stamp and card stay saved to this number."
  )

  const returning = join({
    emailMode: "full",
    hasSession: true,
    membership: { id: "membership-1", current: 2 },
  })
  assert.equal(returning.kind, "join_returning")
  assert.doesNotMatch(
    getCustomerExperienceViewModel(returning).supportLine,
    /number/
  )
  assert.doesNotMatch(JOIN_WELCOME_PHONE_REASSURANCE, /number/)
})
