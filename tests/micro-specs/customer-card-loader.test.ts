import { afterEach, describe, expect, it, vi } from "vitest"

import { createSupabaseMock } from "../helpers/supabase"

type SupabaseResponse = {
  readonly data: unknown
  readonly error: { readonly message: string } | null
}

type DeferredResponse = {
  readonly promise: Promise<SupabaseResponse>
  readonly resolve: (value: SupabaseResponse) => void
}

type QueryApi = {
  readonly select: (...args: readonly unknown[]) => QueryApi
  readonly eq: (...args: readonly unknown[]) => QueryApi
  readonly order: (...args: readonly unknown[]) => QueryApi
  readonly limit: (...args: readonly unknown[]) => QueryApi
  readonly maybeSingle: () => QueryApi
  readonly then: (
    onFulfilled: ((value: SupabaseResponse) => unknown) | null | undefined,
    onRejected?: ((reason: unknown) => unknown) | null
  ) => Promise<unknown>
}

function deferredResponse(): DeferredResponse {
  let resolveResponse: (value: SupabaseResponse) => void = () => {}
  const promise = new Promise<SupabaseResponse>((resolve) => {
    resolveResponse = resolve
  })

  return { promise, resolve: resolveResponse }
}

function mockCurrentCustomer(id: string | null) {
  vi.doMock("@/lib/customer/identity", () => ({
    getCurrentCustomer: vi.fn(async () => (id ? { id } : null)),
  }))
}

function mockSupabaseClient(client: unknown) {
  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServiceRoleClient: vi.fn(() => client),
  }))
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

async function waitForRequestedTable(
  requestedTables: readonly string[],
  table: string
): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (requestedTables.includes(table)) return
    await Promise.resolve()
  }

  throw new Error(`Expected ${table} to be requested`)
}

function chainQuery(response: Promise<SupabaseResponse>): QueryApi {
  const chain = () => api
  const api: QueryApi = {
    select: vi.fn(chain),
    eq: vi.fn(chain),
    order: vi.fn(chain),
    limit: vi.fn(chain),
    maybeSingle: vi.fn(() => api),
    then: (onFulfilled, onRejected) =>
      response.then(onFulfilled ?? undefined, onRejected ?? undefined),
  }

  return api
}

function concurrentCardSupabaseMock() {
  const loyaltyCard = deferredResponse()
  const latestReward = deferredResponse()
  const billing = deferredResponse()
  const requestedTables: string[] = []
  const membershipResponse = Promise.resolve({
    data: {
      id: "membership-1",
      merchant_id: "merchant-1",
      customer_id: "customer-1",
      current_stamp_count: 2,
      total_rewards_redeemed: 0,
      active_cycle_number: 1,
      merchants: {
        business_name: "The Bell",
        business_slug: "the-bell",
        status: "active",
      },
    },
    error: null,
  })
  const responses = new Map<string, Promise<SupabaseResponse>>([
    ["customer_memberships", membershipResponse],
    ["loyalty_cards", loyaltyCard.promise],
    ["reward_events", latestReward.promise],
    ["billing_customers", billing.promise],
  ])
  const client = {
    from: vi.fn((table: string) => {
      requestedTables.push(table)
      return chainQuery(
        responses.get(table) ?? Promise.resolve({ data: null, error: null })
      )
    }),
  }

  return { billing, client, latestReward, loyaltyCard, requestedTables }
}

describe("customer card loader", () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.doUnmock("@/lib/customer/identity")
    vi.doUnmock("@/lib/supabase/server")
  })

  it("returns unauthenticated before opening a service-role client", async () => {
    vi.resetModules()
    const createSupabaseServiceRoleClient = vi.fn()
    mockCurrentCustomer(null)
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient,
    }))
    const { getCustomerCardState } = await import("@/lib/customer/card")

    await expect(getCustomerCardState("membership-1")).resolves.toEqual({
      status: "unauthenticated",
    })
    expect(createSupabaseServiceRoleClient).not.toHaveBeenCalled()
  })

  it("returns not_found without loading card details", async () => {
    vi.resetModules()
    const supabase = createSupabaseMock({
      from: { customer_memberships: [{ data: null, error: null }] },
    })
    mockCurrentCustomer("customer-1")
    mockSupabaseClient(supabase.client)
    const { getCustomerCardState } = await import("@/lib/customer/card")

    await expect(getCustomerCardState("missing-membership")).resolves.toEqual({
      status: "not_found",
    })
    expect(supabase.client.from).toHaveBeenCalledTimes(1)
  })

  it("returns unauthorized without loading card details", async () => {
    vi.resetModules()
    const supabase = createSupabaseMock({
      from: {
        customer_memberships: [
          {
            data: {
              id: "membership-1",
              merchant_id: "merchant-1",
              customer_id: "customer-2",
              current_stamp_count: 0,
              total_rewards_redeemed: 0,
              active_cycle_number: 1,
              merchants: {
                business_name: "The Bell",
                business_slug: "the-bell",
                status: "active",
              },
            },
            error: null,
          },
        ],
      },
    })
    mockCurrentCustomer("customer-1")
    mockSupabaseClient(supabase.client)
    const { getCustomerCardState } = await import("@/lib/customer/card")

    await expect(getCustomerCardState("membership-1")).resolves.toEqual({
      status: "unauthorized",
    })
    expect(supabase.client.from).toHaveBeenCalledTimes(1)
  })

  it("starts card reward and billing lookups together after authorization", async () => {
    vi.resetModules()
    const supabase = concurrentCardSupabaseMock()
    mockCurrentCustomer("customer-1")
    mockSupabaseClient(supabase.client)
    const { getCustomerCardState } = await import("@/lib/customer/card")

    const state = getCustomerCardState("membership-1")
    await flushMicrotasks()
    await waitForRequestedTable(supabase.requestedTables, "loyalty_cards")
    const tablesBeforeLoyaltyResolves = [...supabase.requestedTables]
    supabase.loyaltyCard.resolve({
      data: {
        card_name: "Mystery Visit Card",
        stamps_required: 3,
        reward_name: "Surprise reward",
        reward_terms: "Complete 3 visits.",
        min_spend_pence: null,
        is_active: true,
      },
      error: null,
    })
    supabase.latestReward.resolve({
      data: {
        id: "reward-1",
        status: "unlocked",
        reward_name: "Coffee upgrade",
        reward_terms: "Valid on one hot drink.",
        min_spend_pence: 250,
        redeemable_from: "2026-06-08",
      },
      error: null,
    })
    supabase.billing.resolve({ data: { status: "active" }, error: null })

    await expect(state).resolves.toMatchObject({
      status: "ready",
      billingStatus: "active",
      latestReward: { id: "reward-1", status: "unlocked" },
      loyaltyCard: { reward_name: "Surprise reward" },
    })
    expect(tablesBeforeLoyaltyResolves).toEqual(
      expect.arrayContaining([
        "loyalty_cards",
        "reward_events",
        "billing_customers",
      ])
    )
  })
})
