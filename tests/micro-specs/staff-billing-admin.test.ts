import { describe, expect, it, vi } from "vitest"

import { createSupabaseMock } from "../helpers/supabase"

function form(values: Record<string, string>) {
  const data = new FormData()

  for (const [key, value] of Object.entries(values)) {
    data.set(key, value)
  }

  return data
}

function redirectMock() {
  return vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  })
}

function stationLibMock(overrides: Record<string, unknown> = {}) {
  return {
    STATION_COOKIE: "nb_station",
    parseStationCookie: (value?: string) => {
      if (!value) return null
      const separator = value.indexOf(".")
      if (separator <= 0) return null
      return {
        stationId: value.slice(0, separator),
        stationSecret: value.slice(separator + 1),
      }
    },
    serializeStationCookie: (credentials: {
      stationId: string
      stationSecret: string
    }) => `${credentials.stationId}.${credentials.stationSecret}`,
    pairStation: vi.fn(),
    getStationState: vi.fn(),
    startStaffSession: vi.fn(),
    endStaffSession: vi.fn(),
    lookupCode: vi.fn(),
    approveStamp: vi.fn(),
    redeemRewardToken: vi.fn(),
    undoStamp: vi.fn(),
    ...overrides,
  }
}

function mockStationRequest(stationLib: Record<string, unknown>) {
  vi.doMock("next/headers", () => ({
    cookies: vi.fn(async () => ({
      get: () => ({ value: "station-1.secret-1" }),
      set: vi.fn(),
      getAll: () => [],
    })),
  }))
  vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }))
  vi.doMock("next/navigation", () => ({ redirect: redirectMock() }))
  vi.doMock("@/lib/staff/station", () => stationLib)
}

