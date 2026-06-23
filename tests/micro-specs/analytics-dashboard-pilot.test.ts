import { afterEach, describe, expect, it, vi } from "vitest"

import { createSupabaseMock } from "../helpers/supabase"

afterEach(() => {
  vi.useRealTimers()
})

describe("05/07 analytics, dashboard, and compliance micro-specs", () => {
  it("persists product events to Supabase and sends sanitized best-effort PostHog payloads", async () => {
    vi.resetModules()
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test")
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://eu.posthog.test/")
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void input
        void init
        return new Response(null, { status: 200 })
      }
    )
    vi.stubGlobal("fetch", fetchMock)
    const supabase = createSupabaseMock({
      from: { product_events: [{ data: null, error: null }] },
    })
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    const { recordProductEvent } = await import("@/lib/analytics/events")

    await recordProductEvent({
      eventName: "customer_joined",
      merchantId: "merchant-1",
      customerId: "customer-1",
      membershipId: "membership-1",
      actorType: "customer",
      actorId: "user-1",
      metadata: {
        email: "guest@example.test",
        phone: "+441234567890",
        marketing_opt_in: true,
      },
    })

    expect(supabase.queryCalls).toContainEqual(
      expect.objectContaining({
        table: "product_events",
        method: "insert",
        args: [
          expect.objectContaining({
            event_name: "customer_joined",
            merchant_id: "merchant-1",
            customer_id: "customer-1",
            membership_id: "membership-1",
            actor_type: "customer",
          }),
        ],
      })
    )
    const firstFetchCall = fetchMock.mock.calls[0] as [
      RequestInfo | URL,
      RequestInit,
    ]
    const body = JSON.parse(String(firstFetchCall[1].body))
    expect(firstFetchCall[0]).toBe("https://eu.posthog.test/capture/")
    expect(body.properties).toMatchObject({
      merchant_id: "merchant-1",
      customer_id: "customer-1",
      membership_id: "membership-1",
      actor_type: "customer",
      marketing_opt_in: true,
    })
    expect(body.properties).not.toHaveProperty("email")
    expect(body.properties).not.toHaveProperty("phone")
  })

  it("exposes the required MVP event vocabulary for funnel reporting", async () => {
    const { productEventNames } = await import("@/lib/analytics/events")

    expect(productEventNames).toEqual([
      "qr_scanned",
      "join_page_viewed",
      "join_phone_requested",
      "join_otp_verified",
      "join_terms_accepted",
      "customer_joined",
      "customer_card_viewed",
      "stamp_claim_started",
      "stamp_issued",
      "reward_unlocked",
      "reward_redeemed",
      "merchant_signed_up",
      "loyalty_card_created",
      "qr_created",
      "qr_downloaded",
      "qr_enabled",
      "qr_disabled",
      "subscription_started",
      "subscription_cancelled",
      "push_notification_enqueued",
      "push_notification_delivered",
      "push_notification_skipped",
      "push_notification_failed",
      "push_subscription_created",
      "push_subscription_disabled",
      "push_subscription_failed",
      "push_delivery_worker_ran",
      "push_venue_announcement_queued",
    ])
  })

  it("counts all required funnel events from the Supabase source of truth", async () => {
    vi.resetModules()
    const { productEventNames } = await import("@/lib/analytics/events")
    const supabase = createSupabaseMock({
      from: {
        product_events: productEventNames.map((_, index) => ({
          count: index + 1,
          error: null,
        })),
      },
    })
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    const { getPilotFunnelCounts } = await import("@/lib/analytics/funnels")

    await expect(getPilotFunnelCounts()).resolves.toMatchObject({
      qr_scanned: 1,
      customer_joined: 6,
      reward_redeemed: 11,
      qr_created: 14,
      subscription_cancelled: 19,
    })
    expect(
      supabase.queryCalls.filter((call) => call.method === "eq")
    ).toContainEqual({
      table: "product_events",
      method: "eq",
      args: ["event_name", "qr_scanned"],
    })
  })

  it("derives merchant dashboard activity from source tables", async () => {
    vi.resetModules()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-06T12:00:00.000Z"))
    const supabase = createSupabaseMock({
      from: {
        customer_memberships: [
          { count: 10, error: null },
          { count: 2, error: null },
          { count: 4, error: null },
        ],
        stamp_events: [{ count: 18, error: null }],
        reward_events: [{ count: 3, error: null }],
        product_events: [{ count: 5, error: null }],
        billing_customers: [{ data: { status: "active" }, error: null }],
      },
    })
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    const { getMerchantDashboardData } =
      await import("@/lib/merchant/dashboard")

    await expect(
      getMerchantDashboardData({
        id: "merchant-1",
        business_name: "The Bell",
        status: "trial",
      })
    ).resolves.toMatchObject({
      metrics: {
        members: 10,
        newMembers: 2,
        stampsIssued: 18,
        repeatCustomers: 4,
        rewardsRedeemed: 3,
        qrDownloads: 5,
      },
      billingStatus: "active",
    })
    expect(supabase.queryCalls).toContainEqual({
      table: "customer_memberships",
      method: "gte",
      args: ["created_at", "2026-05-30T12:00:00.000Z"],
    })
    expect(supabase.queryCalls).not.toContainEqual({
      table: "product_events",
      method: "limit",
      args: [6],
    })
    vi.useRealTimers()
  })

  it("maps merchant customer activity rows without exposing unnecessary customer fields", async () => {
    vi.resetModules()
    const supabase = createSupabaseMock({
      from: {
        customer_memberships: [
          {
            data: [
              {
                id: "membership-1",
                current_stamp_count: 2,
                total_stamps_earned: 4,
                total_rewards_redeemed: 1,
                last_visit_at: "2026-06-06T10:00:00.000Z",
                created_at: "2026-06-01T10:00:00.000Z",
                customers: [
                  {
                    email: "guest@example.test",
                    phone: null,
                    phone_last4: null,
                  },
                ],
              },
            ],
            error: null,
          },
        ],
        // parallel reads: loyalty_cards (stamp target), unlocked rewards, last redeemed
        loyalty_cards: [{ data: [{ stamps_required: 3 }], error: null }],
        reward_events: [
          { data: [], error: null },
          { data: [], error: null },
        ],
      },
    })
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    const { getMerchantCustomers } = await import("@/lib/merchant/dashboard")

    await expect(getMerchantCustomers("merchant-1")).resolves.toEqual([
      {
        id: "membership-1",
        current_stamp_count: 2,
        total_stamps_earned: 4,
        total_rewards_redeemed: 1,
        last_visit_at: "2026-06-06T10:00:00.000Z",
        created_at: "2026-06-01T10:00:00.000Z",
        stamps_required: 3,
        customer: {
          email: "guest@example.test",
          phone: null,
          phone_last4: null,
        },
        activeReward: null,
        last_redeemed_at: null,
      },
    ])
  })
})

