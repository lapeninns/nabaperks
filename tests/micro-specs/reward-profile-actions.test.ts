import { afterEach, describe, expect, it, vi } from "vitest"

describe("saveProfileForRedeemAction", () => {
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
    getCurrentCustomer?: ReturnType<typeof vi.fn>
  }) {
    const updateCustomerProfile =
      overrides.updateCustomerProfile ??
      vi.fn(async () => ({ emailVerificationRequired: false, email: null }))
    const startCustomerEmailVerification =
      overrides.startCustomerEmailVerification ??
      vi.fn(async () => ({ status: "sent" }))
    const getCurrentCustomer =
      overrides.getCurrentCustomer ?? vi.fn(async () => null)
    vi.doMock("@/lib/customer/profile", () => ({
      updateCustomerProfile,
      markCustomerEmailVerified: vi.fn(),
      clearCustomerEmail: vi.fn(),
      profileCompletionFrom: vi.fn(() => ({ complete: true })),
    }))
    vi.doMock("@/lib/customer/email-verification", () => ({
      startCustomerEmailVerification,
      checkCustomerEmailVerification: vi.fn(),
    }))
    vi.doMock("@/lib/customer/session", () => ({
      clearPendingEmailVerification: vi.fn(),
    }))
    vi.doMock("@/lib/customer/identity", () => ({
      getCurrentCustomer,
    }))
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }))
    return { updateCustomerProfile, startCustomerEmailVerification }
  }

  it("rejects a missing name and date of birth without saving", async () => {
    const { updateCustomerProfile } = mockDeps({})
    const { saveProfileForRedeemAction } =
      await import("@/app/reward/[rewardId]/actions")

    const result = await saveProfileForRedeemAction(
      {},
      form({ rewardId: "reward-1", fullName: "", dateOfBirth: "" })
    )

    expect(result.errors?.fullName).toBeTruthy()
    expect(result.errors?.dateOfBirth).toBeTruthy()
    expect(updateCustomerProfile).not.toHaveBeenCalled()
  })

  it("saves name + DOB with no email and does not start verification", async () => {
    const { updateCustomerProfile, startCustomerEmailVerification } = mockDeps(
      {}
    )
    const { saveProfileForRedeemAction } =
      await import("@/app/reward/[rewardId]/actions")

    const result = await saveProfileForRedeemAction(
      {},
      form({
        rewardId: "reward-1",
        fullName: "Sam Taylor",
        dateOfBirth: "1990-01-01",
      })
    )

    expect(result.errors).toBeUndefined()
    expect(updateCustomerProfile).toHaveBeenCalledWith({
      fullName: "Sam Taylor",
      dateOfBirth: "1990-01-01",
      email: null,
    })
    expect(startCustomerEmailVerification).not.toHaveBeenCalled()
  })

  it("emails a code when a new email needs verifying", async () => {
    const { startCustomerEmailVerification } = mockDeps({
      updateCustomerProfile: vi.fn(async () => ({
        emailVerificationRequired: true,
        email: "sam@example.test",
      })),
    })
    const { saveProfileForRedeemAction } =
      await import("@/app/reward/[rewardId]/actions")

    await saveProfileForRedeemAction(
      {},
      form({
        rewardId: "reward-1",
        fullName: "Sam Taylor",
        dateOfBirth: "1990-01-01",
        email: "sam@example.test",
      })
    )

    expect(startCustomerEmailVerification).toHaveBeenCalledWith(
      "sam@example.test"
    )
  })

  it("does not email a new code when a verified email is locked", async () => {
    const { startCustomerEmailVerification } = mockDeps({
      updateCustomerProfile: vi.fn(async () => ({
        emailVerificationRequired: false,
        email: "verified@example.test",
        emailLocked: true,
      })),
    })
    const { saveProfileForRedeemAction } =
      await import("@/app/reward/[rewardId]/actions")

    await saveProfileForRedeemAction(
      {},
      form({
        rewardId: "reward-1",
        fullName: "Sam Taylor",
        dateOfBirth: "1990-01-01",
        email: "tampered@example.test",
      })
    )

    expect(startCustomerEmailVerification).not.toHaveBeenCalled()
  })

  it("rejects an invalid email address", async () => {
    const { updateCustomerProfile } = mockDeps({})
    const { saveProfileForRedeemAction } =
      await import("@/app/reward/[rewardId]/actions")

    const result = await saveProfileForRedeemAction(
      {},
      form({
        rewardId: "reward-1",
        fullName: "Sam Taylor",
        dateOfBirth: "1990-01-01",
        email: "not-an-email",
      })
    )

    expect(result.errors?.email).toBeTruthy()
    expect(updateCustomerProfile).not.toHaveBeenCalled()
  })

  it("does not resend verification for a verified reward-gate email", async () => {
    const startCustomerEmailVerification = vi.fn(async () => ({
      status: "sent",
    }))
    mockDeps({
      startCustomerEmailVerification,
      getCurrentCustomer: vi.fn(async () => ({
        email: "verified@example.test",
        emailVerifiedAt: "2026-06-17T10:00:00.000Z",
      })),
    })
    const { resendProfileEmailAction } =
      await import("@/app/reward/[rewardId]/actions")

    await resendProfileEmailAction(form({ rewardId: "reward-1" }))

    expect(startCustomerEmailVerification).not.toHaveBeenCalled()
  })
})