describe("04 staff and reward micro-specs", () => {
  it("validates named staff setup before calling the staff RPC", async () => {
    vi.resetModules()
    const addStaffMember = vi.fn()
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }))
    vi.doMock("@/lib/merchant/staff-members", () => ({
      addStaffMember,
      setStaffMemberActive: vi.fn(),
    }))
    vi.doMock("@/lib/merchant/stations", () => ({
      createStationPairing: vi.fn(),
      revokeStation: vi.fn(),
    }))
    const { addStaffMemberAction } = await import("@/app/app/staff/actions")

    await expect(
      addStaffMemberAction({}, form({ displayName: "", pin: "1234" }))
    ).resolves.toEqual({
      errors: { displayName: "Give the staff member a name." },
    })

    await expect(
      addStaffMemberAction({}, form({ displayName: "Maya", pin: "123" }))
    ).resolves.toEqual({ errors: { pin: "PIN must be 4 to 6 digits." } })
    expect(addStaffMember).not.toHaveBeenCalled()
  })

  it("adds a named staff member for paired station sessions", async () => {
    vi.resetModules()
    const revalidatePath = vi.fn()
    const addStaffMember = vi.fn(async () => ({
      status: "created" as const,
      staffId: "staff-1",
    }))
    vi.doMock("next/cache", () => ({ revalidatePath }))
    vi.doMock("@/lib/merchant/staff-members", () => ({
      addStaffMember,
      setStaffMemberActive: vi.fn(),
    }))
    vi.doMock("@/lib/merchant/stations", () => ({
      createStationPairing: vi.fn(),
      revokeStation: vi.fn(),
    }))
    const { addStaffMemberAction } = await import("@/app/app/staff/actions")

    await expect(
      addStaffMemberAction({}, form({ displayName: "Maya", pin: "5678" }))
    ).resolves.toEqual({ added: "Maya" })
    expect(addStaffMember).toHaveBeenCalledWith("Maya", "5678")
    expect(revalidatePath).toHaveBeenCalledWith("/app/launch")
  })

  it("creates a counter station pairing code for the staff station surface", async () => {
    vi.resetModules()
    const revalidatePath = vi.fn()
    const createStationPairing = vi.fn(async () => ({
      status: "created" as const,
      stationId: "station-1",
      stationName: "Front till",
      pairingCode: "K7F3RW88",
      pairingExpiresAt: "2026-06-13T10:15:00Z",
    }))
    vi.doMock("next/cache", () => ({ revalidatePath }))
    vi.doMock("@/lib/merchant/staff-members", () => ({
      addStaffMember: vi.fn(),
      setStaffMemberActive: vi.fn(),
    }))
    vi.doMock("@/lib/merchant/stations", () => ({
      createStationPairing,
      revokeStation: vi.fn(),
    }))
    const { createStationAction } = await import("@/app/app/staff/actions")

    await expect(
      createStationAction({}, form({ stationName: "Front till" }))
    ).resolves.toEqual({
      pairing: {
        stationName: "Front till",
        pairingCode: "K7F3RW88",
        pairingExpiresAt: "2026-06-13T10:15:00Z",
      },
    })
    expect(createStationPairing).toHaveBeenCalledWith("Front till")
    expect(revalidatePath).toHaveBeenCalledWith("/app/launch")
  })

  it("validates the staff PIN before any station session attempt", async () => {
    vi.resetModules()
    const startStaffSession = vi.fn()
    mockStationRequest(stationLibMock({ startStaffSession }))
    vi.doMock("@/lib/analytics/events", () => ({
      capturePostHogEvent: vi.fn(),
    }))
    const { startStaffSessionAction } = await import("@/app/staff/actions")

    await expect(
      startStaffSessionAction({}, form({ staffUserId: "staff-1", pin: "12" }))
    ).resolves.toEqual({
      errors: { pin: "Enter your staff PIN." },
    })
    expect(startStaffSession).not.toHaveBeenCalled()
  })

  it("creates a short-lived stamp code when the customer opens the code screen", async () => {
    vi.resetModules()
    const createStampCode = vi.fn(async () => ({
      status: "created" as const,
      tokenId: "token-1",
      code: "K7F3",
      expiresAt: "2026-06-13T10:02:00Z",
    }))
    vi.doMock("@/components/customer/stamp-code-panel", () => ({
      StampCodePanel: () => null,
    }))
    vi.doMock("@/lib/customer/card", () => ({
      getCustomerCardState: vi.fn(async () => ({
        status: "ready",
        merchant: {
          id: "merchant-1",
          business_name: "The Bell",
          business_slug: "the-bell",
          status: "active",
        },
        membership: {
          id: "membership-1",
          current_stamp_count: 1,
          total_rewards_redeemed: 0,
        },
        loyaltyCard: {
          card_name: "Mystery Visit Card",
          stamps_required: 3,
          reward_name: "Mystery reward",
          reward_terms: "Terms.",
          min_spend_pence: null,
          is_active: true,
        },
        latestReward: null,
        billingStatus: "active",
      })),
    }))
    vi.doMock("@/lib/customer/stamp-code", () => ({ createStampCode }))
    const { default: StampCodePage } = await import(
      "@/app/card/[membershipId]/stamp/page"
    )

    await StampCodePage({
      params: Promise.resolve({ membershipId: "membership-1" }),
    })

    expect(createStampCode).toHaveBeenCalledWith("membership-1")
  })

  it("maps approval failures to safe station-facing messages", async () => {
    vi.resetModules()
    const approveStamp = vi.fn(async () => ({
      status: "blocked" as const,
      reason: "Already stamped today — one stamp per UK business day.",
    }))
    mockStationRequest(stationLibMock({ approveStamp }))
    vi.doMock("@/lib/analytics/events", () => ({
      capturePostHogEvent: vi.fn(),
    }))
    const { approveStampAction } = await import("@/app/staff/actions")

    await expect(
      approveStampAction(
        {},
        form({ tokenId: "token-1", sessionId: "session-1" })
      )
    ).resolves.toEqual({
      result: {
        status: "blocked",
        reason: "Already stamped today — one stamp per UK business day.",
      },
    })
    expect(approveStamp).toHaveBeenCalledWith(
      { stationId: "station-1", stationSecret: "secret-1" },
      "session-1",
      "token-1"
    )
  })

  it("approves a stamp once and records analytics only for fresh approvals", async () => {
    vi.resetModules()
    const capturePostHogEvent = vi.fn()
    const approveStamp = vi
      .fn()
      .mockResolvedValueOnce({
        status: "approved",
        stampEventId: "stamp-1",
        newStampCount: 3,
        rewardUnlocked: true,
        replayed: false,
      })
      .mockResolvedValueOnce({
        status: "approved",
        stampEventId: "stamp-1",
        newStampCount: 3,
        rewardUnlocked: true,
        replayed: true,
      })
    mockStationRequest(stationLibMock({ approveStamp }))
    vi.doMock("@/lib/analytics/events", () => ({ capturePostHogEvent }))
    const { approveStampAction } = await import("@/app/staff/actions")

    const fresh = await approveStampAction(
      {},
      form({ tokenId: "token-1", sessionId: "session-1" })
    )
    expect(fresh.result).toMatchObject({
      status: "approved",
      newStampCount: 3,
      rewardUnlocked: true,
      replayed: false,
    })
    expect(capturePostHogEvent).toHaveBeenCalledTimes(1)
    expect(capturePostHogEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: "stamp_issued" })
    )

    // A retry with the same token id replays the result without a second event.
    const replay = await approveStampAction(
      {},
      form({ tokenId: "token-1", sessionId: "session-1" })
    )
    expect(replay.result).toMatchObject({ status: "approved", replayed: true })
    expect(capturePostHogEvent).toHaveBeenCalledTimes(1)
  })

  it("prevents duplicate reward redemption with a safe message", async () => {
    vi.resetModules()
    const redeemRewardToken = vi.fn(async () => ({
      status: "already_redeemed" as const,
      redeemedAt: null,
    }))
    mockStationRequest(stationLibMock({ redeemRewardToken }))
    vi.doMock("@/lib/analytics/events", () => ({
      capturePostHogEvent: vi.fn(),
    }))
    const { redeemRewardAction } = await import("@/app/staff/actions")

    await expect(
      redeemRewardAction(
        {},
        form({ tokenId: "token-9", sessionId: "session-1" })
      )
    ).resolves.toEqual({
      result: { status: "already_redeemed", redeemedAt: null },
    })
  })

  it("records reward redemption once and returns the customer card to a new cycle", async () => {
    vi.resetModules()
    const capturePostHogEvent = vi.fn()
    const redeemRewardToken = vi.fn(async () => ({
      status: "redeemed" as const,
      rewardId: "reward-9",
      rewardName: "Slice of cake",
      membershipId: "membership-1",
      newStampCount: 0,
      replayed: false,
    }))
    mockStationRequest(stationLibMock({ redeemRewardToken }))
    vi.doMock("@/lib/analytics/events", () => ({ capturePostHogEvent }))
    const { redeemRewardAction } = await import("@/app/staff/actions")

    const result = await redeemRewardAction(
      {},
      form({ tokenId: "token-9", sessionId: "session-1" })
    )

    expect(result.result).toMatchObject({
      status: "redeemed",
      newStampCount: 0,
    })
    expect(capturePostHogEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "reward_redeemed",
        membershipId: "membership-1",
      })
    )
  })
})

