import { afterEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { createSupabaseMock } from "../helpers/supabase"
import { CustomerProfileGateForm } from "@/components/customer/profile-gate-forms"
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
  redeemableFrom: "2026-06-13",
}

function gate(overrides: Partial<ProfileGate> = {}): ProfileGate {
  return {
    complete: false,
    needsEmailVerification: false,
    fullName: null,
    dateOfBirth: null,
    email: null,
    emailLocked: false,
    ...overrides,
  }
}

function mockCurrentCustomer() {
  vi.doMock("@/lib/customer/identity", () => ({
    getCurrentCustomer: vi.fn(async () => ({
      id: "customer-1",
      authUserId: null,
      email: null,
      emailVerifiedAt: null,
      fullName: "Sam Taylor",
      dateOfBirth: "1990-01-01",
      phone: "Phone ending 3456",
      phoneLast4: "3456",
      phoneCountry: "GB",
      createdAt: "2026-06-13T12:00:00.000Z",
    })),
  }))
}

function rewardStateRow(locationId: string | null) {
  return {
    id: "reward-1",
    status: "unlocked",
    membership_id: "membership-1",
    merchant_id: "merchant-1",
    customer_id: "customer-1",
    created_at: "2026-06-06T12:00:00.000Z",
    redeemed_at: null,
    reward_name: "Coffee upgrade",
    reward_terms: "Free size upgrade.",
    redeemable_from: "2999-06-13",
    expires_at: null,
    expired_at: null,
    customer_memberships: {
      current_stamp_count: 3,
      total_rewards_redeemed: 0,
    },
    merchants: {
      business_name: "Old Crown Girton",
      business_slug: "old-crown-girton",
      status: "active",
      billing_customers: { status: "active" },
    },
    loyalty_cards: {
      card_name: "Mystery Visit Card",
      stamps_required: 3,
      reward_name: "Surprise reward",
      reward_terms: "Complete 3 visits.",
      location_id: locationId,
      is_active: true,
    },
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
    ).toMatchObject({
      complete: true,
      needsEmailVerification: false,
      emailLocked: true,
    })
  })
})

describe("reward experience carries the profile gate", () => {
  function rewardContext(profileGate?: ProfileGate) {
    return {
      reward: rewardView,
      merchantName: "Old Crown Girton",
      status: "unlocked",
      redeemable: true,
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

  it("does not render an editable email input when verified email is locked", () => {
    const verifiedGate = {
      complete: false,
      needsEmailVerification: false,
      fullName: null,
      dateOfBirth: null,
      email: "verified@example.test",
      emailLocked: true,
    }

    const html = renderToStaticMarkup(
      createElement(CustomerProfileGateForm, {
        rewardId: "reward-1",
        gate: verifiedGate,
      })
    )

    expect(html).toContain("verified@example.test")
    expect(html).toContain("Verified")
    expect(html).not.toContain('name="email"')
    expect(html).not.toContain("Continue without email")
  })
})

describe("reward experience location requirement", () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.doUnmock("@/lib/supabase/server")
    vi.doUnmock("@/lib/customer/identity")
  })

  it("uses the location already loaded with the reward card", async () => {
    vi.resetModules()
    const supabase = createSupabaseMock({
      from: {
        reward_events: [{ data: rewardStateRow("location-1"), error: null }],
        merchant_locations: [
          {
            data: {
              require_geofence: true,
              geofence_radius_meters: 75,
            },
            error: null,
          },
        ],
      },
    })
    mockCurrentCustomer()
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    const { loadRewardExperienceContext } =
      await import("@/lib/customer/experience/load-reward")

    await expect(
      loadRewardExperienceContext("reward-1")
    ).resolves.toMatchObject({
      location: { requireGeofence: true, geofenceRadiusMeters: 75 },
    })
    expect(
      supabase.queryCalls.filter(
        (call) => call.table === "reward_events" && call.method === "select"
      )
    ).toHaveLength(1)
    expect(
      supabase.queryCalls.filter((call) => call.table === "loyalty_cards")
    ).toHaveLength(0)
    expect(supabase.queryCalls).toContainEqual({
      table: "merchant_locations",
      method: "eq",
      args: ["id", "location-1"],
    })
  })

  it("keeps the no-location reward fallback without an extra location query", async () => {
    vi.resetModules()
    const supabase = createSupabaseMock({
      from: {
        reward_events: [{ data: rewardStateRow(null), error: null }],
      },
    })
    mockCurrentCustomer()
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    const { loadRewardExperienceContext } =
      await import("@/lib/customer/experience/load-reward")

    await expect(
      loadRewardExperienceContext("reward-1")
    ).resolves.toMatchObject({
      location: { requireGeofence: false, geofenceRadiusMeters: 150 },
    })
    expect(
      supabase.queryCalls.some((call) => call.table === "merchant_locations")
    ).toBe(false)
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
