import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createSupabaseMock } from "../helpers/supabase"

// Focused coverage for the pure helpers and the async Supabase-backed writers in
// `lib/stripe/billing.ts`. The happy-path subset (a handful of status mappings,
// `stripeId` on a string/object, and a populated `subscriptionPeriodEnd`) is
// already asserted by `tests/micro-specs/staff-billing-admin.test.ts`, so this
// file deliberately exercises the *remaining* branches: the rest of the Stripe
// status table, the nullish branches, the empty/missing period edges, and the
// merchant-resolution and error paths of the async functions.

afterEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  vi.doUnmock("@/lib/supabase/server")
})

describe("stripeId", () => {
  it("returns the raw value when given a Stripe id string", async () => {
    const { stripeId } = await import("@/lib/stripe/billing")

    expect(stripeId("cus_abc")).toBe("cus_abc")
  })

  it("reads the id off an expanded Stripe object", async () => {
    const { stripeId } = await import("@/lib/stripe/billing")

    expect(stripeId({ id: "sub_expanded" })).toBe("sub_expanded")
  })

  it("returns null for null, undefined and empty-string inputs", async () => {
    const { stripeId } = await import("@/lib/stripe/billing")

    expect(stripeId(null)).toBeNull()
    expect(stripeId(undefined)).toBeNull()
    // An empty string is falsy, so the guard short-circuits to null rather than
    // returning the empty string.
    expect(stripeId("")).toBeNull()
  })
})

describe("mapStripeSubscriptionStatus", () => {
  it("maps the explicitly handled Stripe statuses to billing statuses", async () => {
    const { mapStripeSubscriptionStatus } = await import("@/lib/stripe/billing")

    expect(mapStripeSubscriptionStatus("trialing")).toBe("trialing")
    expect(mapStripeSubscriptionStatus("active")).toBe("active")
    expect(mapStripeSubscriptionStatus("past_due")).toBe("past_due")
    // Stripe spells it "canceled"; the billing vocabulary is en-GB "cancelled".
    expect(mapStripeSubscriptionStatus("canceled")).toBe("cancelled")
  })

  it("treats every unmapped Stripe status as suspended", async () => {
    const { mapStripeSubscriptionStatus } = await import("@/lib/stripe/billing")

    // None of these fall through to a dedicated billing status, so they all
    // collapse to the protective "suspended" default that gates access.
    const fallthrough = [
      "unpaid",
      "incomplete",
      "incomplete_expired",
      "paused",
    ] as const

    for (const status of fallthrough) {
      expect(mapStripeSubscriptionStatus(status)).toBe("suspended")
    }
  })

  it("returns suspended for an unrecognised status value", async () => {
    const { mapStripeSubscriptionStatus } = await import("@/lib/stripe/billing")

    // Defends the default branch against any future Stripe status the mapper has
    // not been taught about.
    expect(mapStripeSubscriptionStatus("future_status" as never)).toBe(
      "suspended"
    )
  })
})

describe("subscriptionPeriodEnd", () => {
  it("converts the first item's epoch-seconds period end to an ISO string", async () => {
    const { subscriptionPeriodEnd } = await import("@/lib/stripe/billing")

    const result = subscriptionPeriodEnd({
      items: { data: [{ current_period_end: 1_700_000_000 }] },
    } as never)

    // 1_700_000_000 seconds -> milliseconds -> ISO. Asserting the exact instant
    // proves the seconds-to-milliseconds multiplication, not just the shape.
    expect(result).toBe(new Date(1_700_000_000 * 1000).toISOString())
    expect(result).toBe("2023-11-14T22:13:20.000Z")
  })

  it("uses only the first subscription item when several are present", async () => {
    const { subscriptionPeriodEnd } = await import("@/lib/stripe/billing")

    const result = subscriptionPeriodEnd({
      items: {
        data: [
          { current_period_end: 1_700_000_000 },
          { current_period_end: 1_900_000_000 },
        ],
      },
    } as never)

    expect(result).toBe(new Date(1_700_000_000 * 1000).toISOString())
  })

  it("returns null when the subscription has no items", async () => {
    const { subscriptionPeriodEnd } = await import("@/lib/stripe/billing")

    expect(subscriptionPeriodEnd({ items: { data: [] } } as never)).toBeNull()
  })

  it("returns null when the first item is missing a period end", async () => {
    const { subscriptionPeriodEnd } = await import("@/lib/stripe/billing")

    // The item exists but carries no `current_period_end`, so the helper must
    // fall through its guard to null rather than building `new Date(undefined)`.
    expect(subscriptionPeriodEnd({ items: { data: [{}] } } as never)).toBeNull()
  })

  it("returns null when a zero period end slips through", async () => {
    const { subscriptionPeriodEnd } = await import("@/lib/stripe/billing")

    // Epoch 0 is falsy, so the guard treats it the same as a missing value.
    expect(
      subscriptionPeriodEnd({
        items: { data: [{ current_period_end: 0 }] },
      } as never)
    ).toBeNull()
  })
})

