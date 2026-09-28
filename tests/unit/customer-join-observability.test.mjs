import assert from "node:assert/strict"
import { test } from "node:test"

const {
  joinEntry,
  joinStepForExperienceKind,
  productEventJoinMetadata,
  postHogJoinMetadata,
} = await import("@/lib/customer/join-observability-contract")

test("Given QR and referral facts When entry is derived Then composition remains explicit", () => {
  assert.equal(joinEntry({ qrId: "qr", referralCode: "ref" }), "qr_referral")
  assert.equal(joinEntry({ qrId: "qr" }), "qr")
  assert.equal(joinEntry({ referralCode: "ref" }), "referral")
  assert.equal(joinEntry({}), "direct")
})

test("Given rendered join experience kinds When steps are derived Then query strings have no authority", () => {
  assert.equal(joinStepForExperienceKind("join_welcome"), "welcome")
  assert.equal(joinStepForExperienceKind("join_phone"), "phone")
  assert.equal(joinStepForExperienceKind("join_otp"), "otp")
  assert.equal(joinStepForExperienceKind("join_terms"), "terms")
  assert.equal(joinStepForExperienceKind("join_returning"), "card")
  assert.equal(joinStepForExperienceKind("unavailable"), null)
})

test("Given a join milestone When metadata projections are built Then first-party correlation never crosses PostHog", () => {
  const firstParty = productEventJoinMetadata({
    entry: "qr_referral",
    funnelKey: "a".repeat(64),
    step: "otp",
    surface: "customer_join",
  })

  assert.deepEqual(firstParty, {
    source: "customer_join",
    surface: "customer_join",
    step: "otp",
    entry: "qr_referral",
    funnel_key: "a".repeat(64),
  })
  assert.deepEqual(postHogJoinMetadata(firstParty), {
    source: "customer_join",
    surface: "customer_join",
    step: "otp",
    entry: "qr_referral",
  })
})

test("Given the email join steps When steps are derived Then each has its own funnel step", () => {
  assert.equal(joinStepForExperienceKind("join_email"), "email")
  assert.equal(joinStepForExperienceKind("join_email_choice"), "email_choice")
})

test("Given an email-verified milestone When metadata is built Then the method rides along to PostHog but never the contact", () => {
  const firstParty = productEventJoinMetadata({
    entry: "qr",
    funnelKey: "b".repeat(64),
    method: "email",
    step: "otp",
    surface: "customer_join",
  })

  assert.equal(firstParty.method, "email")
  assert.deepEqual(postHogJoinMetadata(firstParty), {
    source: "customer_join",
    surface: "customer_join",
    step: "otp",
    entry: "qr",
    method: "email",
  })
})
