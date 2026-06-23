import { describe, expect, it, vi } from "vitest"

import { createSupabaseMock } from "../helpers/supabase"

// Slice 4 — fallback-first delivery. The download route serves a high-fidelity
// stored asset when one is ready, and otherwise falls back to the synchronous
// SVG renderer with byte-identical headers. The store helper never throws.

const ownedQrContext = {
  merchant: { id: "merchant-1", business_name: "The Bell" },
  location: { name: "Main bar" },
  activeCard: {
    card_name: "Mystery Visit Card",
    reward_name: "Surprise reward",
  },
  qrCode: { id: "qr-row-1", qr_id: "qr-public", is_active: true },
}

function mockDownloadRouteDeps({
  loadReadyQrAssetBytes,
  renderQrPosterPdf,
  renderQrAssetPng,
  capturePostHogEvent,
  supabase,
}: {
  loadReadyQrAssetBytes: ReturnType<typeof vi.fn>
  renderQrPosterPdf: ReturnType<typeof vi.fn>
  renderQrAssetPng: ReturnType<typeof vi.fn>
  capturePostHogEvent: ReturnType<typeof vi.fn>
  supabase: ReturnType<typeof createSupabaseMock>
}) {
  vi.doMock("@/lib/env/server", () => ({
    getServerEnv: () => ({ NEXT_PUBLIC_APP_URL: "https://nabaperks.test" }),
  }))
  vi.doMock("@/lib/merchant/qr-code", () => ({
    getOwnedQrAssetContext: vi.fn(async () => ownedQrContext),
  }))
  vi.doMock("@/lib/analytics/events", () => ({ capturePostHogEvent }))
  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: vi.fn(async () => supabase.client),
  }))
  vi.doMock("@/lib/qr/assets", () => ({
    assetFilename: (kind: string) =>
      kind === "poster_pdf"
        ? "nabaperks-poster-pdf-qr-public.pdf"
        : "nabaperks-till-card-png-qr-public.png",
    assetKindFromSlug: (slug: string) =>
      slug === "poster" ? "poster_pdf" : "till_card_png",
    renderQrPosterPdf,
    renderQrAssetPng,
  }))
  vi.doMock("@/lib/qr/asset-store", () => ({ loadReadyQrAssetBytes }))
}

describe("qr asset fallback-first delivery", () => {
  it("streams the ready stored asset and skips the SVG renderer (R9)", async () => {
    vi.resetModules()
    const supabase = createSupabaseMock({
      rpc: { record_qr_download: [{ data: null, error: null }] },
    })
    const capturePostHogEvent = vi.fn()
    const renderQrPosterPdf = vi.fn(async () => new Uint8Array([4, 5, 6]))
    const renderQrAssetPng = vi.fn(async () => new Uint8Array([1, 2, 3]))
    const loadReadyQrAssetBytes = vi.fn(async () => new Uint8Array([9, 9, 9]))
    mockDownloadRouteDeps({
      loadReadyQrAssetBytes,
      renderQrPosterPdf,
      renderQrAssetPng,
      capturePostHogEvent,
      supabase,
    })
    const { GET } = await import("@/app/app/qr/download/[asset]/route")

    const response = await GET(
      new Request("https://nabaperks.test/app/qr/download/poster?qr=qr-row-1"),
      { params: Promise.resolve({ asset: "poster" }) }
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("application/pdf")
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    expect(response.headers.get("Content-Disposition")).toContain(
      "nabaperks-poster-pdf-qr-public.pdf"
    )
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([
      9, 9, 9,
    ])
    expect(loadReadyQrAssetBytes).toHaveBeenCalledWith("qr-row-1", "poster_pdf")
    expect(renderQrPosterPdf).not.toHaveBeenCalled()
    // Side effects are preserved on the stored branch (R11).
    expect(supabase.rpcCalls[0]?.name).toBe("record_qr_download")
    expect(capturePostHogEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "qr_downloaded",
        qrCodeId: "qr-row-1",
      })
    )
  })

  it("falls back to the SVG renderer with identical headers on a miss (R10)", async () => {
    vi.resetModules()
    const supabase = createSupabaseMock({
      rpc: { record_qr_download: [{ data: null, error: null }] },
    })
    const capturePostHogEvent = vi.fn()
    const renderQrPosterPdf = vi.fn(async () => new Uint8Array([4, 5, 6]))
    const renderQrAssetPng = vi.fn(async () => new Uint8Array([1, 2, 3]))
    const loadReadyQrAssetBytes = vi.fn(async () => null)
    mockDownloadRouteDeps({
      loadReadyQrAssetBytes,
      renderQrPosterPdf,
      renderQrAssetPng,
      capturePostHogEvent,
      supabase,
    })
    const { GET } = await import("@/app/app/qr/download/[asset]/route")

    const response = await GET(
      new Request("https://nabaperks.test/app/qr/download/poster?qr=qr-row-1"),
      { params: Promise.resolve({ asset: "poster" }) }
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("application/pdf")
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    expect(response.headers.get("Content-Disposition")).toContain(
      "nabaperks-poster-pdf-qr-public.pdf"
    )
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([
      4, 5, 6,
    ])
    expect(renderQrPosterPdf).toHaveBeenCalledTimes(1)
    expect(supabase.rpcCalls[0]?.name).toBe("record_qr_download")
  })
})

