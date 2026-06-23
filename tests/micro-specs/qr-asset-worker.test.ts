import { readFileSync } from "node:fs"

import { afterEach, describe, expect, it, vi } from "vitest"

import { createSupabaseMock } from "../helpers/supabase"

import type { NextRequest } from "next/server"

// Slice 5/6 — the off-Vercel render worker orchestration (claim → render →
// upload → record ready) and the Chromium-free cron trigger.

const dueJob = {
  id: "job-1",
  qr_code_id: "qr-1",
  merchant_id: "m-1",
  asset_kind: "poster_pdf",
  content_version: "v1",
}

describe("qr asset generation worker", () => {
  it("claims a job to 'rendering', uploads bytes, then records it ready (R16, R17)", async () => {
    vi.resetModules()
    const recordProductEvent = vi.fn(async () => {})
    const upload = vi.fn(async () => ({ data: { path: "p" }, error: null }))
    const base = createSupabaseMock({
      from: {
        qr_asset_jobs: [
          { data: [dueJob], error: null },
          { data: [{ id: "job-1" }], error: null },
        ],
      },
      rpc: { record_qr_asset_generated: [{ data: null, error: null }] },
    })
    const client = {
      ...base.client,
      storage: { from: vi.fn(() => ({ upload })) },
    }
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: () => client,
    }))
    vi.doMock("@/lib/analytics/events", () => ({ recordProductEvent }))
    const renderAsset = vi.fn(async () => new Uint8Array([1, 2, 3, 4]))
    const { runQrAssetGenerationWorker } =
      await import("@/lib/qr/asset-generation-worker")

    const result = await runQrAssetGenerationWorker({
      renderAsset,
      now: new Date("2026-06-23T10:00:00.000Z"),
    })

    expect(result).toMatchObject({ processed: 1, generated: 1, failed: 0 })
    expect(renderAsset).toHaveBeenCalledTimes(1)
    // Claimed to 'rendering' before capture (at-most-once).
    expect(base.queryCalls).toContainEqual({
      table: "qr_asset_jobs",
      method: "update",
      args: [{ status: "rendering" }],
    })
    // Content-addressed upload, then ready — never the reverse.
    expect(client.storage.from).toHaveBeenCalledWith("qr-assets")
    expect(upload).toHaveBeenCalledWith(
      "qr-1/poster_pdf/v1.pdf",
      expect.any(Uint8Array),
      expect.objectContaining({ contentType: "application/pdf", upsert: true })
    )
    expect(
      base.rpcCalls.find((c) => c.name === "record_qr_asset_generated")?.params
    ).toMatchObject({
      p_qr_code_id: "qr-1",
      p_storage_path: "qr-1/poster_pdf/v1.pdf",
      p_content_version: "v1",
      p_byte_size: 4,
    })
  })

  it("skips a job already claimed by another worker (R16)", async () => {
    vi.resetModules()
    const base = createSupabaseMock({
      from: {
        qr_asset_jobs: [
          { data: [dueJob], error: null },
          { data: [], error: null },
        ],
      },
    })
    const client = { ...base.client, storage: { from: vi.fn() } }
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: () => client,
    }))
    vi.doMock("@/lib/analytics/events", () => ({
      recordProductEvent: vi.fn(async () => {}),
    }))
    const renderAsset = vi.fn(async () => new Uint8Array([1]))
    const { runQrAssetGenerationWorker } =
      await import("@/lib/qr/asset-generation-worker")

    const result = await runQrAssetGenerationWorker({ renderAsset })

    expect(result).toMatchObject({ processed: 1, generated: 0, skipped: 1 })
    expect(renderAsset).not.toHaveBeenCalled()
  })

  it("marks a job failed and records the failure when rendering throws", async () => {
    vi.resetModules()
    const recordProductEvent = vi.fn(async () => {})
    const base = createSupabaseMock({
      from: {
        qr_asset_jobs: [
          { data: [dueJob], error: null },
          { data: [{ id: "job-1" }], error: null },
          { data: null, error: null },
        ],
      },
    })
    const client = { ...base.client, storage: { from: vi.fn() } }
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: () => client,
    }))
    vi.doMock("@/lib/analytics/events", () => ({ recordProductEvent }))
    const renderAsset = vi.fn(async () => {
      throw new Error("render boom")
    })
    const { runQrAssetGenerationWorker } =
      await import("@/lib/qr/asset-generation-worker")

    const result = await runQrAssetGenerationWorker({ renderAsset })

    expect(result).toMatchObject({ processed: 1, generated: 0, failed: 1 })
    expect(base.queryCalls).toContainEqual({
      table: "qr_asset_jobs",
      method: "update",
      args: [{ status: "failed", last_error: "render boom" }],
    })
    expect(
      base.rpcCalls.find((c) => c.name === "record_qr_asset_generated")
    ).toBeUndefined()
    expect(recordProductEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: "qr_asset_generation_failed" })
    )
  })

  it("maps asset kinds to content-addressed object paths", async () => {
    vi.resetModules()
    const { qrAssetStoragePath } =
      await import("@/lib/qr/asset-generation-worker")
    expect(
      qrAssetStoragePath({
        id: "j",
        qr_code_id: "qr-1",
        merchant_id: "m",
        asset_kind: "poster_pdf",
        content_version: "v1",
      })
    ).toBe("qr-1/poster_pdf/v1.pdf")
    expect(
      qrAssetStoragePath({
        id: "j",
        qr_code_id: "qr-1",
        merchant_id: "m",
        asset_kind: "till_card_png",
        content_version: "v1",
      })
    ).toBe("qr-1/till_card_png/v1.png")
  })
})

describe("qr asset cron trigger", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  async function callCron(headers: Record<string, string> = {}) {
    vi.resetModules()
    const { GET } = await import("@/app/api/cron/qr-assets/route")
    return GET(
      new Request("https://nabaperks.test/api/cron/qr-assets", {
        headers,
      }) as unknown as NextRequest
    )
  }

  it("rejects an unauthorized cron request (R18)", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret")
    const response = await callCron({ authorization: "Bearer wrong" })
    expect(response.status).toBe(401)
  })

  it("returns a heartbeat when authorized and no worker url is set", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret")
    vi.stubEnv("QR_ASSET_WORKER_URL", "")
    const response = await callCron({ authorization: "Bearer cron-secret" })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      triggered: false,
    })
  })

  it("does not import a browser binary (R19)", () => {
    const source = readFileSync("app/api/cron/qr-assets/route.ts", "utf8")
    // A browser binary would appear as a quoted module specifier; the prose
    // comment that mentions Chromium is not in quotes, so it is not matched.
    expect(source).not.toMatch(
      /["'][^"'\n]*(playwright|chromium|puppeteer)[^"'\n]*["']/i
    )
  })
})
