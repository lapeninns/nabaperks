import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createSupabaseMock } from "../helpers/supabase"

const MODULE_PATH = "@/lib/stripe/webhook-events"
const TABLE = "stripe_webhook_events"
const FIXED_NOW = new Date("2026-06-19T09:30:00.000Z")

afterEach(() => {
  vi.useRealTimers()
  vi.resetModules()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  vi.doUnmock("@/lib/supabase/server")
})

function mockSupabase(
  responses: Array<{ error: { message: string; code?: string } | null }>
) {
  const supabase = createSupabaseMock({
    from: {
      [TABLE]: responses.map((response) => ({
        data: null,
        error: response.error,
      })),
    },
  })
  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServiceRoleClient: () => supabase.client,
  }))
  return supabase
}

function lastUpdatePayload(supabase: ReturnType<typeof createSupabaseMock>) {
  const updateCall = supabase.queryCalls.find(
    (call) => call.table === TABLE && call.method === "update"
  )
  expect(updateCall).toBeDefined()
  return (updateCall as NonNullable<typeof updateCall>).args[0] as Record<
    string,
    unknown
  >
}

describe("markStripeWebhookEventProcessed", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_NOW)
  })

  it("updates the webhook row with a processed timestamp and clears the last error", async () => {
    const supabase = mockSupabase([{ error: null }])

    const { markStripeWebhookEventProcessed } = await import(MODULE_PATH)
    await expect(
      markStripeWebhookEventProcessed("evt_processed")
    ).resolves.toBeUndefined()

    const payload = lastUpdatePayload(supabase)
    expect(payload).toEqual({
      processed_at: FIXED_NOW.toISOString(),
      last_error: null,
    })
    expect(supabase.queryCalls).toContainEqual(
      expect.objectContaining({
        table: TABLE,
        method: "update",
      })
    )
  })

  it("filters the update to the matching Stripe event id", async () => {
    const supabase = mockSupabase([{ error: null }])

    const { markStripeWebhookEventProcessed } = await import(MODULE_PATH)
    await markStripeWebhookEventProcessed("evt_filter")

    expect(supabase.queryCalls).toContainEqual({
      table: TABLE,
      method: "eq",
      args: ["stripe_event_id", "evt_filter"],
    })
  })

  it("writes the timestamp as the current moment in ISO 8601 form", async () => {
    const supabase = mockSupabase([{ error: null }])

    const { markStripeWebhookEventProcessed } = await import(MODULE_PATH)
    await markStripeWebhookEventProcessed("evt_iso")

    const payload = lastUpdatePayload(supabase)
    expect(payload.processed_at).toBe("2026-06-19T09:30:00.000Z")
    expect(typeof payload.processed_at).toBe("string")
    expect(new Date(payload.processed_at as string).toISOString()).toBe(
      payload.processed_at
    )
  })

  it("throws a descriptive error when the update fails", async () => {
    mockSupabase([{ error: { message: "row not found" } }])

    const { markStripeWebhookEventProcessed } = await import(MODULE_PATH)
    await expect(
      markStripeWebhookEventProcessed("evt_missing")
    ).rejects.toThrow("Unable to mark Stripe webhook processed: row not found")
  })
})

describe("markStripeWebhookEventFailed", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_NOW)
  })

  it("updates the webhook row with a failure timestamp and records the error message", async () => {
    const supabase = mockSupabase([{ error: null }])

    const { markStripeWebhookEventFailed } = await import(MODULE_PATH)
    await expect(
      markStripeWebhookEventFailed("evt_failed", "Stripe signature mismatch")
    ).resolves.toBeUndefined()

    const payload = lastUpdatePayload(supabase)
    expect(payload).toEqual({
      failed_at: FIXED_NOW.toISOString(),
      last_error: "Stripe signature mismatch",
    })
  })

  it("filters the update to the matching Stripe event id", async () => {
    const supabase = mockSupabase([{ error: null }])

    const { markStripeWebhookEventFailed } = await import(MODULE_PATH)
    await markStripeWebhookEventFailed("evt_failed_filter", "boom")

    expect(supabase.queryCalls).toContainEqual({
      table: TABLE,
      method: "eq",
      args: ["stripe_event_id", "evt_failed_filter"],
    })
  })

  it("preserves the supplied error message verbatim without truncation", async () => {
    const longMessage = "x".repeat(2000)
    const supabase = mockSupabase([{ error: null }])

    const { markStripeWebhookEventFailed } = await import(MODULE_PATH)
    await markStripeWebhookEventFailed("evt_long", longMessage)

    const payload = lastUpdatePayload(supabase)
    expect(payload.last_error).toBe(longMessage)
    expect((payload.last_error as string).length).toBe(2000)
  })

  it("does not set a processed timestamp on the failure path", async () => {
    const supabase = mockSupabase([{ error: null }])

    const { markStripeWebhookEventFailed } = await import(MODULE_PATH)
    await markStripeWebhookEventFailed("evt_no_processed", "down")

    const payload = lastUpdatePayload(supabase)
    expect(payload).not.toHaveProperty("processed_at")
    expect(payload).toHaveProperty("failed_at")
  })

  it("throws a descriptive error when the update fails", async () => {
    mockSupabase([{ error: { message: "permission denied" } }])

    const { markStripeWebhookEventFailed } = await import(MODULE_PATH)
    await expect(
      markStripeWebhookEventFailed("evt_err", "original failure")
    ).rejects.toThrow("Unable to mark Stripe webhook failed: permission denied")
  })
})
