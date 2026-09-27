import assert from "node:assert/strict"
import { test } from "node:test"

import { deriveCustomerExperience } from "@/lib/customer/experience/derive"
import {
  getCustomerExperienceViewModel,
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
    assert.equal(experience.emailMode, "off")
    assert.equal(experience.defaultMethod, "phone")
  }
  const welcome = join({ qrId: "venue-qr" })
  assert.equal(welcome.kind, "join_welcome")
  assert.equal(welcome.contactStep, "phone")
  assert.match(
    getCustomerExperienceViewModel(welcome).primaryAction.href,
    /step=phone$/
  )
})

test("mode full leads with email and the welcome CTA opens the email step (D12)", () => {
  const experience = join({ emailMode: "full" })
  assert.equal(experience.kind, "join_email")
  assert.equal(experience.defaultMethod, "email")
  assert.equal(join({ emailMode: "full", step: "phone" }).kind, "join_phone")

  const welcome = join({ emailMode: "full", qrId: "venue-qr" })
  assert.equal(welcome.contactStep, "email")
  const viewModel = getCustomerExperienceViewModel(welcome)
  assert.match(viewModel.primaryAction.href, /step=email$/)
  assert.match(viewModel.supportLine, /^Save it with your email/)
})

test("mode existing keeps phone first and offers email only when asked", () => {
  const experience = join({ emailMode: "existing" })
  assert.equal(experience.kind, "join_phone")
  assert.equal(experience.emailMode, "existing")
  assert.equal(experience.defaultMethod, "phone")
  const email = join({ emailMode: "existing", step: "email" })
  assert.equal(email.kind, "join_email")
  assert.equal(email.defaultMethod, "phone")
})

test("an explicit contact step skips the QR welcome", () => {
  assert.equal(
    join({ emailMode: "full", qrId: "venue-qr", step: "email" }).kind,
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
  })
  assert.equal(
    getCustomerExperienceViewModel(experience).eyebrow,
    "Check your email"
  )
})

test("a pending phone code keeps the phone contact on the code step", () => {
  const experience = join({
    pendingOtp: true,
    pendingPhone: "+447700900123",
    pendingChannel: "whatsapp",
  })
  assert.deepEqual(experience.contact, {
    method: "phone",
    last4: "0123",
    channel: "whatsapp",
  })
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
