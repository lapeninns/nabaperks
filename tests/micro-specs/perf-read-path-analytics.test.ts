import { describe, expect, it, vi } from "vitest"

type SupabaseInsertResponse = {
  readonly error: { readonly message: string } | null
}

function deferred<T>() {
  let resolveDeferred: ((value: T) => void) | undefined
  const promise = new Promise<T>((resolve) => {
    resolveDeferred = resolve
  })

  if (!resolveDeferred) {
    throw new Error("Deferred resolver was not initialized")
  }

  return { promise, resolve: resolveDeferred }
}

async function flushMicrotasks() {
  for (let index = 0; index < 10; index += 1) {
    await Promise.resolve()
  }
}

describe("baseline performance and read-path analytics", () => {
  it("resolves product event recording after Supabase insert without waiting for slow PostHog fetch", async () => {
    vi.resetModules()
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test")
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://eu.posthog.test")
    const postHogResponse = deferred<Response>()
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      void input
      void init
      return postHogResponse.promise
    })
    vi.stubGlobal("fetch", fetchMock)

    const supabaseResponse = deferred<SupabaseInsertResponse>()
    const insertCalls: unknown[] = []
    const insert = vi.fn((payload: unknown) => {
      insertCalls.push(payload)
      return supabaseResponse.promise
    })
    const supabase = {
      from: vi.fn((table: string) => {
        expect(table).toBe("product_events")
        return { insert }
      }),
    }
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase),
    }))
    const { recordProductEvent } = await import("@/lib/analytics/events")

    let resolved = false
    const recordPromise = recordProductEvent({
      eventName: "customer_card_viewed",
      merchantId: "merchant-1",
      customerId: "customer-1",
      actorType: "customer",
      actorId: "customer-1",
    }).then(() => {
      resolved = true
    })

    await flushMicrotasks()
    expect(resolved).toBe(false)
    expect(insertCalls).toHaveLength(1)

    supabaseResponse.resolve({ error: null })
    await flushMicrotasks()

    expect(resolved).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await recordPromise
  })

  it("schedules dashboard viewed analytics after the merchant dashboard response", async () => {
    vi.resetModules()
    const afterCallbacks: Array<() => void> = []
    const afterMock = vi.fn((callback: () => void) => {
      afterCallbacks.push(callback)
    })
    vi.doMock("next/server", () => ({ after: afterMock }))
    vi.doMock("next/navigation", () => ({
      redirect: vi.fn((url: string) => {
        throw new Error(`NEXT_REDIRECT:${url}`)
      }),
    }))

    const merchant = {
      id: "merchant-1",
      business_name: "The Bell",
      status: "active",
    }
    vi.doMock("@/lib/merchant/onboarding", () => ({
      getMerchantOnboardingStatus: vi.fn(async () => ({
        status: "complete",
        merchant,
      })),
    }))
    vi.doMock("@/lib/merchant/dashboard", () => ({
      getMerchantDashboardData: vi.fn(async () => ({
        metrics: {
          members: 1,
          newMembers: 1,
          stampsIssued: 2,
          repeatCustomers: 1,
          rewardsRedeemed: 0,
          qrDownloads: 3,
        },
        billingStatus: "active",
      })),
    }))
    vi.doMock("@/lib/merchant/activity", () => ({
      getEnrichedMerchantActivity: vi.fn(async () => ({
        rows: [],
        totalCount: 0,
        loadedCount: 0,
        limit: 6,
        hasMore: false,
      })),
    }))
    vi.doMock("@/lib/merchant/launch-readiness", () => ({
      getMerchantLaunchReadiness: vi.fn(async () => ({
        completed: 5,
        total: 5,
        launchReady: true,
        nextStep: null,
        tabs: { card: true, staff: true, qr: true },
        steps: [],
      })),
    }))
    const pendingPostHog = new Promise<void>(() => {})
    const capturePostHogEvent = vi.fn(() => pendingPostHog)
    vi.doMock("@/lib/analytics/events", () => ({ capturePostHogEvent }))
    const { default: MerchantAppPage } = await import("@/app/app/page")

    let rendered = false
    const renderPromise = MerchantAppPage().then(() => {
      rendered = true
    })
    await flushMicrotasks()

    expect(rendered).toBe(true)
    expect(afterMock).toHaveBeenCalledTimes(1)
    expect(capturePostHogEvent).not.toHaveBeenCalled()

    const scheduledCallback = afterCallbacks[0]
    if (!scheduledCallback) {
      throw new Error("Dashboard analytics callback was not scheduled")
    }
    scheduledCallback()

    expect(capturePostHogEvent).toHaveBeenCalledWith({
      eventName: "dashboard_viewed",
      merchantId: "merchant-1",
      actorType: "merchant",
      actorId: "merchant-1",
    })
    await renderPromise
  })

  it("logs server loader timing only when PERF_LOG is enabled", async () => {
    vi.resetModules()
    vi.stubEnv("PERF_LOG", "1")
    const log = vi.spyOn(console, "log").mockImplementation(() => {})
    const { timeServerLoader } = await import("@/lib/perf/server-timing")

    await expect(
      timeServerLoader("/app", "dashboard", async () => "loaded")
    ).resolves.toBe("loaded")

    expect(log).toHaveBeenCalledTimes(1)
    const [line] = log.mock.calls[0] ?? []
    expect(line).toEqual(expect.stringContaining('"route":"/app"'))
    expect(line).toEqual(expect.stringContaining('"loader":"dashboard"'))
    expect(line).toEqual(expect.stringContaining('"ms":'))

    vi.unstubAllEnvs()
    log.mockClear()
    await expect(
      timeServerLoader("/app", "dashboard", async () => "quiet")
    ).resolves.toBe("quiet")
    expect(log).not.toHaveBeenCalled()
  })
})