describe("qr asset store helper", () => {
  it("resolves the newest ready asset scoped to the kind", async () => {
    vi.resetModules()
    const supabase = createSupabaseMock({
      from: {
        qr_asset_jobs: [
          {
            data: {
              storage_path: "qr-row-1/poster_pdf/v1.pdf",
              content_version: "v1",
              byte_size: 4096,
              status: "ready",
            },
            error: null,
          },
        ],
      },
    })
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: () => supabase.client,
    }))
    const { resolveReadyQrAsset } = await import("@/lib/qr/asset-store")

    const result = await resolveReadyQrAsset("qr-row-1", "poster_pdf")

    expect(result).toEqual({
      storagePath: "qr-row-1/poster_pdf/v1.pdf",
      contentVersion: "v1",
      byteSize: 4096,
    })
    expect(supabase.queryCalls).toContainEqual({
      table: "qr_asset_jobs",
      method: "order",
      args: ["created_at", { ascending: false }],
    })
  })

  it("returns null when the newest job is queued so stale ready assets are not served", async () => {
    vi.resetModules()
    const supabase = createSupabaseMock({
      from: {
        qr_asset_jobs: [
          {
            data: {
              storage_path: null,
              content_version: "v2",
              byte_size: null,
              status: "queued",
            },
            error: null,
          },
        ],
      },
    })
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: () => supabase.client,
    }))
    const { resolveReadyQrAsset } = await import("@/lib/qr/asset-store")

    const result = await resolveReadyQrAsset("qr-row-1", "poster_pdf")

    expect(result).toBeNull()
    expect(supabase.queryCalls).not.toContainEqual({
      table: "qr_asset_jobs",
      method: "eq",
      args: ["status", "ready"],
    })
  })

  it("downloads stored bytes from the private bucket", async () => {
    vi.resetModules()
    const download = vi.fn(async () => ({
      data: { arrayBuffer: async () => new Uint8Array([7, 7, 7]).buffer },
      error: null,
    }))
    const from = vi.fn(() => ({ download }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: () => ({ storage: { from } }),
    }))
    const { downloadStoredQrAsset } = await import("@/lib/qr/asset-store")

    const bytes = await downloadStoredQrAsset("qr-row-1/poster_pdf/v1.pdf")

    expect(Array.from(bytes ?? [])).toEqual([7, 7, 7])
    expect(from).toHaveBeenCalledWith("qr-assets")
    expect(download).toHaveBeenCalledWith("qr-row-1/poster_pdf/v1.pdf")
  })

  it("returns null (never throws) when the store is unreachable (R10)", async () => {
    vi.resetModules()
    vi.doMock("@/lib/observability/logger", () => ({
      logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: () => {
        throw new Error("service role unavailable")
      },
    }))
    const { loadReadyQrAssetBytes } = await import("@/lib/qr/asset-store")

    await expect(
      loadReadyQrAssetBytes("qr-row-1", "poster_pdf")
    ).resolves.toBeNull()
  })
})
