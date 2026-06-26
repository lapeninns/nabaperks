import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

describe("merchant setup narrative and shell micro-spec", () => {
  it("keeps the setup narrative governed by the new active micro-spec", () => {
    const spec = readProjectFile(
      "micro-specs/05-merchant-value/03-merchant-setup-narrative-and-shell.md"
    )

    expect(spec).toContain(
      "MS-MERCHANT-VALUE-MERCHANT-SETUP-NARRATIVE-AND-SHELL"
    )
    expect(spec).toContain("risk_class: ui-only")
    expect(spec).toContain("same five-step order")
    expect(spec).toContain("No new dependencies")
    expect(spec).toContain("Stripe")
    expect(spec).toContain("action routing")
  })

  it("derives the onboarding journey from the launch setup labels in launch order", async () => {
    const {
      LAUNCH_CHECKLIST_STEP_ORDER,
      LAUNCH_SETUP_STEP_LABELS,
      MERCHANT_SETUP_STEPS,
    } = await import("@/lib/merchant/launch-readiness-contract")

    expect(MERCHANT_SETUP_STEPS.map((step) => step.id)).toEqual([
      ...LAUNCH_CHECKLIST_STEP_ORDER,
      "qr",
      "billing",
    ])
    expect(MERCHANT_SETUP_STEPS.map((step) => step.title)).toEqual([
      LAUNCH_SETUP_STEP_LABELS.venue,
      LAUNCH_SETUP_STEP_LABELS.card,
      LAUNCH_SETUP_STEP_LABELS.rewards,
      LAUNCH_SETUP_STEP_LABELS.qr,
      LAUNCH_SETUP_STEP_LABELS.billing,
    ])
    expect(MERCHANT_SETUP_STEPS.map((step) => step.title)).toEqual([
      "Business & venue",
      "Your card",
      "Your rewards",
      "Launch kit",
      "Billing",
    ])
    expect(
      MERCHANT_SETUP_STEPS.every((step) => step.description.length > 20)
    ).toBe(true)
  })

  it("uses one shared setup-step definition in production and preview onboarding", () => {
    const onboardingPage = readProjectFile("app/app/onboarding/page.tsx")
    const onboardingPreview = readProjectFile(
      "app/dev/merchant-admin-preview/screens/merchant-onboarding.tsx"
    )
    const launchSpine = readProjectFile(
      "components/merchant/launch-readiness-panel.tsx"
    )
    const launchPreview = readProjectFile("lib/dev/launch-preview.ts")

    expect(onboardingPage).toContain("MERCHANT_SETUP_STEPS")
    expect(onboardingPreview).toContain("MERCHANT_SETUP_STEPS")
    expect(launchSpine).toContain("{step.label}")
    expect(launchSpine).not.toContain("STEP_SHORT")
    expect(launchPreview).toContain("LAUNCH_SETUP_STEP_LABELS.billing")
    expect(launchPreview).not.toContain('label: "Card on file"')
    expect(onboardingPage).not.toContain("const setupSteps")
    expect(onboardingPreview).not.toContain("const setupSteps")
    expect(`${onboardingPage}\n${onboardingPreview}`).not.toContain(
      "Business profile"
    )
    expect(`${onboardingPage}\n${onboardingPreview}`).not.toContain(
      "Mystery card"
    )
  })

  it("keeps a geocoded onboarding venue complete when geofence is off", async () => {
    const { buildLaunchReadiness } =
      await import("@/lib/merchant/launch-readiness")

    const readiness = buildLaunchReadiness({
      activeCard: null,
      activeRewardPoolItemCount: 0,
      qrCode: null,
      location: {
        id: "location-1",
        name: "Main venue",
        address: "1 High Street, London",
        latitude: 51.5,
        longitude: -0.12,
        geofence_radius_meters: 150,
        require_geofence: false,
        geocoded_at: "2026-06-26T09:00:00.000Z",
      },
    })

    expect(readiness.tabs.venue).toBe(true)
    expect(readiness.steps.find((step) => step.id === "venue")).toMatchObject({
      label: "Business & venue",
      ready: true,
    })
  })

  it("uses the shared setup labels in the launch checklist including billing", async () => {
    const { buildLaunchReadiness } =
      await import("@/lib/merchant/launch-readiness")

    const readiness = buildLaunchReadiness({
      activeCard: null,
      activeRewardPoolItemCount: 0,
      qrCode: null,
      location: null,
      billing: {
        requiresBilling: true,
        status: null,
      },
    })

    expect(readiness.checklist.map((step) => step.label)).toEqual([
      "Business & venue",
      "Your card",
      "Your rewards",
      "Launch kit",
      "Billing",
    ])
    expect(readiness.checklist.map((step) => step.label)).not.toContain(
      "Card on file"
    )
  })

  it("uses the setup shell for onboarding and launch", () => {
    const layout = readProjectFile("app/app/layout.tsx")

    expect(layout).toContain("isMerchantSetupPath")
    expect(layout).toContain('path === "/app/onboarding"')
    expect(layout).toContain('path.startsWith("/app/onboarding/")')
    expect(layout).toContain(
      'variant={isMerchantSetupPath(activePath) ? "setup" : "full"}'
    )
    expect(layout).not.toContain("isLaunchSetupPath")
  })

  it("keeps setup billing and account billing cross-linked without rerouting Stripe actions", () => {
    const billingPanel = readProjectFile(
      "components/merchant/account/billing-panel.tsx"
    )
    const launchPage = readProjectFile("app/app/launch/page.tsx")
    const accountPage = readProjectFile("app/app/account/page.tsx")
    const billingActions = readProjectFile("app/app/billing/actions.ts")

    expect(launchPage).toContain('mode="setup"')
    expect(accountPage).toContain("AccountTabBar")
    expect(billingPanel).toContain("Manage billing later in Account")
    expect(billingPanel).toContain("/app/account?tab=billing")
    expect(billingPanel).toContain("Add a card to go live")
    expect(billingPanel).toContain("/app/launch?tab=billing")
    expect(billingActions).toContain("/app/billing?checkout=success")
    expect(billingActions).toContain("/app/billing?portal=missing")
  })

  it("renders a server-side Account tab strip with the active tab marked", async () => {
    const accountPage = readProjectFile("app/app/account/page.tsx")
    const accountPreview = readProjectFile(
      "app/dev/merchant-admin-preview/screens/merchant-account.tsx"
    )
    const { AccountTabBar } = await import(
      "@/components/merchant/account/account-tab-bar"
    )

    const profileHtml = renderToStaticMarkup(
      createElement(AccountTabBar, { activeTab: "profile" })
    )
    const billingHtml = renderToStaticMarkup(
      createElement(AccountTabBar, { activeTab: "billing" })
    )

    expect(profileHtml).toContain('href="/app/account?tab=profile"')
    expect(profileHtml).toContain('href="/app/account?tab=billing"')
    expect(profileHtml).toContain('aria-current="page"')
    expect(profileHtml).toContain("Profile")
    expect(profileHtml).toContain("Billing")
    expect(billingHtml).toContain('aria-current="page"')
    expect(billingHtml.indexOf("Billing")).toBeGreaterThan(
      billingHtml.indexOf("Profile")
    )
    expect(accountPage).toContain("<AccountTabBar activeTab={tab} />")
    expect(accountPreview).toContain("AccountTabBar")
    expect(accountPreview).toContain('activeTab="profile"')
  })
})