describe("syncStripeSubscription", () => {
  function mockSupabase(config?: Parameters<typeof createSupabaseMock>[0]) {
    const supabase = createSupabaseMock(config)
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: () => supabase.client,
    }))
    return supabase
  }

  it("resolves the merchant from subscription metadata when no id is passed", async () => {
    const supabase = mockSupabase({
      from: { billing_customers: [{ data: null, error: null }] },
    })
    const { syncStripeSubscription } = await import("@/lib/stripe/billing")

    await expect(
      syncStripeSubscription({
        subscription: {
          id: "sub_meta",
          customer: "cus_meta",
          status: "trialing",
          metadata: { merchant_id: "merchant-from-metadata" },
          items: { data: [{ current_period_end: 1_700_000_000 }] },
        } as never,
      })
    ).resolves.toEqual({
      merchantId: "merchant-from-metadata",
      status: "trialing",
    })

    // The customer is a bare string id, so it is stored verbatim, and the period
    // end is derived rather than passed through.
    expect(supabase.queryCalls).toContainEqual(
      expect.objectContaining({
        table: "billing_customers",
        method: "upsert",
        args: [
          expect.objectContaining({
            merchant_id: "merchant-from-metadata",
            stripe_customer_id: "cus_meta",
            stripe_subscription_id: "sub_meta",
            plan: "growth",
            status: "trialing",
            current_period_end: new Date(1_700_000_000 * 1000).toISOString(),
          }),
          { onConflict: "merchant_id" },
        ],
      })
    )
    // No lookup query should run when metadata already supplies the merchant.
    expect(supabase.queryCalls.some((call) => call.method === "select")).toBe(
      false
    )
  })

  it("looks the merchant up by subscription id when metadata is absent", async () => {
    const supabase = mockSupabase({
      from: {
        billing_customers: [
          { data: { merchant_id: "merchant-by-sub" }, error: null },
          { data: null, error: null },
        ],
      },
    })
    const { syncStripeSubscription } = await import("@/lib/stripe/billing")

    await expect(
      syncStripeSubscription({
        subscription: {
          id: "sub_lookup",
          customer: { id: "cus_lookup" },
          status: "past_due",
          metadata: {},
          items: { data: [{ current_period_end: 1_700_000_000 }] },
        } as never,
      })
    ).resolves.toEqual({ merchantId: "merchant-by-sub", status: "past_due" })

    // The lookup filters on the subscription id before any customer fallback.
    expect(supabase.queryCalls).toContainEqual(
      expect.objectContaining({
        table: "billing_customers",
        method: "eq",
        args: ["stripe_subscription_id", "sub_lookup"],
      })
    )
  })

  it("falls back to a customer-id lookup when the subscription id misses", async () => {
    const supabase = mockSupabase({
      from: {
        billing_customers: [
          // First maybeSingle (by subscription id) finds nothing...
          { data: null, error: null },
          // ...so the customer-id lookup resolves the merchant.
          { data: { merchant_id: "merchant-by-customer" }, error: null },
          // Final upsert response.
          { data: null, error: null },
        ],
      },
    })
    const { syncStripeSubscription } = await import("@/lib/stripe/billing")

    await expect(
      syncStripeSubscription({
        subscription: {
          id: "sub_fallback",
          customer: "cus_fallback",
          status: "active",
          metadata: {},
          items: { data: [{ current_period_end: 1_700_000_000 }] },
        } as never,
      })
    ).resolves.toEqual({
      merchantId: "merchant-by-customer",
      status: "active",
    })

    expect(supabase.queryCalls).toContainEqual(
      expect.objectContaining({
        table: "billing_customers",
        method: "eq",
        args: ["stripe_customer_id", "cus_fallback"],
      })
    )
  })

  it("throws when no merchant mapping can be resolved", async () => {
    mockSupabase({
      from: {
        billing_customers: [
          { data: null, error: null },
          { data: null, error: null },
        ],
      },
    })
    const { syncStripeSubscription } = await import("@/lib/stripe/billing")

    await expect(
      syncStripeSubscription({
        subscription: {
          id: "sub_orphan",
          customer: "cus_orphan",
          status: "active",
          metadata: {},
          items: { data: [{ current_period_end: 1_700_000_000 }] },
        } as never,
      })
    ).rejects.toThrow(
      "Stripe subscription is missing merchant or customer mapping"
    )
  })

  it("throws when the customer id cannot be derived", async () => {
    mockSupabase()
    const { syncStripeSubscription } = await import("@/lib/stripe/billing")

    await expect(
      syncStripeSubscription({
        merchantId: "merchant-known",
        subscription: {
          id: "sub_no_customer",
          customer: null,
          status: "active",
          metadata: {},
          items: { data: [{ current_period_end: 1_700_000_000 }] },
        } as never,
      })
    ).rejects.toThrow(
      "Stripe subscription is missing merchant or customer mapping"
    )
  })

  it("surfaces the lookup error message when resolution fails", async () => {
    // The subscription-id lookup returns nothing without erroring, so resolution
    // falls through to the customer-id lookup; that second query carries the
    // error, which becomes the final result and is rethrown.
    mockSupabase({
      from: {
        billing_customers: [
          { data: null, error: null },
          { data: null, error: { message: "lookup boom" } },
        ],
      },
    })
    const { syncStripeSubscription } = await import("@/lib/stripe/billing")

    await expect(
      syncStripeSubscription({
        subscription: {
          id: "sub_lookup_error",
          customer: "cus_lookup_error",
          status: "active",
          metadata: {},
          items: { data: [{ current_period_end: 1_700_000_000 }] },
        } as never,
      })
    ).rejects.toThrow("Unable to resolve merchant billing record: lookup boom")
  })

  it("wraps an upsert failure in a billing-sync error", async () => {
    mockSupabase({
      from: {
        billing_customers: [{ data: null, error: { message: "upsert boom" } }],
      },
    })
    const { syncStripeSubscription } = await import("@/lib/stripe/billing")

    await expect(
      syncStripeSubscription({
        merchantId: "merchant-1",
        subscription: {
          id: "sub_upsert_error",
          customer: "cus_1",
          status: "active",
          metadata: {},
          items: { data: [{ current_period_end: 1_700_000_000 }] },
        } as never,
      })
    ).rejects.toThrow("Unable to sync billing state: upsert boom")
  })
})

