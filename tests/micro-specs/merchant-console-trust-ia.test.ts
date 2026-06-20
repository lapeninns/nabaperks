import { readFileSync } from "node:fs"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createSupabaseMock } from "../helpers/supabase"

afterEach(() => {
  vi.useRealTimers()
})

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

function readMerchantDashboardSurface() {
  return `${readProjectFile("app/app/page.tsx")}\n${readProjectFile(
    "components/merchant/dashboard-home-streams.tsx"
  )}`
}

describe("05 merchant console trust and IA cleanup", () => {
  it("keeps the cleanup scoped in a current micro-spec", () => {
    const spec = readProjectFile(
      "micro-specs/05-merchant-value/02-merchant-console-trust-and-ia-cleanup.md"
    )

    expect(spec).toContain("as the source of truth for this work")
    expect(spec).toContain("Activity is a primary merchant navigation item")
    expect(spec).toContain("Merchant pages must not expose raw full phone")
    expect(spec).toContain("No new dependencies")
    expect(spec).toContain("Alternate stamp verification mechanics")
    expect(spec).toContain("do not override current code")
  })

  it("promotes Activity into primary merchant navigation and simplifies settings", () => {
    const shell = readProjectFile("components/layout/merchant-app-shell.tsx")
    const nav = readProjectFile("components/layout/console-nav.ts")

    expect(nav).toContain('href: "/app/activity"')
    expect(nav).toContain('label: "Activity"')
    expect(nav).toContain('href: "/app/account", label: "Account"')
    expect(nav).not.toContain('href: "/app/settings"')
    expect(nav).not.toContain('href: "/app/profile"')
    expect(shell).toContain("ConsoleSidebarNav")
    expect(shell).toContain("merchantNavItems")
    expect(shell).toContain("merchantAccountItems")
    expect(shell).not.toContain("ROI settings")
    expect(nav).toContain('label: "Home"')
    expect(nav).toContain('label: "Launch"')
    expect(nav).toContain('label: "Customers"')
  })

  it("keeps healthy billing state out of dashboard KPI noise", () => {
    const dashboard = readMerchantDashboardSurface()

    expect(dashboard).not.toContain('"Billing status"')
    expect(dashboard).toContain("MerchantBillingNotice")
    expect(dashboard).not.toContain("function BillingNotice")
    expect(dashboard).not.toContain("billingStateCopy")
  })

  it("uses one billing status copy model across dashboard and billing surfaces", () => {
    const dashboard = readMerchantDashboardSurface()
    const billingPanel = readProjectFile(
      "components/merchant/account/billing-panel.tsx"
    )

    expect(dashboard).toContain("MerchantBillingNotice")
    expect(billingPanel).toContain("MerchantBillingAccessNote")
    expect(billingPanel).not.toContain("function BillingAccessNote")
    expect(billingPanel).not.toContain("function formatStatus")
  })

  it("masks merchant customer identifiers", async () => {
    const { formatMerchantCustomerIdentifier } =
      await import("@/components/merchant/customer-readback-table")
    const identityWithPrivateId = {
      email: null,
      phone: null,
      admin_id: "customer-secret",
    }

    expect(
      formatMerchantCustomerIdentifier({
        email: "guest@example.test",
        phone: "+441234567890",
      })
    ).toBe("g***@example.test")
    expect(
      formatMerchantCustomerIdentifier({
        email: null,
        phone: "+441234567890",
      })
    ).toBe("Phone ending 7890")
    expect(formatMerchantCustomerIdentifier(identityWithPrivateId)).toBe(
      "Customer"
    )
  })

  it("keeps raw customer identity out of merchant activity rows and search text", async () => {
    vi.resetModules()
    vi.doUnmock("@/lib/merchant/activity")
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-06T12:00:00.000Z"))
    const supabase = createSupabaseMock({
      from: {
        product_events: [
          {
            count: 2,
            data: [
              {
                id: "join-event",
                event_name: "customer_joined",
                created_at: "2026-06-06T10:00:00.000Z",
                actor_type: "customer",
                actor_id: "customer-1",
                customer_id: "customer-1",
                membership_id: "membership-1",
                qr_code_id: "qr-1",
                metadata: { marketing_opt_in: true },
                customers: {
                  email: "sam@example.test",
                  phone: "+441234567890",
                },
                customer_memberships: {
                  id: "membership-1",
                  current_stamp_count: 0,
                  total_stamps_earned: 0,
                  total_rewards_redeemed: 0,
                },
                qr_codes: { qr_id: "qr-main", destination_type: "join" },
              },
              {
                id: "stamp-event",
                event_name: "stamp_claim_started",
                created_at: "2026-06-06T09:00:00.000Z",
                actor_type: "customer",
                actor_id: "customer-2",
                customer_id: "customer-2",
                membership_id: "membership-2",
                qr_code_id: null,
                metadata: {},
                customers: { email: null, phone: "+441234567890" },
                customer_memberships: {
                  id: "membership-2",
                  current_stamp_count: 1,
                  total_stamps_earned: 1,
                  total_rewards_redeemed: 0,
                },
                qr_codes: null,
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

    const { getEnrichedMerchantActivity } =
      await import("@/lib/merchant/activity")

    const activity = await getEnrichedMerchantActivity("merchant-1", {
      limit: 25,
    })
    const renderedRows = JSON.stringify(activity.rows)

    expect(activity.rows.map((row) => row.headline)).toEqual([
      "s***@example.test joined",
      "Phone ending 7890 requested a stamp",
    ])
    expect(renderedRows).not.toContain("sam@example.test")
    expect(renderedRows).not.toContain("+441234567890")
    expect(activity.rows.map((row) => row.searchText).join(" ")).not.toContain(
      "sam@example.test"
    )
    vi.useRealTimers()
  })

  it("does not fetch unused recent activity inside dashboard data", async () => {
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
        ],
        stamp_events: [{ count: 18, error: null }],
        reward_events: [{ count: 3, error: null }],
        product_events: [{ count: 5, error: null }],
        billing_customers: [{ data: null, error: null }],
      },
    })
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    const { getMerchantDashboardData } =
      await import("@/lib/merchant/dashboard")

    await getMerchantDashboardData({
      id: "merchant-1",
      business_name: "The Bell",
      status: "trialing",
    })

    expect(supabase.queryCalls).toContainEqual({
      table: "product_events",
      method: "eq",
      args: ["event_name", "qr_downloaded"],
    })
    expect(supabase.queryCalls).not.toContainEqual({
      table: "product_events",
      method: "limit",
      args: [6],
    })
    vi.useRealTimers()
  })
})
