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
        notes: "No time to run the pilot.",
      })
    )
    expect(supabase.rpcCalls[0]).toEqual({
      name: "admin_log_pilot_note",
      params: {
        p_merchant_id: "merchant-1",
        p_note_type: "cancellation_reason",
        p_notes: "No time to run the pilot.",
        p_training_minutes: null,
      },
    })
    expect(revalidatePath).toHaveBeenCalledWith("/admin/pilot")
    expect(revalidatePath).toHaveBeenCalledWith("/admin/audit")
  })

  it("logs self-service launch proof for pilot readiness", async () => {
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
        noteType: "launch_self_service_checked",
        setupMinutes: "2",
        notes: "Checked QR scan, stamp, and reward self-service.",
      })
    )
    expect(supabase.rpcCalls[0]).toEqual({
      name: "admin_log_pilot_note",
      params: {
        p_merchant_id: "merchant-1",
        p_note_type: "launch_self_service_checked",
        p_notes: "Checked QR scan, stamp, and reward self-service.",
        p_training_minutes: 2,
      },
    })
    expect(revalidatePath).toHaveBeenCalledWith("/admin/pilot")
    expect(revalidatePath).toHaveBeenCalledWith("/admin/audit")
  })
})
