import { afterEach, describe, expect, it, vi } from "vitest"

import { createSupabaseMock } from "../helpers/supabase"
import {
  blockReasonCopy,
  toStampBlockReason,
} from "@/lib/customer/experience/block-reasons"
import { deriveCustomerExperience } from "@/lib/customer/experience/derive"
import { profileCompletionFrom } from "@/lib/customer/profile"
import type { ProfileGate } from "@/lib/customer/experience/types"

const completeFields = {
  fullName: "Sam Taylor",
  dateOfBirth: "1990-01-01",
  email: null,
  emailVerifiedAt: null,
}

const location = { requireGeofence: false, geofenceRadiusMeters: 150 }
const rewardView = {
  rewardId: "reward-1",
  membershipId: "membership-1",
  rewardName: "Coffee upgrade",
  rewardTerms: "Free size upgrade.",
  minSpendPence: 350,
  redeemableFrom: "2026-06-13",
}

function gate(overrides: Partial<ProfileGate> = {}): ProfileGate {
  return {
    complete: false,
    needsEmailVerification: false,
    fullName: null,
    dateOfBirth: null,
    email: null,
    ...overrides,
  }
}

describe("profileCompletionFrom — the redeem-time gate rule", () => {
  it("is incomplete without a name", () => {
    expect(
      profileCompletionFrom({ ...completeFields, fullName: null }).complete
    ).toBe(false)
  })

  it("treats a blank name as missing", () => {
    expect(
      profileCompletionFrom({ ...completeFields, fullName: "   " }).complete
    ).toBe(false)
  })

  it("is incomplete without a date of birth", () => {
    expect(
      profileCompletionFrom({ ...completeFields, dateOfBirth: null }).complete
    ).toBe(false)
  })

  it("is complete with name + DOB and no email", () => {
    expect(profileCompletionFrom(completeFields)).toMatchObject({
      complete: true,
      needsEmailVerification: false,
    })
  })

  it("blocks while an entered email is unverified", () => {
    const result = profileCompletionFrom({
      ...completeFields,
      email: "sam@example.test",
      emailVerifiedAt: null,
    })
    expect(result.complete).toBe(false)
    expect(result.needsEmailVerification).toBe(true)
  })

  it("is complete once an entered email is verified", () => {
    expect(
      profileCompletionFrom({
        ...completeFields,
        email: "sam@example.test",
        emailVerifiedAt: "2026-06-15T00:00:00.000Z",
      })
    ).toMatchObject({ complete: true, needsEmailVerification: false })
  })
})

describe("reward experience carries the profile gate", () => {
  function rewardContext(profileGate?: ProfileGate) {
    return {
      reward: rewardView,
      merchantName: "Bean & Batch",
      status: "unlocked",
      redeemable: true,
      redeemedProof: false,
      location,
      profileGate,
    }
  }

  it("exposes an incomplete gate on the ready reward", () => {
    const exp = deriveCustomerExperience({
      entry: "reward",
      context: rewardContext(gate({ complete: false })),
    })
    expect(exp).toMatchObject({
      kind: "reward_ready",
      profileGate: { complete: false },
    })
  })

  it("defaults to a complete gate when none is loaded", () => {
    const exp = deriveCustomerExperience({
      entry: "reward",
      context: rewardContext(undefined),
    })
    expect(exp).toMatchObject({
      kind: "reward_ready",
      profileGate: { complete: true },
    })
  })
})

describe("block reasons", () => {
  it("maps the RPC profile message to a typed reason with calm copy", () => {
    expect(toStampBlockReason("Complete your profile before redeeming")).toBe(
      "profile_incomplete"
    )
    expect(blockReasonCopy("profile_incomplete").length).toBeGreaterThan(0)
  })
})

describe("updateCustomerProfile email re-verification", () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.doUnmock("@/lib/supabase/server")
    vi.doUnmock("@/lib/customer/identity")
  })

  async function setup(
    customer: { email: string | null; emailVerifiedAt: string | null },
    input: { fullName: string; dateOfBirth: string; email?: string | null }
  ) {
    vi.resetModules()
    const mock = createSupabaseMock({})
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: async () => mock.client,
      createSupabaseServiceRoleClient: () => mock.client,
    }))
    vi.doMock("@/lib/customer/identity", () => ({
      getCurrentCustomer: vi.fn(async () => ({
        id: "customer-1",
        authUserId: null,
        email: customer.email,
        emailVerifiedAt: customer.emailVerifiedAt,
        fullName: null,
        dateOfBirth: null,
        phone: "Phone ending 3456",
        phoneLast4: "3456",
        phoneCountry: "GB",
        createdAt: "2026-06-13T12:00:00.000Z",
      })),
    }))
    const { updateCustomerProfile } = await import("@/lib/customer/profile")
    const result = await updateCustomerProfile(input)
    const update = mock.queryCalls.find((c) => c.method === "update")
    return { result, update }
  }

  it("requires verification and clears the flag when a new email is added", async () => {
    const { result, update } = await setup(
      { email: null, emailVerifiedAt: null },
      { fullName: "Sam", dateOfBirth: "1990-01-01", email: "new@example.test" }
    )
    expect(result.emailVerificationRequired).toBe(true)
    expect(update?.args[0]).toMatchObject({
      full_name: "Sam",
      date_of_birth: "1990-01-01",
      email: "new@example.test",
      email_verified_at: null,
    })
  })

  it("keeps an unchanged, already-verified email verified", async () => {
    const { result, update } = await setup(
      {
        email: "same@example.test",
        emailVerifiedAt: "2026-06-01T00:00:00.000Z",
      },
      { fullName: "Sam", dateOfBirth: "1990-01-01", email: "same@example.test" }
    )
    expect(result.emailVerificationRequired).toBe(false)
    expect(update?.args[0]).not.toHaveProperty("email_verified_at")
  })

  it("clears the email when left blank", async () => {
    const { result, update } = await setup(
      { email: "old@example.test", emailVerifiedAt: null },
      { fullName: "Sam", dateOfBirth: "1990-01-01", email: "" }
    )
    expect(result.emailVerificationRequired).toBe(false)
    expect(update?.args[0]).toMatchObject({
      email: null,
      email_verified_at: null,
    })
  })
})

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
  }) {
    const updateCustomerProfile =
      overrides.updateCustomerProfile ??
      vi.fn(async () => ({ emailVerificationRequired: false, email: null }))
    const startCustomerEmailVerification =
      overrides.startCustomerEmailVerification ??
      vi.fn(async () => ({ status: "sent" }))
    vi.doMock("@/lib/customer/profile", () => ({
      updateCustomerProfile,
      markCustomerEmailVerified: vi.fn(),
      clearCustomerEmail: vi.fn(),
      // stamp.ts (imported transitively by the action) pulls this in.
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
      getCurrentCustomer: vi.fn(),
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
})