describe("06 billing and internal admin micro-specs", () => {
  it("requires Supabase AAL2 before allowing admins when MFA enforcement is enabled", async () => {
    vi.resetModules()
    vi.stubEnv("ADMIN_MFA_REQUIRED", "true")
    const supabase = createSupabaseMock({
      auth: {
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn(async () => ({
            data: { currentLevel: "aal1", nextLevel: "aal2" },
            error: null,
          })),
        },
      },
      from: {
        internal_admins: [
          {
            data: { email: "admin@example.test", is_active: true },
            error: null,
          },
        ],
      },
    })
    vi.doMock("next/navigation", () => ({ redirect: redirectMock() }))
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentUser: vi.fn(async () => ({
        id: "admin-user-1",
        email: "admin@example.test",
      })),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => supabase.client),
    }))
    const { getAdminAccess } = await import("@/lib/admin/auth")

    await expect(getAdminAccess()).resolves.toEqual({
      status: "denied",
      reason: "Admin MFA verification is required.",
    })
  })

  it("allows active internal admins with Supabase AAL2 when MFA enforcement is enabled", async () => {
    vi.resetModules()
    vi.stubEnv("ADMIN_MFA_REQUIRED", "true")
    const supabase = createSupabaseMock({
      auth: {
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn(async () => ({
            data: { currentLevel: "aal2", nextLevel: "aal2" },
            error: null,
          })),
        },
      },
      from: {
        internal_admins: [
          {
            data: { email: "admin@example.test", is_active: true },
            error: null,
          },
        ],
      },
    })
    vi.doMock("next/navigation", () => ({ redirect: redirectMock() }))
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentUser: vi.fn(async () => ({
        id: "admin-user-1",
        email: "admin@example.test",
      })),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => supabase.client),
    }))
    const { getAdminAccess } = await import("@/lib/admin/auth")

    await expect(getAdminAccess()).resolves.toEqual({
      status: "allowed",
      email: "admin@example.test",
      mfaRequired: true,
    })
  })

  it("normalizes Stripe statuses and subscription periods for access control", async () => {
    const { mapStripeSubscriptionStatus, stripeId, subscriptionPeriodEnd } =
      await import("@/lib/stripe/billing")

    expect(mapStripeSubscriptionStatus("trialing")).toBe("trialing")
    expect(mapStripeSubscriptionStatus("active")).toBe("active")
    expect(mapStripeSubscriptionStatus("past_due")).toBe("past_due")
    expect(mapStripeSubscriptionStatus("canceled")).toBe("cancelled")
    expect(mapStripeSubscriptionStatus("incomplete")).toBe("suspended")
    expect(stripeId({ id: "cus_123" })).toBe("cus_123")
    expect(stripeId("cus_456")).toBe("cus_456")
    expect(
      subscriptionPeriodEnd({
        items: { data: [{ current_period_end: 1_800_000_000 }] },
      } as never)
    ).toBe("2027-01-15T08:00:00.000Z")
  })

  it("upserts billing access state from Stripe subscription webhooks", async () => {
    vi.resetModules()
    const supabase = createSupabaseMock({
      from: { billing_customers: [{ data: null, error: null }] },
    })
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    const { syncStripeSubscription } = await import("@/lib/stripe/billing")

    await expect(
      syncStripeSubscription({
        merchantId: "merchant-1",
        subscription: {
          id: "sub_123",
          customer: { id: "cus_123" },
          status: "active",
          metadata: {},
          items: { data: [{ current_period_end: 1_800_000_000 }] },
        } as never,
      })
    ).resolves.toEqual({ merchantId: "merchant-1", status: "active" })
    expect(supabase.queryCalls).toContainEqual(
      expect.objectContaining({
        table: "billing_customers",
        method: "upsert",
        args: [
          expect.objectContaining({
            merchant_id: "merchant-1",
            stripe_customer_id: "cus_123",
            stripe_subscription_id: "sub_123",
            plan: "growth",
            status: "active",
          }),
          { onConflict: "merchant_id" },
        ],
      })
    )
  })

  it("requires internal admin authorization before support actions mutate data", async () => {
    vi.resetModules()
    const requireAdminAction = vi.fn(async () => {
      throw new Error("Forbidden")
    })
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }))
    vi.doMock("@/lib/admin/auth", () => ({ requireAdminAction }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(),
    }))
    const { adjustStampsAction } = await import("@/app/admin/actions")

    await expect(
      adjustStampsAction(form({ membershipId: "membership-1", delta: "1" }))
    ).rejects.toThrow("Forbidden")
  })

  it("logs privacy support and revalidates privacy/audit admin readbacks", async () => {
    vi.resetModules()
    const revalidatePath = vi.fn()
    const supabase = createSupabaseMock({
      rpc: { admin_log_data_request: [{ data: null, error: null }] },
    })
    vi.doMock("next/cache", () => ({ revalidatePath }))
    vi.doMock("@/lib/admin/auth", () => ({
      requireAdminAction: vi.fn(async () => ({ id: "admin-1" })),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => supabase.client),
    }))
    const { logDataRequestAction } = await import("@/app/admin/actions")

    await logDataRequestAction(
      form({
        customerId: "customer-1",
        merchantId: "merchant-1",
        requestType: "erasure",
        channel: "email",
        notes: "Customer requested deletion.",
      })
    )
    expect(supabase.rpcCalls[0]).toEqual({
      name: "admin_log_data_request",
      params: {
        p_customer_id: "customer-1",
        p_merchant_id: "merchant-1",
        p_request_type: "erasure",
        p_channel: "email",
        p_notes: "Customer requested deletion.",
      },
    })
    expect(revalidatePath).toHaveBeenCalledWith("/admin/privacy")
    expect(revalidatePath).toHaveBeenCalledWith("/admin/audit")
  })

  it("logs pilot notes for merchant validation readbacks", async () => {
    vi.resetModules()
    const revalidatePath = vi.fn()
    const supabase = createSupabaseMock({
      rpc: { admin_log_pilot_note: [{ data: null, error: null }] },
    })
    vi.doMock("next/cache", () => ({ revalidatePath }))
    vi.doMock("@/lib/admin/auth", () => ({
      requireAdminAction: vi.fn(async () => ({ id: "admin-1" })),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => supabase.client),
    }))
    const { logPilotNoteAction } = await import("@/app/admin/actions")

    await logPilotNoteAction(
      form({
        merchantId: "merchant-1",
        noteType: "cancellation_reason",
        notes: "No staff time to run the pilot.",
      })
    )
    expect(supabase.rpcCalls[0]).toEqual({
      name: "admin_log_pilot_note",
      params: {
        p_merchant_id: "merchant-1",
        p_note_type: "cancellation_reason",
        p_notes: "No staff time to run the pilot.",
        p_training_minutes: null,
      },
    })
    expect(revalidatePath).toHaveBeenCalledWith("/admin/pilot")
    expect(revalidatePath).toHaveBeenCalledWith("/admin/audit")
  })

  it("logs timed staff-training proof for pilot readiness", async () => {
    vi.resetModules()
    const revalidatePath = vi.fn()
    const supabase = createSupabaseMock({
      rpc: { admin_log_pilot_note: [{ data: null, error: null }] },
    })
    vi.doMock("next/cache", () => ({ revalidatePath }))
    vi.doMock("@/lib/admin/auth", () => ({
      requireAdminAction: vi.fn(async () => ({ id: "admin-1" })),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => supabase.client),
    }))
    const { logPilotNoteAction } = await import("@/app/admin/actions")

    await logPilotNoteAction(
      form({
        merchantId: "merchant-1",
        noteType: "staff_training_timed",
        trainingMinutes: "2",
        notes: "Staff completed QR scan and stamp issue walkthrough.",
      })
    )
    expect(supabase.rpcCalls[0]).toEqual({
      name: "admin_log_pilot_note",
      params: {
        p_merchant_id: "merchant-1",
        p_note_type: "staff_training_timed",
        p_notes: "Staff completed QR scan and stamp issue walkthrough.",
        p_training_minutes: 2,
      },
    })
    expect(revalidatePath).toHaveBeenCalledWith("/admin/pilot")
    expect(revalidatePath).toHaveBeenCalledWith("/admin/audit")
  })
})
