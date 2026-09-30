import assert from "node:assert/strict"
import { test } from "node:test"

import { deriveCustomerExperience } from "@/lib/customer/experience/derive"
import {
  getCustomerExperienceViewModel,
  JOIN_WELCOME_HOW_IT_WORKS,
  JOIN_WELCOME_PHONE_REASSURANCE,
  joinCompletionHint,
  joinMarketingOptInLabel,
  joinPhoneChannelNote,
  joinRewardRequirementLine,
  PHONE_CODE_EMAIL_FALLBACK_LABEL,
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
  assert.equal(viewModel.headline, "Get your first stamp")
  assert.equal(
    viewModel.supportLine,
    "A stamp card for The Old Crown. Join with your mobile number."
  )
  assert.equal(viewModel.primaryAction?.label, "Get my first stamp")
  // Guest journey J1: no speed promise and no email mention.
  assert.doesNotMatch(viewModel.supportLine, /seconds|No app|email/i)
  assert.deepEqual(JOIN_WELCOME_HOW_IT_WORKS, [
    "Enter your mobile number",
    "Type the code we send you",
    "Your first stamp goes on your card",
  ])
})

test("join completion copy keeps the promise without overstating QR proof or leaking policy", () => {
  assert.match(joinCompletionHint({ hasQr: true }), /card and stamps stay with/)
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
    "Join the card at The Old Crown"
  )
  assert.equal(
    getCustomerExperienceViewModel(experience).supportLine,
    "Agree to the card terms to save your card."
  )
})

test("a QR verified join keeps first-stamp copy", () => {
  const experience = deriveCustomerExperience({
    entry: "join",
    context: context({ hasSession: true, qrId: "venue-qr" }),
  })
  assert.equal(experience.kind, "join_terms")
  assert.equal(
    getCustomerExperienceViewModel(experience).supportLine,
    "Agree to the card terms to add your first stamp."
  )
  // No false step count or speed promise (J6).
  assert.doesNotMatch(
    JSON.stringify(getCustomerExperienceViewModel(experience)),
    /Last step|One tick|the moment you accept/
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
    // The welcome knows nothing of the email mode: email is never mentioned.
    assert.deepEqual(Object.keys(welcome).sort(), [
      "card",
      "kind",
      "merchant",
      "qrId",
    ])
    const viewModel = getCustomerExperienceViewModel(welcome)
    assert.match(viewModel.primaryAction.href, /step=phone$/)
    assert.doesNotMatch(JSON.stringify(viewModel), /email/i)
  }
})

test("the email step exists only as the fallback address, and never while email is off", () => {
  for (const emailMode of ["existing", "full"]) {
    const email = join({ emailMode, step: "email", emailFallbackOpen: true })
    assert.equal(email.kind, "join_email")
    assert.equal(email.emailMode, emailMode)
    const viewModel = getCustomerExperienceViewModel(email)
    assert.equal(viewModel.headline, "Get your code by email")
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
  assert.equal(
    getCustomerExperienceViewModel(experience).supportLine,
    "Sent to j***@example.com."
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
    "We couldn't email j***@example.com yet. Send a new code, or go back to the text code."
  )
  assert.doesNotMatch(viewModel.supportLine, /^Sent to/)
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
    maskedNumber: "07•••• ••123",
    channel: "whatsapp",
  })
  // J3: the real channel and the masked number, never the full number, in
  // the same form sign-in shows.
  assert.equal(
    getCustomerExperienceViewModel(experience).supportLine,
    "Sent by WhatsApp to 07•••• ••123."
  )
  assert.equal(
    getCustomerExperienceViewModel(join({ ...pendingByText() })).supportLine,
    "Sent by text to 07•••• ••123."
  )
})

function pendingByText() {
  return {
    pendingOtp: true,
    pendingPhone: "+447700900123",
    pendingChannel: "sms",
  }
}

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
      maskedNumber: "07•••• ••123",
      channel: "sms",
      emailFallbackInSeconds: 12,
      // A resend changes it, and the step restarts its wait.
      phoneCodeSentAt: 1_800_000_000,
    })
  }
  const off = join({ ...pendingPhone, emailMode: "off" })
  assert.equal("emailFallbackInSeconds" in off.contact, false)
  // The send time still times "Send a new code" when email is off.
  assert.equal(off.contact.phoneCodeSentAt, 1_800_000_000)
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

