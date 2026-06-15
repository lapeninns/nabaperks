import { readFileSync } from "node:fs"

import { afterEach, describe, expect, it, vi } from "vitest"

function readProjectFile(path: string): string {
  return readFileSync(path, "utf8")
}

function form(values: Record<string, string>): FormData {
  const data = new FormData()

  for (const [key, value] of Object.entries(values)) {
    data.set(key, value)
  }

  return data
}

describe("customer-facing gap fixes", () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.doUnmock("next/headers")
    vi.doUnmock("@/lib/customer/identity")
    vi.doUnmock("@/lib/customer/phone")
    vi.doUnmock("@/lib/customer/session")
    vi.doUnmock("@/lib/customer/verification")
    vi.doUnmock("@/lib/security/rate-limit")
  })

  it("removes the customer self-redeem action and form surface", () => {
    const rewardActions = readProjectFile("app/reward/[rewardId]/actions.ts")
    const stampLibrary = readProjectFile("lib/customer/stamp.ts")
    const selfServiceForms = readProjectFile(
      "components/customer/self-service-forms.tsx"
    )
    const cardExperience = readProjectFile(
      "components/customer/customer-card-experience.tsx"
    )
    const homeRewardBanner = readProjectFile(
      "components/customer/home-redeem-banner.tsx"
    )

    expect(rewardActions).not.toContain("selfRedeemAction")
    expect(rewardActions).not.toContain("SelfRedeemActionState")
    expect(stampLibrary).not.toContain("redeemSelfServiceReward")
    expect(selfServiceForms).not.toContain("SelfServiceRedeemForm")
    expect(selfServiceForms).not.toContain("selfRedeemAction")
    expect(cardExperience).not.toContain("Redeem reward")
    expect(homeRewardBanner).not.toContain("Redeem reward")
    expect(cardExperience).toContain("Open reward QR")
    expect(homeRewardBanner).toContain("Open reward QR")
  })

  it("keeps customer login neutral for unknown phone numbers", async () => {
    const startCustomerPhoneVerification = vi.fn(async () => {})
    const setPendingPhoneVerification = vi.fn(async () => ({}))

    vi.doMock("next/headers", () => ({
      headers: vi.fn(async () => new Headers()),
    }))
    vi.doMock("@/lib/customer/phone", () => ({
      defaultCountryFromHeaders: vi.fn(() => "GB"),
      normalizePhone: vi.fn(() => ({
        ok: true,
        phone: { e164: "+447400123456", country: "GB" },
      })),
    }))
    vi.doMock("@/lib/customer/identity", () => ({
      findCustomerByVerifiedPhone: vi.fn(async () => null),
    }))
    vi.doMock("@/lib/customer/session", () => ({
      clearCustomerSession: vi.fn(),
      clearPendingPhoneVerification: vi.fn(),
      getPendingPhoneVerification: vi.fn(),
      setCustomerSession: vi.fn(),
      setPendingPhoneVerification,
    }))
    vi.doMock("@/lib/customer/verification", () => ({
      checkCustomerPhoneVerification: vi.fn(),
      startCustomerPhoneVerification,
    }))
    vi.doMock("@/lib/security/rate-limit", () => ({
      RateLimitError: class RateLimitError extends Error {},
      enforceRateLimit: vi.fn(async () => {}),
    }))

    const { requestCustomerLoginOtpAction } = await import("@/app/home/actions")
    const result = await requestCustomerLoginOtpAction(
      {},
      form({ contact: "07400 123456" })
    )

    expect(result.errors?.form ?? "").not.toMatch(/find an account/i)
    expect(result.fields).toMatchObject({
      contact: "+447400123456",
      otpSent: true,
    })
    expect(result.message).toMatch(/if that number has nabaperks cards/i)
    expect(startCustomerPhoneVerification).not.toHaveBeenCalled()
    expect(setPendingPhoneVerification).toHaveBeenCalledWith({
      purpose: "wallet",
      phone: "+447400123456",
      country: "GB",
      customerId: null,
    })
  })

  it("shows checking-status and missing-stamp guidance during uncertain stamp submissions", () => {
    const selfServiceForms = readProjectFile(
      "components/customer/self-service-forms.tsx"
    )

    expect(selfServiceForms).toContain("Checking your card status")
    expect(selfServiceForms).toContain("If this keeps failing")
    expect(selfServiceForms).toContain("ask the venue team")
  })

  it("makes first-scan recovery choices visible on the QR welcome screen", () => {
    const copy = readProjectFile("lib/customer/experience/copy.ts")
    const welcomeStep = readProjectFile(
      "components/customer/join-welcome-step.tsx"
    )

    expect(copy).toContain("Already have a card?")
    expect(copy).toContain("How it works")
    expect(welcomeStep).toContain("JOIN_WELCOME_ALREADY_HAVE_CARD_LABEL")
  })

  it("declares explicit join funnel events for step-level drop-off analysis", () => {
    const analyticsEvents = readProjectFile("lib/analytics/events.ts")
    const joinActions = readProjectFile("app/m/[merchantSlug]/join/actions.ts")

    for (const eventName of [
      "join_page_viewed",
      "join_phone_requested",
      "join_otp_verified",
      "join_terms_accepted",
      "customer_card_viewed",
    ]) {
      expect(analyticsEvents).toContain(eventName)
    }

    expect(joinActions).toContain("join_phone_requested")
    expect(joinActions).toContain("join_otp_verified")
    expect(joinActions).toContain("join_terms_accepted")
  })

  it("keeps reward-cycle stamping service-role compatible for QR first stamps", () => {
    const migration = readProjectFile(
      "supabase/migrations/20260615130000_reward_redemption_cycles.sql"
    )
    const stampFunction = migration.slice(
      migration.indexOf(
        "create or replace function public.issue_self_service_stamp"
      ),
      migration.indexOf(
        "create or replace function public.redeem_self_service_reward"
      )
    )

    expect(stampFunction).toContain("public.is_service_role_request()")
    expect(stampFunction).not.toContain("request_role text")
    expect(stampFunction).not.toContain("coalesce(request_role")
  })
})
