import { afterEach, describe, expect, it, vi } from "vitest"

import { createSupabaseMock } from "../helpers/supabase"
import { validateProfileFields } from "@/lib/customer/profile-fields"

describe("validateProfileFields", () => {
  it("flags a missing name", () => {
    expect(
      validateProfileFields({ fullName: "", dateOfBirth: "1990-01-01", email: "" })
        .fullName
    ).toBeTruthy()
  })

  it("flags a missing, malformed, or future date of birth", () => {
    expect(
      validateProfileFields({ fullName: "Sam", dateOfBirth: "", email: "" })
        .dateOfBirth
    ).toBeTruthy()
    expect(
      validateProfileFields({ fullName: "Sam", dateOfBirth: "01/01/1990", email: "" })
        .dateOfBirth
    ).toBeTruthy()
    expect(
      validateProfileFields({ fullName: "Sam", dateOfBirth: "2999-01-01", email: "" })
        .dateOfBirth
    ).toBeTruthy()
  })

  it("flags an invalid email but allows a blank one", () => {
    expect(
      validateProfileFields({ fullName: "Sam", dateOfBirth: "1990-01-01", email: "nope" })
        .email
    ).toBeTruthy()
    expect(
      validateProfileFields({ fullName: "Sam", dateOfBirth: "1990-01-01", email: "" })
    ).toEqual({})
  })

  it("passes a complete, valid set", () => {
    expect(
      validateProfileFields({
        fullName: "Sam Taylor",
        dateOfBirth: "1990-01-01",
        email: "sam@example.test",
      })
    ).toEqual({})
  })
})

describe("getCustomerProfile surfaces editable fields", () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.doUnmock("@/lib/supabase/server")
    vi.doUnmock("@/lib/customer/identity")
  })

  it("includes name, DOB and email-verification state", async () => {
    vi.resetModules()
    const mock = createSupabaseMock({
      from: {
        customer_memberships: [{ count: 2, data: null, error: null }],
        consent_records: [{ data: [], error: null }],
      },
    })
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: async () => mock.client,
      createSupabaseServiceRoleClient: () => mock.client,
    }))
    vi.doMock("@/lib/customer/identity", () => ({
      getCurrentCustomer: vi.fn(async () => ({
        id: "c1",
        authUserId: null,
        email: "sam@example.test",
        emailVerifiedAt: null,
        fullName: "Sam Taylor",
        dateOfBirth: "1990-01-01",
        phone: "Phone ending 3456",
        phoneLast4: "3456",
        phoneCountry: "GB",
        createdAt: "2026-06-13T12:00:00.000Z",
      })),
    }))

    const { getCustomerProfile } = await import("@/lib/customer/profile")
    const profile = await getCustomerProfile()

    expect(profile).toMatchObject({
      fullName: "Sam Taylor",
      dateOfBirth: "1990-01-01",
      email: "sam@example.test",
      emailVerified: false,
      needsEmailVerification: true,
      membershipCount: 2,
    })
  })
})

