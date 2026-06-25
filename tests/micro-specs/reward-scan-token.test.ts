import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

import { createSupabaseMock } from "../helpers/supabase"

function mockSupabaseClient(client: unknown) {
  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServiceRoleClient: vi.fn(() => client),
  }))
}

async function loadModule() {
  return import("@/lib/customer/reward-scan-token")
}

afterEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.doUnmock("@/lib/supabase/server")
})

describe("createRewardScanToken", () => {
  it("returns the scan token and expiry mapped from the RPC record", async () => {
    const expiresAt = "2026-06-19T12:00:00.000Z"
    const supabase = createSupabaseMock({
      rpc: {
        create_reward_scan_token: [
          {
            data: [{ scan_token: "scan-token-abc", expires_at: expiresAt }],
            error: null,
          },
        ],
      },
    })
    mockSupabaseClient(supabase.client)

    const { createRewardScanToken } = await loadModule()
    const result = await createRewardScanToken({
      rewardId: "reward-1",
      customerId: "customer-1",
    })

    expect(result).toEqual({ scanToken: "scan-token-abc", expiresAt })
  })

  it("passes the reward and customer ids to the create_reward_scan_token RPC", async () => {
    const supabase = createSupabaseMock({
      rpc: {
        create_reward_scan_token: [
          {
            data: [
              {
                scan_token: "scan-token-xyz",
                expires_at: "2026-06-19T13:30:00.000Z",
              },
            ],
            error: null,
          },
        ],
      },
    })
    mockSupabaseClient(supabase.client)

    const { createRewardScanToken } = await loadModule()
    await createRewardScanToken({
      rewardId: "reward-42",
      customerId: "customer-99",
    })

    expect(supabase.rpcCalls).toEqual([
      {
        name: "create_reward_scan_token",
        params: {
          p_reward_event_id: "reward-42",
          p_customer_id: "customer-99",
        },
      },
    ])
  })

  it("reads the first record when the RPC returns an array of rows", async () => {
    const supabase = createSupabaseMock({
      rpc: {
        create_reward_scan_token: [
          {
            data: [
              {
                scan_token: "first-token",
                expires_at: "2026-06-19T14:00:00.000Z",
              },
              {
                scan_token: "second-token",
                expires_at: "2026-06-19T15:00:00.000Z",
              },
            ],
            error: null,
          },
        ],
      },
    })
    mockSupabaseClient(supabase.client)

    const { createRewardScanToken } = await loadModule()
    const result = await createRewardScanToken({
      rewardId: "reward-1",
      customerId: "customer-1",
    })

    expect(result.scanToken).toBe("first-token")
    expect(result.expiresAt).toBe("2026-06-19T14:00:00.000Z")
  })

  it("accepts a single object record rather than an array", async () => {
    const supabase = createSupabaseMock({
      rpc: {
        create_reward_scan_token: [
          {
            data: {
              scan_token: "solo-token",
              expires_at: "2026-06-19T16:00:00.000Z",
            },
            error: null,
          },
        ],
      },
    })
    mockSupabaseClient(supabase.client)

    const { createRewardScanToken } = await loadModule()
    const result = await createRewardScanToken({
      rewardId: "reward-1",
      customerId: "customer-1",
    })

    expect(result).toEqual({
      scanToken: "solo-token",
      expiresAt: "2026-06-19T16:00:00.000Z",
    })
  })

  it("throws with the RPC error message when the RPC fails", async () => {
    const supabase = createSupabaseMock({
      rpc: {
        create_reward_scan_token: [
          { data: null, error: { message: "reward not redeemable" } },
        ],
      },
    })
    mockSupabaseClient(supabase.client)

    const { createRewardScanToken } = await loadModule()

    await expect(
      createRewardScanToken({ rewardId: "reward-1", customerId: "customer-1" })
    ).rejects.toThrow(
      "Unable to create reward scan token: reward not redeemable"
    )
  })

  it("throws when the RPC returns no record", async () => {
    const supabase = createSupabaseMock({
      rpc: {
        create_reward_scan_token: [{ data: null, error: null }],
      },
    })
    mockSupabaseClient(supabase.client)

    const { createRewardScanToken } = await loadModule()

    await expect(
      createRewardScanToken({ rewardId: "reward-1", customerId: "customer-1" })
    ).rejects.toThrow("Unable to create reward scan token.")
  })

  it("throws when the scan token is missing from the record", async () => {
    const supabase = createSupabaseMock({
      rpc: {
        create_reward_scan_token: [
          { data: [{ expires_at: "2026-06-19T17:00:00.000Z" }], error: null },
        ],
      },
    })
    mockSupabaseClient(supabase.client)

    const { createRewardScanToken } = await loadModule()

    await expect(
      createRewardScanToken({ rewardId: "reward-1", customerId: "customer-1" })
    ).rejects.toThrow("Unable to create reward scan token.")
  })

  it("throws when the expiry is missing from the record", async () => {
    const supabase = createSupabaseMock({
      rpc: {
        create_reward_scan_token: [
          { data: [{ scan_token: "token-without-expiry" }], error: null },
        ],
      },
    })
    mockSupabaseClient(supabase.client)

    const { createRewardScanToken } = await loadModule()

    await expect(
      createRewardScanToken({ rewardId: "reward-1", customerId: "customer-1" })
    ).rejects.toThrow("Unable to create reward scan token.")
  })

  it("rejects a blank scan token that is only whitespace", async () => {
    const supabase = createSupabaseMock({
      rpc: {
        create_reward_scan_token: [
          {
            data: [
              { scan_token: "   ", expires_at: "2026-06-19T18:00:00.000Z" },
            ],
            error: null,
          },
        ],
      },
    })
    mockSupabaseClient(supabase.client)

    const { createRewardScanToken } = await loadModule()

    await expect(
      createRewardScanToken({ rewardId: "reward-1", customerId: "customer-1" })
    ).rejects.toThrow("Unable to create reward scan token.")
  })
})

