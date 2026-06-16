import { describe, expect, it, vi } from "vitest"

import { createSupabaseMock } from "../helpers/supabase"

const MERCHANT = {
  id: "merchant-1",
  business_name: "The Bell",
  status: "trial",
} as const

describe("performance RPC consolidation", () => {
  it("loads merchant dashboard metrics from one RPC when available", async () => {
    // Given: the performance metrics RPC returns the dashboard counts.
    vi.resetModules()
    const supabase = createSupabaseMock({
      rpc: {
        get_merchant_dashboard_metrics: [
          {
            data: [
              {
                members: 10,
                new_members: 2,
                stamps_issued: 18,
                repeat_customers: 4,
                rewards_redeemed: 3,
                qr_downloads: 5,
                billing_status: "active",
              },
            ],
            error: null,
          },
        ],
      },
    })
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    const { getMerchantDashboardData } =
      await import("@/lib/merchant/dashboard")

    // When: dashboard data is loaded for a merchant.
    await expect(getMerchantDashboardData(MERCHANT)).resolves.toMatchObject({
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

    // Then: the loader does not fan out through exact count table reads.
    expect(supabase.rpcCalls).toContainEqual({
      name: "get_merchant_dashboard_metrics",
      params: { target_merchant_id: "merchant-1" },
    })
    expect(supabase.queryCalls).toEqual([])
  })

  it("falls back to table count queries when the dashboard metrics RPC is missing", async () => {
    vi.resetModules()
    const supabase = createSupabaseMock({
      rpc: {
        get_merchant_dashboard_metrics: [
          {
            data: null,
            error: {
              code: "PGRST202",
              message:
                "Could not find the function public.get_merchant_dashboard_metrics(target_merchant_id) in the schema cache",
            },
          },
        ],
      },
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

    await expect(getMerchantDashboardData(MERCHANT)).resolves.toMatchObject({
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

    expect(supabase.rpcCalls).toHaveLength(1)
    expect(supabase.queryCalls.length).toBeGreaterThan(0)
  })

  it("loads pilot funnel event counts from one product-event RPC", async () => {
    // Given: product event counts are available as one grouped RPC response.
    vi.resetModules()
    const supabase = createSupabaseMock({
      rpc: {
        get_product_event_counts: [
          {
            data: [
              { event_name: "qr_scanned", event_count: 10 },
              { event_name: "customer_joined", event_count: 4 },
              { event_name: "reward_redeemed", event_count: 1 },
            ],
            error: null,
          },
        ],
      },
    })
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    const { getPilotFunnelCounts } = await import("@/lib/analytics/funnels")

    // When: the admin funnel count loader runs.
    await expect(getPilotFunnelCounts()).resolves.toMatchObject({
      qr_scanned: 10,
      customer_joined: 4,
      reward_redeemed: 1,
      subscription_cancelled: 0,
    })

    // Then: per-event product_events count queries are avoided.
    expect(supabase.rpcCalls).toHaveLength(1)
    expect(supabase.rpcCalls[0]).toEqual(
      expect.objectContaining({ name: "get_product_event_counts" })
    )
    expect(supabase.queryCalls).toEqual([])
  })

  it("uses grouped event counts inside the admin pilot report", async () => {
    // Given: the pilot report has grouped product-event counts and separate
    // non-event source tables for the remaining metrics.
    vi.resetModules()
    const supabase = createSupabaseMock({
      rpc: {
        get_product_event_counts: [
          {
            data: [
              { event_name: "merchant_signed_up", event_count: 2 },
              { event_name: "loyalty_card_created", event_count: 2 },
              { event_name: "qr_created", event_count: 2 },
              { event_name: "qr_downloaded", event_count: 2 },
              { event_name: "qr_scanned", event_count: 10 },
              { event_name: "customer_joined", event_count: 4 },
              { event_name: "stamp_issued", event_count: 3 },
              { event_name: "reward_unlocked", event_count: 2 },
              { event_name: "reward_redeemed", event_count: 1 },
            ],
            error: null,
          },
        ],
      },
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
        audit_logs: [
          { count: 4, error: null },
          { count: 1, error: null },
          { count: 2, error: null },
        ],
        product_events: [
          {
            data: [
              { merchant_id: "merchant-1", event_name: "merchant_signed_up" },
              { merchant_id: "merchant-1", event_name: "loyalty_card_created" },
              { merchant_id: "merchant-1", event_name: "qr_created" },
              { merchant_id: "merchant-1", event_name: "qr_downloaded" },
              { merchant_id: "merchant-1", event_name: "customer_joined" },
              { merchant_id: "merchant-1", event_name: "stamp_issued" },
              { merchant_id: "merchant-1", event_name: "reward_redeemed" },
            ],
            error: null,
          },
        ],
      },
    })
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    const { getAdminPilotReport } = await import("@/lib/admin/data")

    // When: the pilot report is built.
    const report = await getAdminPilotReport()

    // Then: source-labelled metrics still match, without per-event count reads.
    expect(report.metrics).toContainEqual(
      expect.objectContaining({
        label: "Scan-to-join rate",
        value: "40%",
        source: "derived from product_events",
      })
    )
    expect(supabase.rpcCalls).toContainEqual(
      expect.objectContaining({ name: "get_product_event_counts" })
    )
    expect(
      supabase.queryCalls.filter(
        (call) => call.table === "product_events" && call.method === "eq"
      )
    ).toEqual([])
  })
})