describe("home profile actions", () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.doUnmock("@/lib/customer/profile")
    vi.doUnmock("@/lib/customer/email-verification")
    vi.doUnmock("@/lib/customer/session")
    vi.doUnmock("@/lib/customer/identity")
    vi.doUnmock("next/cache")
  })

  function form(values: Record<string, string>) {
    const data = new FormData()
    for (const [key, value] of Object.entries(values)) data.set(key, value)
    return data
  }

  function mockDeps(overrides: {
    updateCustomerProfile?: ReturnType<typeof vi.fn>
    startCustomerEmailVerification?: ReturnType<typeof vi.fn>
    checkCustomerEmailVerification?: ReturnType<typeof vi.fn>
    markCustomerEmailVerified?: ReturnType<typeof vi.fn>
  }) {
    const updateCustomerProfile =
      overrides.updateCustomerProfile ??
      vi.fn(async () => ({ emailVerificationRequired: false, email: null }))
    const startCustomerEmailVerification =
      overrides.startCustomerEmailVerification ?? vi.fn(async () => ({ status: "sent" }))
    const checkCustomerEmailVerification =
      overrides.checkCustomerEmailVerification ?? vi.fn()
    const markCustomerEmailVerified =
      overrides.markCustomerEmailVerified ?? vi.fn(async () => {})

    vi.doMock("@/lib/customer/profile", () => ({
      updateCustomerProfile,
      markCustomerEmailVerified,
      clearCustomerEmail: vi.fn(),
    }))
    vi.doMock("@/lib/customer/email-verification", () => ({
      startCustomerEmailVerification,
      checkCustomerEmailVerification,
    }))
    vi.doMock("@/lib/customer/session", () => ({
      clearPendingEmailVerification: vi.fn(),
    }))
    vi.doMock("@/lib/customer/identity", () => ({ getCurrentCustomer: vi.fn() }))
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }))

    return {
      updateCustomerProfile,
      startCustomerEmailVerification,
      checkCustomerEmailVerification,
      markCustomerEmailVerified,
    }
  }

  it("rejects a missing name and date of birth without saving", async () => {
    const { updateCustomerProfile } = mockDeps({})
    const { saveHomeProfileAction } = await import(
      "@/app/home/(authed)/profile/actions"
    )

    const result = await saveHomeProfileAction({}, form({ fullName: "", dateOfBirth: "" }))

    expect(result.errors?.fullName).toBeTruthy()
    expect(result.errors?.dateOfBirth).toBeTruthy()
    expect(updateCustomerProfile).not.toHaveBeenCalled()
  })

  it("saves name + DOB with no email and confirms success", async () => {
    const { updateCustomerProfile, startCustomerEmailVerification } = mockDeps({})
    const { saveHomeProfileAction } = await import(
      "@/app/home/(authed)/profile/actions"
    )

    const result = await saveHomeProfileAction(
      {},
      form({ fullName: "Sam Taylor", dateOfBirth: "1990-01-01" })
    )

    expect(result.errors).toBeUndefined()
    expect(result.message).toBeTruthy()
    expect(updateCustomerProfile).toHaveBeenCalledWith({
      fullName: "Sam Taylor",
      dateOfBirth: "1990-01-01",
      email: null,
    })
    expect(startCustomerEmailVerification).not.toHaveBeenCalled()
  })

  it("starts verification when a new email is added", async () => {
    const { startCustomerEmailVerification } = mockDeps({
      updateCustomerProfile: vi.fn(async () => ({
        emailVerificationRequired: true,
        email: "sam@example.test",
      })),
    })
    const { saveHomeProfileAction } = await import(
      "@/app/home/(authed)/profile/actions"
    )

    const result = await saveHomeProfileAction(
      {},
      form({
        fullName: "Sam Taylor",
        dateOfBirth: "1990-01-01",
        email: "sam@example.test",
      })
    )

    expect(startCustomerEmailVerification).toHaveBeenCalledWith("sam@example.test")
    expect(result.message).toMatch(/code/i)
  })

  it("confirms the email on an approved code", async () => {
    const { markCustomerEmailVerified } = mockDeps({
      checkCustomerEmailVerification: vi.fn(async () => ({
        status: "approved",
        email: "sam@example.test",
      })),
    })
    const { verifyHomeProfileEmailAction } = await import(
      "@/app/home/(authed)/profile/actions"
    )

    const result = await verifyHomeProfileEmailAction({}, form({ otp: "424242" }))

    expect(markCustomerEmailVerified).toHaveBeenCalledWith("sam@example.test")
    expect(result.message).toBeTruthy()
    expect(result.errors).toBeUndefined()
  })

  it("rejects a code that does not match", async () => {
    const { markCustomerEmailVerified } = mockDeps({
      checkCustomerEmailVerification: vi.fn(async () => ({ status: "rejected" })),
    })
    const { verifyHomeProfileEmailAction } = await import(
      "@/app/home/(authed)/profile/actions"
    )

    const result = await verifyHomeProfileEmailAction({}, form({ otp: "000000" }))

    expect(result.errors?.otp).toBeTruthy()
    expect(markCustomerEmailVerified).not.toHaveBeenCalled()
  })
})

describe("home marketing consent action", () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.doUnmock("@/lib/customer/consent")
    vi.doUnmock("next/cache")
  })

  function form(values: Record<string, string>) {
    const data = new FormData()
    for (const [key, value] of Object.entries(values)) data.set(key, value)
    return data
  }

  function mockConsent() {
    const updateCustomerMarketingConsent = vi.fn(async () => {})
    vi.doMock("@/lib/customer/consent", () => ({
      updateCustomerMarketingConsent,
      isMarketingChannel: (value: string) =>
        ["email", "sms", "whatsapp"].includes(value),
      MARKETING_POLICY_VERSION: "2026-06-06",
    }))
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }))
    return { updateCustomerMarketingConsent }
  }

  it("records an opt-in through the consent RPC", async () => {
    const { updateCustomerMarketingConsent } = mockConsent()
    const { updateHomeMarketingConsentAction } = await import(
      "@/app/home/(authed)/profile/actions"
    )

    const result = await updateHomeMarketingConsentAction(
      {},
      form({ channel: "sms", optedIn: "on" })
    )

    expect(updateCustomerMarketingConsent).toHaveBeenCalledWith({
      channel: "sms",
      optedIn: true,
    })
    expect(result).toMatchObject({ channel: "sms", optedIn: true })
    expect(result.error).toBeUndefined()
  })

  it("records an opt-out when the toggle is unchecked", async () => {
    const { updateCustomerMarketingConsent } = mockConsent()
    const { updateHomeMarketingConsentAction } = await import(
      "@/app/home/(authed)/profile/actions"
    )

    await updateHomeMarketingConsentAction({}, form({ channel: "email" }))

    expect(updateCustomerMarketingConsent).toHaveBeenCalledWith({
      channel: "email",
      optedIn: false,
    })
  })

  it("rejects an unknown channel without recording", async () => {
    const { updateCustomerMarketingConsent } = mockConsent()
    const { updateHomeMarketingConsentAction } = await import(
      "@/app/home/(authed)/profile/actions"
    )

    const result = await updateHomeMarketingConsentAction(
      {},
      form({ channel: "carrier-pigeon", optedIn: "on" })
    )

    expect(result.error).toBeTruthy()
    expect(updateCustomerMarketingConsent).not.toHaveBeenCalled()
  })
})
