import { describe, expect, it, vi } from "vitest"

import { createSupabaseMock } from "../helpers/supabase"

describe("ensure join QR provision", () => {
  it("creates a join QR when setup is complete and none exists", async () => {
    vi.resetModules()
    const supabase = createSupabaseMock({
      rpc: { create_or_get_join_qr: [{ data: null, error: null }] },
    })
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => supabase.client),
    }))
    vi.doMock("@/lib/analytics/events", () => ({
      capturePostHogEvent: vi.fn(),
    }))
    const { ensureJoinQrProvisioned } = await import(
      "@/lib/merchant/ensure-join-qr"
    )

    const result = await ensureJoinQrProvisioned({
      merchantId: "merchant-1",
      activeCard: { id: "card-1" },
      activeRewardPoolItemCount: 3,
      venueReady: true,
      billingReady: true,
      qrCode: null,
    })

    expect(result).toEqual({ provisioned: true, created: true })
    expect(supabase.rpcCalls[0]).toEqual({
      name: "create_or_get_join_qr",
      params: {
        p_merchant_id: "merchant-1",
        p_loyalty_card_id: "card-1",
      },
    })
  })

  it("skips provisioning until setup prerequisites are met", async () => {
    vi.resetModules()
    const supabase = createSupabaseMock()
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => supabase.client),
    }))
    const { ensureJoinQrProvisioned } = await import(
      "@/lib/merchant/ensure-join-qr"
    )

    const result = await ensureJoinQrProvisioned({
      merchantId: "merchant-1",
      activeCard: { id: "card-1" },
      activeRewardPoolItemCount: 2,
      venueReady: true,
      billingReady: true,
      qrCode: null,
    })

    expect(result).toEqual({ provisioned: false, created: false })
    expect(supabase.rpcCalls).toHaveLength(0)
  })
})