describe("08 pilot readiness micro-spec", () => {
  it("builds pilot report metrics with source labels and target conversion rates", async () => {
    vi.resetModules()
    const supabase = createSupabaseMock({
      from: {
        customer_memberships: [{ count: 1, error: null }],
        merchants: [{ count: 12, error: null }],
        billing_customers: [
          { count: 2, error: null },
          { count: 3, error: null },
          { count: 1, error: null },
          {
            data: [
              { merchant_id: "merchant-1" },
              { merchant_id: "merchant-2" },
            ],
            error: null,
          },
        ],
        product_events: [
          { count: 2, error: null },
          { count: 2, error: null },
          { count: 2, error: null },
          { count: 2, error: null },
          { count: 10, error: null },
          { count: 4, error: null },
          { count: 3, error: null },
          { count: 2, error: null },
          { count: 1, error: null },
          {
            data: [
              { merchant_id: "merchant-1", event_name: "merchant_signed_up" },
              { merchant_id: "merchant-1", event_name: "loyalty_card_created" },
              { merchant_id: "merchant-1", event_name: "qr_created" },
              { merchant_id: "merchant-1", event_name: "qr_downloaded" },
              { merchant_id: "merchant-1", event_name: "customer_joined" },
              { merchant_id: "merchant-1", event_name: "stamp_issued" },
              { merchant_id: "merchant-1", event_name: "reward_redeemed" },
              { merchant_id: "merchant-2", event_name: "merchant_signed_up" },
              { merchant_id: "merchant-2", event_name: "loyalty_card_created" },
              { merchant_id: "merchant-2", event_name: "qr_created" },
              { merchant_id: "merchant-2", event_name: "customer_joined" },
            ],
            error: null,
          },
        ],
        audit_logs: [
          { count: 4, error: null },
          { count: 1, error: null },
          { count: 2, error: null },
        ],
      },
    })
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    const { getAdminPilotReport } = await import("@/lib/admin/data")

    const report = await getAdminPilotReport()

    expect(report.checklist).toContainEqual(
      expect.objectContaining({
        item: "Pilot size",
        target: "10-20 merchants",
        value: 12,
        source: "merchants table",
      })
    )
    expect(report.metrics).toContainEqual(
      expect.objectContaining({
        label: "Scan-to-join rate",
        value: "40%",
        source: "derived from product_events",
        target: "40%+",
      })
    )
    expect(report.metrics).toContainEqual(
      expect.objectContaining({
        label: "First-to-second stamp rate",
        value: "25%",
        target: "25%+",
      })
    )
    expect(report.metrics).toContainEqual(
      expect.objectContaining({
        label: "Trial-to-paid rate",
        value: "50%",
        target: "40-60%",
      })
    )
    expect(report.checklist).toContainEqual(
      expect.objectContaining({
        item: "Self-service launch proof",
        target: "QR and venue checks complete",
        value: 2,
        source: "audit_logs.launch_self_service_checked",
      })
    )
    expect(report.metrics).toContainEqual(
      expect.objectContaining({
        label: "Paid launch proof merchants",
        value: 1,
        source: "billing_customers + product_events",
        target: "At least 1 test merchant",
      })
    )
  })
})
