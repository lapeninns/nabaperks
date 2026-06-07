import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"

import { createSupabaseMock } from "../helpers/supabase"

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

function redirectMock() {
  return vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  })
}

describe("05 merchant shell, dashboard, customers, activity, and billing readbacks", () => {
  it("keeps the merchant app protected shell and responsive navigation contract", () => {
    const layout = readProjectFile("app/app/layout.tsx")
    const shell = readProjectFile("components/layout/merchant-app-shell.tsx")
    const navigation = readProjectFile("components/layout/shell-navigation.tsx")

    expect(layout).toContain("getCurrentUser")
    expect(layout).toContain('redirect("/login?next=/app")')
    expect(layout).toContain("<MerchantAppShell")
    expect(layout).toContain("signOutAction")
    expect(layout).not.toContain('"use client"')

    for (const href of [
      'href: "/app"',
      'href: "/app/card"',
      'href: "/app/qr"',
      'href: "/app/customers"',
      'href: "/app/activity"',
      'href: "/app/settings"',
      'href: "/app/billing"',
    ]) {
      expect(shell).toContain(href)
    }

    expect(shell).toContain("<form action={signOutAction}")
    expect(navigation).toContain("SheetTitle")
    expect(navigation).toContain("SheetDescription")
    expect(navigation).toContain("aria-current")
    expect(navigation).toContain('aria-label={`${mobileTitle} mobile`}')
  })

  it("preserves the dashboard onboarding gate, merchant-scoped read, and analytics event", async () => {
    vi.resetModules()
    const redirect = redirectMock()
    const merchant = {
      id: "merchant-1",
      business_name: "The Bell",
      status: "active",
      average_order_value_pence: 1200,
      estimated_gross_margin_bps: 6500,
      reward_cost_pence: 250,
    }
    const getMerchantDashboardData = vi.fn(async () => ({
      metrics: {
        members: 1,
        newMembers: 1,
        stampsIssued: 2,
        repeatCustomers: 1,
        rewardsRedeemed: 0,
        qrDownloads: 3,
        estimatedRepeatRevenuePence: 1200,
      },
      billingStatus: "active",
      recentActivity: [],
    }))
    const capturePostHogEvent = vi.fn()

    vi.doMock("next/navigation", () => ({ redirect }))
    vi.doMock("@/lib/merchant/onboarding", () => ({
      getMerchantOnboardingStatus: vi.fn(async () => ({
        status: "complete",
        merchant,
      })),
    }))
    vi.doMock("@/lib/merchant/dashboard", () => ({
      getMerchantDashboardData,
    }))
    vi.doMock("@/lib/analytics/events", () => ({ capturePostHogEvent }))

    const { default: MerchantAppPage } = await import("@/app/app/page")

    await expect(MerchantAppPage()).resolves.toBeDefined()
    expect(redirect).not.toHaveBeenCalled()
    expect(getMerchantDashboardData).toHaveBeenCalledWith(merchant)
    expect(capturePostHogEvent).toHaveBeenCalledWith({
      eventName: "dashboard_viewed",
      merchantId: "merchant-1",
      actorType: "merchant",
      actorId: "merchant-1",
    })
  })

  it("renders dashboard KPI, billing state, empty, launch QR, and activity readback copy", () => {
    const dashboard = readProjectFile("app/app/page.tsx")

    for (const text of [
      "Launch QR",
      "No members yet",
      "Generate QR",
      "Check card setup",
      "Members",
      "New members (7d)",
      "Stamps issued",
      "Repeat customers",
      "Rewards redeemed",
      "QR downloads",
      "Billing status",
      "Estimated repeat revenue",
      "Recent activity",
    ]) {
      expect(dashboard).toContain(text)
    }

    for (const status of [
      "not_started",
      "trialing",
      "active",
      "past_due",
      "cancelled",
      "suspended",
    ]) {
      expect(dashboard).toContain(status)
    }
    expect(dashboard).toContain("Estimate only")
    expect(dashboard).toContain("dashboard.recentActivity")
  })

  it("fetches dashboard metrics, customers, and activity only for the current merchant", async () => {
    vi.resetModules()
    vi.doUnmock("@/lib/merchant/dashboard")
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-06T12:00:00.000Z"))
    const supabase = createSupabaseMock({
      from: {
        customer_memberships: [
          { count: 10, error: null },
          { count: 2, error: null },
          { count: 4, error: null },
          { data: [], error: null },
        ],
        stamp_events: [{ count: 18, error: null }],
        reward_events: [{ count: 3, error: null }],
        product_events: [
          { count: 5, error: null },
          { data: [], error: null },
          { data: [], error: null },
        ],
        billing_customers: [{ data: null, error: null }],
      },
    })
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    const {
      getMerchantActivity,
      getMerchantCustomers,
      getMerchantDashboardData,
    } = await import("@/lib/merchant/dashboard")

    await getMerchantDashboardData({
      id: "merchant-1",
      business_name: "The Bell",
      status: "trialing",
      average_order_value_pence: 1200,
      estimated_gross_margin_bps: 6500,
      reward_cost_pence: 250,
    })
    await getMerchantCustomers("merchant-1")
    await getMerchantActivity("merchant-1")

    expect(
      supabase.queryCalls.filter(
        (call) =>
          call.method === "eq" &&
          call.args[0] === "merchant_id" &&
          call.args[1] === "merchant-1"
      ).length
    ).toBeGreaterThanOrEqual(10)
    expect(supabase.queryCalls).toContainEqual({
      table: "product_events",
      method: "limit",
      args: [6],
    })
    expect(supabase.queryCalls).toContainEqual({
      table: "product_events",
      method: "limit",
      args: [40],
    })
    expect(supabase.queryCalls).toContainEqual({
      table: "product_events",
      method: "order",
      args: ["created_at", { ascending: false }],
    })
    vi.useRealTimers()
  })

  it("keeps customer readbacks privacy-safe with email, phone, and fallback identifiers", async () => {
    const { formatMerchantCustomerIdentifier } = await import(
      "@/components/merchant/customer-readback-table"
    )

    expect(
      formatMerchantCustomerIdentifier({
        email: "guest@example.test",
        phone: "+441234567890",
      })
    ).toBe("guest@example.test")
    expect(
      formatMerchantCustomerIdentifier({
        email: null,
        phone: "+441234567890",
      })
    ).toBe("+441234567890")
    expect(
      formatMerchantCustomerIdentifier({
        email: null,
        phone: null,
      })
    ).toBe("Customer")
    expect(
      formatMerchantCustomerIdentifier({
        email: null,
        phone: null,
        admin_id: "customer-secret",
      } as never)
    ).toBe("Customer")
  })

  it("uses shared data components for customers and activity without raw metadata output", () => {
    const customersPage = readProjectFile("app/app/customers/page.tsx")
    const customerTable = readProjectFile(
      "components/merchant/customer-readback-table.tsx"
    )
    const activityPage = readProjectFile("app/app/activity/page.tsx")
    const activityFeed = readProjectFile("components/data/activity-feed.tsx")

    expect(customersPage).toContain("getCurrentMerchant")
    expect(customersPage).toContain("getMerchantCustomers(merchant.id)")
    expect(customersPage).toContain("CustomerReadbackTable")
    expect(customerTable).toContain("DataTable")
    for (const header of [
      "Customer",
      "Current stamps",
      "Total stamps",
      "Rewards redeemed",
      "Last visit",
    ]) {
      expect(customerTable).toContain(header)
    }

    expect(activityPage).toContain("getCurrentMerchant")
    expect(activityPage).toContain("getMerchantActivity(merchant.id)")
    expect(activityPage).toContain("ActivityFeed")
    expect(activityFeed).toContain("<time")
    expect(activityPage).toContain("metadata.asset_type")
    expect(activityPage).not.toContain("JSON.stringify")
  })

  it("preserves billing outcome states and gates the Stripe portal by customer id", () => {
    const billingPage = readProjectFile("app/app/billing/page.tsx")

    expect(billingPage).toContain("billing_customers")
    expect(billingPage).toContain("stripe_customer_id")
    expect(billingPage).toContain('checkout === "success"')
    expect(billingPage).toContain('checkout === "cancelled"')
    expect(billingPage).toContain('portal === "missing"')
    expect(billingPage).toContain("disabled={!billing?.stripe_customer_id}")
    expect(billingPage).not.toContain("disabled={!billing?.stripe_subscription_id}")
    expect(billingPage).toContain("Start checkout")
    expect(billingPage).toContain("Open Stripe portal")
  })

  it("opens the Stripe portal whenever a billing row has a Stripe customer id", async () => {
    vi.resetModules()
    const redirect = redirectMock()
    const createPortalSession = vi.fn(async () => ({
      url: "https://stripe.test/portal/session",
    }))
    const supabase = createSupabaseMock({
      from: {
        billing_customers: [
          { data: { stripe_customer_id: "cus_123" }, error: null },
        ],
      },
    })

    vi.doMock("next/navigation", () => ({ redirect }))
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentMerchant: vi.fn(async () => ({ id: "merchant-1" })),
    }))
    vi.doMock("@/lib/env/server", () => ({
      getServerEnv: () => ({ NEXT_PUBLIC_APP_URL: "https://stampiee.test" }),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    vi.doMock("@/lib/stripe/server", () => ({
      getStripe: vi.fn(() => ({
        billingPortal: { sessions: { create: createPortalSession } },
      })),
    }))

    const { openCustomerPortalAction } = await import(
      "@/app/app/billing/actions"
    )

    await expect(openCustomerPortalAction()).rejects.toThrow(
      "NEXT_REDIRECT:https://stripe.test/portal/session"
    )
    expect(createPortalSession).toHaveBeenCalledWith({
      customer: "cus_123",
      return_url: "https://stampiee.test/app/billing",
    })
  })

  it("redirects portal attempts to the safe missing state without a Stripe customer id", async () => {
    vi.resetModules()
    const redirect = redirectMock()
    const supabase = createSupabaseMock({
      from: {
        billing_customers: [
          { data: { stripe_customer_id: null }, error: null },
        ],
      },
    })
    vi.doMock("next/navigation", () => ({ redirect }))
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentMerchant: vi.fn(async () => ({ id: "merchant-1" })),
    }))
    vi.doMock("@/lib/env/server", () => ({
      getServerEnv: () => ({ NEXT_PUBLIC_APP_URL: "https://stampiee.test" }),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    vi.doMock("@/lib/stripe/server", () => ({
      getStripe: vi.fn(),
    }))
    const { openCustomerPortalAction } = await import(
      "@/app/app/billing/actions"
    )

    await expect(openCustomerPortalAction()).rejects.toThrow(
      "NEXT_REDIRECT:/app/billing?portal=missing"
    )
  })
})