describe("reward QR route hygiene", () => {
  it("lazy-loads pdf-lib only on the PDF poster path", async () => {
    const source = await readSource("lib/qr/assets.ts")

    expect(source).not.toMatch(
      /^import\s+\{\s*PDFDocument\s*\}\s+from\s+["']pdf-lib["']/m
    )
    expect(source).toContain("async function loadPdfDocument()")
    expect(source).toContain('await import("pdf-lib")')
    expect(functionBody(source, "renderQrPosterPdf")).toContain(
      "await loadPdfDocument()"
    )
    expect(functionBody(source, "renderQrCodePng")).not.toContain(
      "loadPdfDocument"
    )
    expect(functionBody(source, "renderQrAssetPng")).not.toContain(
      "loadPdfDocument"
    )
    expect(functionBody(source, "renderQrPosterPng")).not.toContain(
      "loadPdfDocument"
    )
  })

  it("keeps reward ownership prevalidation before creating scan tokens", async () => {
    const source = await readSource("app/reward/[rewardId]/qr.png/route.ts")

    const prevalidationIndex = source.indexOf(
      "await getCustomerRewardState(rewardId)"
    )
    const tokenIndex = source.indexOf("await createRewardScanToken")
    const envIndex = source.indexOf("const serverEnv = getServerEnv()")
    const handlerIndex = source.indexOf("export async function GET")

    expect(source).toContain("import { getCustomerRewardState }")
    expect(prevalidationIndex).toBeGreaterThan(-1)
    expect(tokenIndex).toBeGreaterThan(prevalidationIndex)
    expect(envIndex).toBeGreaterThan(-1)
    expect(envIndex).toBeLessThan(handlerIndex)
    expect(functionBody(source, "GET")).not.toContain("getServerEnv()")
    expect(source).toContain('export const runtime = "nodejs"')
  })
})

async function readSource(relativePath: string): Promise<string> {
  return readFile(join(process.cwd(), relativePath), "utf8")
}

function functionBody(source: string, functionName: string): string {
  const functionStart = source.indexOf(`function ${functionName}`)
  const bodyStart = source.indexOf("{", functionStart)
  expect(functionStart).toBeGreaterThanOrEqual(0)
  expect(bodyStart).toBeGreaterThanOrEqual(0)

  let depth = 0
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index]
    if (char === "{") depth += 1
    if (char === "}") depth -= 1
    if (depth === 0) return source.slice(bodyStart, index + 1)
  }

  throw new Error(`Unable to locate ${functionName} body.`)
}