test("the welcome note sends returning guests to their number and never mentions email", () => {
  assert.equal(
    JOIN_WELCOME_PHONE_REASSURANCE,
    "Been here before? Use the same mobile number and your card opens."
  )
  assert.doesNotMatch(JOIN_WELCOME_PHONE_REASSURANCE, /email|30 seconds|!/i)
})

test("the email step's eyebrow names no channel, since the code may have gone by WhatsApp", () => {
  const viewModel = getCustomerExperienceViewModel(
    join({ emailMode: "full", step: "email", emailFallbackOpen: true })
  )
  assert.equal(viewModel.eyebrow, "Your email")
  assert.doesNotMatch(viewModel.eyebrow, /text|sms|whatsapp/i)
  assert.equal(
    viewModel.supportLine,
    "Useful when there's no mobile signal. Works on the venue's Wi-Fi."
  )
})

test("a confirmed-email handoff is a single action, never a choice of email again", () => {
  const full = join({
    emailMode: "full",
    emailHandoff: { maskedEmail: "j***@example.com" },
    pendingEmail: { maskedEmail: "j***@example.com", resendAvailableAt: 1 },
  })
  assert.equal(full.kind, "join_email_choice")
  assert.equal(full.canCreate, true)
  assert.equal(full.maskedEmail, "j***@example.com")
  // Only a handoff left by the previous build lands here in mode full.
  assert.equal(getCustomerExperienceViewModel(full).headline, "Email confirmed")
  assert.doesNotMatch(
    JSON.stringify(getCustomerExperienceViewModel(full)),
    /wallet|Continue with your email/i
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

test("in mode existing a new email is an honest dead end back to the mobile number (J7)", () => {
  const existing = join({
    emailMode: "existing",
    emailHandoff: { maskedEmail: "j***@example.com" },
  })
  const viewModel = getCustomerExperienceViewModel(existing)
  assert.equal(viewModel.headline, "No card uses this email")
  assert.equal(viewModel.supportLine, "Join with your mobile number instead.")
  assert.doesNotMatch(JSON.stringify(viewModel), /wallet/i)
})

test("join copy stays true for a wallet joined by email", () => {
  assert.equal(
    joinCompletionHint({ hasQr: true, savedTo: "email" }),
    "Your card and stamps stay with your email."
  )
  assert.equal(
    joinCompletionHint({ hasQr: false, savedTo: "email" }),
    "Your card stays with your email, ready for your first visit."
  )
  assert.equal(
    joinCompletionHint({ hasQr: true }),
    "Your card and stamps stay with your mobile number."
  )

  const returning = join({
    emailMode: "full",
    hasSession: true,
    membership: { id: "membership-1", current: 2 },
  })
  assert.equal(returning.kind, "join_returning")
  const returningView = getCustomerExperienceViewModel(returning)
  assert.equal(returningView.headline, "Welcome back")
  assert.equal(returningView.eyebrow, "2 of 5 stamps")
  assert.doesNotMatch(JSON.stringify(returningView), /number|wallet/)
})

test("a returning member who scanned the QR is offered today's stamp (J8)", () => {
  const returning = join({
    hasSession: true,
    qrId: "venue-qr",
    membership: { id: "membership-1", current: 2 },
  })
  assert.deepEqual(getCustomerExperienceViewModel(returning).primaryAction, {
    label: "Get today's stamp",
    href: "/card/membership-1/stamp?qr=venue-qr",
  })
})

test("an expired code sends the guest to the number step with a notice, and Change it keeps the number", () => {
  const expired = join({ step: "phone", notice: "code_expired" })
  assert.equal(expired.kind, "join_phone")
  assert.equal(expired.notice, "code_expired")
  assert.equal("prefillPhone" in expired, false)

  // "Wrong number? Change it": the loader passes the pending number only for
  // an explicit step=phone; it comes back in UK national form.
  const change = join({ step: "phone", pendingPhone: "+447700900123" })
  assert.equal(change.kind, "join_phone")
  assert.equal(change.prefillPhone, "07700 900123")
  assert.equal("notice" in change, false)

  // Not on a plain phone step, and never for a non-UK number.
  assert.equal("prefillPhone" in join({ pendingPhone: "+447700900123" }), false)
  assert.equal(
    "prefillPhone" in join({ step: "phone", pendingPhone: "+15555550123" }),
    false
  )
})

test("the terms step knows from the card data whether photo ID may be checked", () => {
  const plain = join({ hasSession: true, qrId: "venue-qr" })
  assert.equal(plain.rewardMayNeedPhotoId, false)

  const pooled = join({
    hasSession: true,
    card: {
      ...card,
      rewardPool: [
        { rewardName: "Cake", rewardTerms: "", requiresAgeCheck: false },
        { rewardName: "Wine", rewardTerms: "", requiresAgeCheck: true },
      ],
    },
  })
  assert.equal(pooled.rewardMayNeedPhotoId, true)

  const upgraded = join({
    hasSession: true,
    card: {
      ...card,
      collectionWindows: [
        {
          isodow: 5,
          startsAt: "17:00",
          endsAt: "19:00",
          upgrade: {
            rewardName: "Cocktail",
            rewardTerms: "",
            requiresAgeCheck: true,
          },
        },
      ],
    },
  })
  assert.equal(upgraded.rewardMayNeedPhotoId, true)

  assert.equal(
    joinRewardRequirementLine({ mayNeedPhotoId: false }),
    "Collecting a reward needs your name, date of birth and a confirmed phone number and email."
  )
  assert.match(
    joinRewardRequirementLine({ mayNeedPhotoId: true }),
    / Photo ID may be checked\.$/
  )
})

test("the optional marketing choice names only the channels consent is recorded on", () => {
  assert.equal(
    joinMarketingOptInLabel("Old Crown", { phone: true, email: false }),
    "Send me offers from Old Crown by WhatsApp or text"
  )
  assert.equal(
    joinMarketingOptInLabel("Old Crown", { phone: true, email: true }),
    "Send me offers from Old Crown by WhatsApp, text or email"
  )
  assert.equal(
    joinMarketingOptInLabel("Old Crown", { phone: false, email: true }),
    "Send me offers from Old Crown by email"
  )
  assert.equal(
    joinMarketingOptInLabel("Old Crown", { phone: false, email: false }),
    null,
    "no confirmed channel records consent, so no choice is offered"
  )
})

test("join guest copy keeps to plain words: no internal vocabulary, speed promises, exclamation marks or em dashes", () => {
  const surfaces = [
    join({ qrId: "venue-qr" }),
    join({}),
    join({ step: "phone", notice: "code_expired" }),
    join({ emailMode: "full", step: "email", emailFallbackOpen: true }),
    join({
      emailMode: "full",
      pendingEmail: { maskedEmail: "j***@example.com", resendAvailableAt: 1 },
    }),
    join(pendingByText()),
    join({ emailMode: "full", emailHandoff: { maskedEmail: "j***@e.com" } }),
    join({
      emailMode: "existing",
      emailHandoff: { maskedEmail: "j***@e.com" },
    }),
    join({ hasSession: true }),
    join({ hasSession: true, qrId: "venue-qr" }),
    join({ hasSession: true, membership: { id: "m-1", current: 1 } }),
  ]
  const copy = [
    ...surfaces.map((exp) =>
      JSON.stringify(getCustomerExperienceViewModel(exp))
    ),
    JOIN_WELCOME_PHONE_REASSURANCE,
    ...JOIN_WELCOME_HOW_IT_WORKS,
    joinPhoneChannelNote("whatsapp"),
    joinPhoneChannelNote("sms"),
    PHONE_CODE_EMAIL_FALLBACK_LABEL,
  ].join("\n")
  assert.doesNotMatch(
    copy,
    /wallet|verif|locked|linking|continuity|trading day|merchant scan|handoff/i
  )
  assert.doesNotMatch(copy, /seconds|instantly|One tick|No spam|the moment/i)
  assert.doesNotMatch(copy, /!|\u2014/)
})
