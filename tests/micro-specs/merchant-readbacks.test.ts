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

function redirectMock() {
  return vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  })
}

function collectReactText(value: unknown): string {
  if (value == null || typeof value === "boolean") {
    return ""
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value)
  }

  if (Array.isArray(value)) {
    return value.map(collectReactText).join(" ")
  }

  if (typeof value === "object" && "props" in value) {
    return collectReactText(
      (value as { props?: { children?: unknown } }).props?.children
    )
  }

  return ""
}

async function captureErrorMessage(action: () => Promise<unknown>) {
  try {
    await action()
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }

  throw new Error("Expected action to fail")
}

describe("05 merchant shell, dashboard, customers, activity, and billing readbacks", () => {
  it("keeps the merchant app protected shell and responsive navigation contract", () => {
    const layout = readProjectFile("app/app/layout.tsx")
    const loading = readProjectFile("app/app/loading.tsx")
    const shell = readProjectFile("components/layout/merchant-app-shell.tsx")
    const navigation = readProjectFile("components/layout/shell-navigation.tsx")

    expect(layout).toContain("getCurrentUser")
    expect(layout).toContain('redirect("/login?next=/app")')
    expect(layout).toContain("<MerchantAppShell")
    expect(layout).toContain("signOutAction")
    expect(layout).not.toContain('"use client"')

    for (const href of [
      'href: "/app"',
      'href: "/app/launch"',
      'href: "/app/customers"',
      'href: "/app/activity"',
      'href: "/app/account"',
    ]) {
      expect(shell).toContain(href)
    }
    expect(shell).toContain('href: "/app/account", label: "Account"')
    expect(shell).not.toContain('href: "/app/billing"')
    expect(shell).not.toContain('href: "/app/settings"')
    expect(shell).not.toContain("ROI settings")
    expect(shell).toContain("merchantAccountItems")
    expect(shell).toContain("secondaryItems={merchantAccountItems}")

    expect(shell).toContain("<form action={signOutAction}")
    expect(navigation).toContain("SheetTitle")
    expect(navigation).toContain("SheetDescription")
    expect(navigation).toContain("aria-current")
    expect(navigation).toContain("aria-label={`${mobileTitle} mobile`}")
    // Account group renders alongside the primary nav on mobile and desktop.
    expect(navigation).toContain("secondaryItems")
    expect(navigation).toContain("aria-label={`${secondaryLabel} mobile`}")
    expect(navigation).toContain(
      'import Link, { useLinkStatus } from "next/link"'
    )
    expect(navigation).toContain("function NavPendingIndicator")
    expect(navigation).toContain("useLinkStatus()")
    expect(navigation).toContain("<NavPendingIndicator />")
    expect(navigation).toContain("size-1.5")
    expect(navigation).toContain("opacity-0")

    expect(loading).toContain(
      'import { Skeleton } from "@/components/ui/skeleton"'
    )
    expect(loading).toContain('aria-label="Loading merchant workspace"')
    expect(loading).toContain("min-h-[")
    expect(loading).not.toContain("Card")
  })

  it("preserves the dashboard onboarding gate, merchant-scoped read, and analytics event", async () => {
    vi.resetModules()
    const redirect = redirectMock()
    const merchant = {
      id: "merchant-1",
      business_name: "The Bell",
      status: "active",
    }
    const getMerchantDashboardData = vi.fn(async () => ({
      metrics: {
        members: 1,
        newMembers: 1,
        stampsIssued: 2,
        repeatCustomers: 1,
        rewardsRedeemed: 0,
        qrDownloads: 3,
      },
      billingStatus: "active",
      recentActivity: [],
    }))
    const getEnrichedMerchantActivity = vi.fn(async () => ({
      rows: [],
      totalCount: 0,
      loadedCount: 0,
      limit: 6,
      hasMore: false,
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
    vi.doMock("@/lib/merchant/activity", () => ({
      getEnrichedMerchantActivity,
    }))
    vi.doMock("@/lib/analytics/events", () => ({ capturePostHogEvent }))

    const { default: MerchantAppPage } = await import("@/app/app/page")
    const { MerchantCompactActivityStream, MerchantDashboardStream } =
      await import("@/components/merchant/dashboard-home-streams")

    await expect(MerchantAppPage()).resolves.toBeDefined()
    await expect(MerchantDashboardStream({ merchant })).resolves.toBeDefined()
    await expect(
      MerchantCompactActivityStream({ merchantId: merchant.id })
    ).resolves.toBeDefined()
    expect(redirect).not.toHaveBeenCalled()
    expect(getMerchantDashboardData).toHaveBeenCalledWith(merchant)
    expect(getEnrichedMerchantActivity).toHaveBeenCalledWith("merchant-1", {
      limit: 6,
    })
    expect(capturePostHogEvent).toHaveBeenCalledWith({
      eventName: "dashboard_viewed",
      merchantId: "merchant-1",
      actorType: "merchant",
      actorId: "merchant-1",
    })
  })

  it("renders dashboard KPI, billing state, empty, launch QR, and activity readback copy", () => {
    const dashboard = readMerchantDashboardSurface()
    const billingStatus = readProjectFile(
      "components/merchant/billing-status.tsx"
    )

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
      "MerchantBillingNotice",
      "LaunchReadinessPanel",
      "Recent activity",
    ]) {
      expect(dashboard).toContain(text)
    }
    expect(dashboard).not.toContain('"Billing status"')

    for (const status of [
      "not_started",
      "trialing",
      "active",
      "past_due",
      "cancelled",
      "suspended",
    ]) {
      expect(billingStatus).toContain(status)
    }
    expect(dashboard).not.toContain("Estimate only")
    expect(dashboard).toContain("ActivityCompactFeed")
    expect(dashboard).toContain("getEnrichedMerchantActivity")
    expect(dashboard).toContain(
      "<Suspense fallback={<MerchantDashboardSkeleton />}>"
    )
    expect(dashboard).toContain("<MerchantDashboardStream")
    expect(dashboard).toContain("<MerchantCompactActivityStream")
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
    ).toBeGreaterThanOrEqual(9)
    expect(supabase.queryCalls).not.toContainEqual({
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

  it("threads stamp claim and issue events into merchant-safe activity rows", async () => {
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
                id: "issued-event",
                event_name: "stamp_issued",
                created_at: "2026-06-06T10:05:00.000Z",
                actor_type: "staff",
                actor_id: "staff-1",
                customer_id: "customer-1",
                membership_id: "membership-1",
                qr_code_id: null,
                metadata: { new_stamp_count: 2, business_date: "2026-06-06" },
                customers: { email: "sam@example.test", phone: null },
                customer_memberships: {
                  id: "membership-1",
                  current_stamp_count: 2,
                  total_stamps_earned: 2,
                  total_rewards_redeemed: 0,
                },
                qr_codes: null,
              },
              {
                id: "claim-event",
                event_name: "stamp_claim_started",
                created_at: "2026-06-06T10:02:00.000Z",
                actor_type: "customer",
                actor_id: "customer-1",
                customer_id: "customer-1",
                membership_id: "membership-1",
                qr_code_id: null,
                metadata: {},
                customers: { email: "sam@example.test", phone: null },
                customer_memberships: {
                  id: "membership-1",
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
        staff_users: [
          {
            data: [{ id: "staff-1", display_name: "Mia", role: "owner" }],
            error: null,
          },
        ],
      },
    })
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))

    const { getEnrichedMerchantActivity, summarizeActivity } =
      await import("@/lib/merchant/activity")

    const activity = await getEnrichedMerchantActivity("merchant-1", {
      limit: 100,
    })

    expect(activity.totalCount).toBe(2)
    expect(activity.loadedCount).toBe(2)
    expect(activity.rows).toHaveLength(1)
    expect(activity.rows[0].headline).toBe(
      "s***@example.test collected stamp 2"
    )
    expect(activity.rows[0].summary).toContain("grouped into one visit")
    expect(activity.rows[0].details.map((detail) => detail.label)).toContain(
      "Claim opened"
    )
    expect(activity.rows[0].primaryAction).toEqual({
      label: "View customer",
      href: "/app/customers?highlight=membership-1",
    })
    expect(activity.rows[0].secondaryAction).toEqual({
      label: "Open QR setup",
      href: "/app/launch?tab=qr",
    })
    expect(JSON.stringify(activity.rows)).not.toContain("/card/")
    expect(summarizeActivity(activity.rows).stamps).toBe(1)
    vi.useRealTimers()
  })

  it("keeps activity headlines short and event-led", async () => {
    vi.resetModules()
    vi.doUnmock("@/lib/merchant/activity")
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-06T12:00:00.000Z"))
    const supabase = createSupabaseMock({
      from: {
        product_events: [
          {
            count: 3,
            data: [
              {
                id: "redeemed-event",
                event_name: "reward_redeemed",
                created_at: "2026-06-06T11:00:00.000Z",
                actor_type: "staff",
                actor_id: "staff-1",
                customer_id: "customer-1",
                membership_id: "membership-1",
                qr_code_id: null,
                metadata: { reward_name: "Free coffee", new_stamp_count: 0 },
                customers: { email: "sam@example.test", phone: null },
                customer_memberships: {
                  id: "membership-1",
                  current_stamp_count: 0,
                  total_stamps_earned: 3,
                  total_rewards_redeemed: 1,
                },
                qr_codes: null,
              },
              {
                id: "joined-event",
                event_name: "customer_joined",
                created_at: "2026-06-06T10:00:00.000Z",
                actor_type: "customer",
                actor_id: "customer-2",
                customer_id: "customer-2",
                membership_id: "membership-2",
                qr_code_id: "qr-1",
                metadata: { marketing_opt_in: true },
                customers: { email: "mina@example.test", phone: null },
                customer_memberships: {
                  id: "membership-2",
                  current_stamp_count: 0,
                  total_stamps_earned: 0,
                  total_rewards_redeemed: 0,
                },
                qr_codes: { qr_id: "qr-main", destination_type: "join" },
              },
              {
                id: "stamp-event",
                event_name: "stamp_issued",
                created_at: "2026-06-06T09:00:00.000Z",
                actor_type: "staff",
                actor_id: "staff-1",
                customer_id: "customer-3",
                membership_id: "membership-3",
                qr_code_id: null,
                metadata: { new_stamp_count: 3, business_date: "2026-06-06" },
                customers: { email: "alex@example.test", phone: null },
                customer_memberships: {
                  id: "membership-3",
                  current_stamp_count: 3,
                  total_stamps_earned: 3,
                  total_rewards_redeemed: 0,
                },
                qr_codes: null,
              },
            ],
            error: null,
          },
        ],
        staff_users: [
          {
            data: [{ id: "staff-1", display_name: "Mia", role: "owner" }],
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

    expect(activity.rows.map((row) => row.headline)).toEqual([
      "s***@example.test redeemed Free coffee",
      "m***@example.test joined",
      "a***@example.test collected stamp 3",
    ])
    vi.useRealTimers()
  })

  it("keeps customer readbacks privacy-safe with email, phone, and fallback identifiers", async () => {
    const { formatMerchantCustomerIdentifier } =
      await import("@/components/merchant/customer-readback-table")

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
    expect(
      formatMerchantCustomerIdentifier({
        email: null,
        phone: null,
      })
    ).toBe("Customer")
    const identityWithPrivateId = {
      email: null,
      phone: null,
      admin_id: "customer-secret",
    }
    expect(formatMerchantCustomerIdentifier(identityWithPrivateId)).toBe(
      "Customer"
    )
  })

  it("uses shared data components for customers and activity without raw metadata output", () => {
    const customersPage = readProjectFile("app/app/customers/page.tsx")
    const customerTable = readProjectFile(
      "components/merchant/customer-readback-table.tsx"
    )
    const activityPage = readProjectFile("app/app/activity/page.tsx")
    const activityFeed = readProjectFile(
      "components/merchant/activity-detail-feed.tsx"
    )

    expect(customersPage).toContain("getCurrentMerchant")
    expect(customersPage).toContain("getMerchantCustomers(merchant.id)")
    expect(customersPage).toContain("CustomerReadbackTable")
    expect(customersPage).toContain("highlightedMembershipId")
    expect(customerTable).toContain("DataTable")
    expect(customerTable).toContain("rowClassName")
    for (const header of [
      "Member",
      "Joined",
      "Stamps",
      "Last visit",
      "Reward",
    ]) {
      expect(customerTable).toContain(header)
    }
    // Privacy: table must use the masked view model, never raw email/phone columns
    expect(customerTable).not.toContain("current_stamp_count")
    expect(customerTable).not.toContain("total_stamps_earned")

    expect(activityPage).toContain("getCurrentMerchant")
    expect(activityPage).toContain(
      "getEnrichedMerchantActivity(merchantId, { limit })"
    )
    expect(activityPage).toContain("async function ActivityFeedStream")
    expect(activityPage).toContain(
      "<Suspense fallback={<ActivityFeedSkeleton />}>"
    )
    expect(activityPage).toContain("<ActivityFeedStream")
    expect(activityPage).toContain("ActivityDetailFeed")
    expect(activityFeed).toContain("<time")
    expect(activityFeed).toContain("aria-pressed")
    expect(activityFeed).toContain("Load more")
    expect(activityFeed).not.toContain("/card/")
    expect(activityPage).not.toContain("JSON.stringify")
  })

  it("preserves billing outcome states and gates the Stripe portal by customer id", () => {
    const billingPanel = readProjectFile(
      "components/merchant/account/billing-panel.tsx"
    )
    const billingData = readProjectFile("lib/merchant/billing.ts")

    expect(billingData).toContain("billing_customers")
    expect(billingData).toContain("stripe_customer_id")
    expect(billingPanel).toContain("stripe_customer_id")
    expect(billingPanel).toContain('checkout === "success"')
    expect(billingPanel).toContain('checkout === "cancelled"')
    expect(billingPanel).toContain('portal === "missing"')
    expect(billingPanel).toContain("disabled={!billing?.stripe_customer_id}")
    expect(billingPanel).not.toContain(
      "disabled={!billing?.stripe_subscription_id}"
    )
    expect(billingPanel).toContain("Start checkout")
    expect(billingPanel).toContain("Open Stripe portal")
  })

  it("renders safe billing load failure copy without raw Supabase details", async () => {
    vi.resetModules()
    const internalSupabaseMessage =
      "SUPABASE-INTERNAL billing_customers policy stack trace 42"
    const supabase = createSupabaseMock({
      from: {
        billing_customers: [
          { data: null, error: { message: internalSupabaseMessage } },
        ],
      },
    })

    vi.doMock("next/navigation", () => ({ redirect: redirectMock() }))
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentMerchant: vi.fn(async () => ({ id: "merchant-1" })),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))

    const { BillingPanel } =
      await import("@/components/merchant/account/billing-panel")
    const output = await BillingPanel({ params: {} })
    const renderedText = collectReactText(output)

    expect(renderedText).toContain(
      "Billing details could not be loaded. Try again."
    )
    expect(renderedText).not.toContain(internalSupabaseMessage)
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
      getServerEnv: () => ({ NEXT_PUBLIC_APP_URL: "https://nabaperks.test" }),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    vi.doMock("@/lib/stripe/server", () => ({
      getStripe: vi.fn(() => ({
        billingPortal: { sessions: { create: createPortalSession } },
      })),
    }))

    const { openCustomerPortalAction } =
      await import("@/app/app/billing/actions")

    await expect(openCustomerPortalAction()).rejects.toThrow(
      "NEXT_REDIRECT:https://stripe.test/portal/session"
    )
    expect(createPortalSession).toHaveBeenCalledWith({
      customer: "cus_123",
      return_url: "https://nabaperks.test/app/billing",
    })
  })

  it("maps portal billing lookup errors to safe copy without raw Supabase details", async () => {
    vi.resetModules()
    const internalSupabaseMessage =
      "SUPABASE-INTERNAL portal lookup leaked table names"
    const getStripe = vi.fn()
    const supabase = createSupabaseMock({
      from: {
        billing_customers: [
          { data: null, error: { message: internalSupabaseMessage } },
        ],
      },
    })

    vi.doMock("next/navigation", () => ({ redirect: redirectMock() }))
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentMerchant: vi.fn(async () => ({ id: "merchant-1" })),
    }))
    vi.doMock("@/lib/env/server", () => ({
      getServerEnv: () => ({ NEXT_PUBLIC_APP_URL: "https://nabaperks.test" }),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    vi.doMock("@/lib/stripe/server", () => ({ getStripe }))

    const { openCustomerPortalAction } =
      await import("@/app/app/billing/actions")

    const errorMessage = await captureErrorMessage(openCustomerPortalAction)

    expect(errorMessage).toBe(
      "Billing action could not be completed. Try again."
    )
    expect(errorMessage).not.toContain(internalSupabaseMessage)
    expect(getStripe).not.toHaveBeenCalled()
  })

  it("maps Stripe portal exceptions to safe copy without raw Stripe details", async () => {
    vi.resetModules()
    const internalStripeMessage =
      "STRIPE-INTERNAL portal session request id req_secret"
    const createPortalSession = vi.fn(async () => {
      throw new Error(internalStripeMessage)
    })
    const supabase = createSupabaseMock({
      from: {
        billing_customers: [
          { data: { stripe_customer_id: "cus_123" }, error: null },
        ],
      },
    })

    vi.doMock("next/navigation", () => ({ redirect: redirectMock() }))
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentMerchant: vi.fn(async () => ({ id: "merchant-1" })),
    }))
    vi.doMock("@/lib/env/server", () => ({
      getServerEnv: () => ({ NEXT_PUBLIC_APP_URL: "https://nabaperks.test" }),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    vi.doMock("@/lib/stripe/server", () => ({
      getStripe: vi.fn(() => ({
        billingPortal: { sessions: { create: createPortalSession } },
      })),
    }))

    const { openCustomerPortalAction } =
      await import("@/app/app/billing/actions")

    const errorMessage = await captureErrorMessage(openCustomerPortalAction)

    expect(errorMessage).toBe(
      "Billing action could not be completed. Try again."
    )
    expect(errorMessage).not.toContain(internalStripeMessage)
    expect(createPortalSession).toHaveBeenCalledWith({
      customer: "cus_123",
      return_url: "https://nabaperks.test/app/billing",
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
      getServerEnv: () => ({ NEXT_PUBLIC_APP_URL: "https://nabaperks.test" }),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    vi.doMock("@/lib/stripe/server", () => ({
      getStripe: vi.fn(),
    }))
    const { openCustomerPortalAction } =
      await import("@/app/app/billing/actions")

    await expect(openCustomerPortalAction()).rejects.toThrow(
      "NEXT_REDIRECT:/app/billing?portal=missing"
    )
  })
})
