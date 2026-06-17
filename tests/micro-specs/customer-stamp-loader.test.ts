import { afterEach, describe, expect, it, vi } from "vitest"

import { createSupabaseMock } from "../helpers/supabase"

const readyCardState = {
  status: "ready",
  membership: {
    id: "membership-1",
    current_stamp_count: 1,
    total_rewards_redeemed: 0,
    active_cycle_number: 1,
  },
  merchant: {
    id: "merchant-1",
    business_name: "The Bell",
    business_slug: "the-bell",
    status: "active",
  },
  loyaltyCard: {
    card_name: "Mystery Visit Card",
    stamps_required: 3,
    reward_name: "Surprise reward",
    reward_terms: "Complete 3 visits.",
    min_spend_pence: null,
    is_active: true,
  },
  latestReward: null,
  billingStatus: "active",
} as const

describe("customer stamp loader", () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.doUnmock("@/lib/customer/card")
    vi.doUnmock("@/lib/customer/join")
    vi.doUnmock("@/lib/customer/stamp")
    vi.doUnmock("@/lib/supabase/server")
  })

  it("uses the authorized card merchant for QR stamp location checks", async () => {
    vi.resetModules()
    const getMembershipLocationRequirement = vi.fn(async () => ({
      requireGeofence: false,
      geofenceRadiusMeters: 150,
    }))
    const getMerchantStampLocationRequirement = vi.fn(async () => ({
      requireGeofence: true,
      geofenceRadiusMeters: 200,
    }))
    const supabase = createSupabaseMock({
      from: { stamp_events: [{ data: null, error: null }] },
    })
    vi.doMock("@/lib/customer/card", () => ({
      getCustomerCardState: vi.fn(async () => readyCardState),
      getMembershipStampDisplayDates: vi.fn(async () => ["10 Jun"]),
      reconcileCardStampCount: vi.fn(() => 1),
    }))
    vi.doMock("@/lib/customer/join", () => ({
      getStampQrContextForMembership: vi.fn(async () => ({ qrId: "qr-1" })),
    }))
    vi.doMock("@/lib/customer/stamp", () => ({
      getMembershipLocationRequirement,
      getMerchantStampLocationRequirement,
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    const { loadStampExperienceContext } =
      await import("@/lib/customer/experience/load-stamp")

    await expect(
      loadStampExperienceContext("membership-1", "qr-1")
    ).resolves.toMatchObject({
      membershipId: "membership-1",
      qrValid: true,
      location: { requireGeofence: true, geofenceRadiusMeters: 200 },
    })
    expect(getMerchantStampLocationRequirement).toHaveBeenCalledWith(
      "merchant-1"
    )
    expect(getMembershipLocationRequirement).not.toHaveBeenCalled()
  })
})