describe("setBillingStatusForSubscription", () => {
  let supabase: ReturnType<typeof createSupabaseMock>

  beforeEach(() => {
    supabase = createSupabaseMock({
      from: { billing_customers: [{ data: null, error: null }] },
    })
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: () => supabase.client,
    }))
  })

  it("updates the matching subscription's billing status", async () => {
    const { setBillingStatusForSubscription } =
      await import("@/lib/stripe/billing")

    await expect(
      setBillingStatusForSubscription({
        subscriptionId: "sub_update",
        status: "suspended",
      })
    ).resolves.toBeUndefined()

    expect(supabase.queryCalls).toContainEqual(
      expect.objectContaining({
        table: "billing_customers",
        method: "update",
        args: [{ status: "suspended" }],
      })
    )
    expect(supabase.queryCalls).toContainEqual(
      expect.objectContaining({
        table: "billing_customers",
        method: "eq",
        args: ["stripe_subscription_id", "sub_update"],
      })
    )
  })

  it("throws a status-update error when the write fails", async () => {
    // Replace the queued success with a failure for this case.
    supabase = createSupabaseMock({
      from: {
        billing_customers: [{ data: null, error: { message: "update boom" } }],
      },
    })
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: () => supabase.client,
    }))
    const { setBillingStatusForSubscription } =
      await import("@/lib/stripe/billing")

    await expect(
      setBillingStatusForSubscription({
        subscriptionId: "sub_update_error",
        status: "cancelled",
      })
    ).rejects.toThrow("Unable to update billing status: update boom")
  })
})
