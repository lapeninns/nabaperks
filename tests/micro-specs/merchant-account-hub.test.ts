import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

function redirectMock() {
  return vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  })
}

type ElementNode = {
  type?: unknown
  props?: Record<string, unknown> & { children?: unknown }
}

function findByType(node: unknown, type: unknown): ElementNode | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByType(child, type)
      if (found) return found
    }
    return null
  }

  if (!node || typeof node !== "object") return null
  const element = node as ElementNode
  if (element.type === type) return element

  return findByType(element.props?.children, type)
}

describe("merchant account hub micro-spec", () => {
  describe("resolveAccountTab", () => {
    it("defaults to profile and validates known tabs", async () => {
      const { resolveAccountTab, isAccountTab, DEFAULT_ACCOUNT_TAB } =
        await import("@/components/merchant/account/account-tabs")

      expect(DEFAULT_ACCOUNT_TAB).toBe("profile")
      expect(resolveAccountTab(undefined)).toBe("profile")
      expect(resolveAccountTab("nonsense")).toBe("profile")
      expect(resolveAccountTab("billing")).toBe("billing")
      expect(isAccountTab("profile")).toBe(true)
      expect(isAccountTab("orders")).toBe(false)
    })
  })

  describe("hub panel switching", () => {
    async function renderAccount(searchParams: Record<string, string>) {
      vi.resetModules()
      const ProfilePanel = vi.fn(() => null)
      const BillingPanel = vi.fn(() => null)
      const AccountTabBar = vi.fn(() => null)
      vi.doMock("@/components/merchant/account/profile-panel", () => ({
        ProfilePanel,
      }))
      vi.doMock("@/components/merchant/account/billing-panel", () => ({
        BillingPanel,
      }))
      vi.doMock("@/components/merchant/account/account-tab-bar", () => ({
        AccountTabBar,
      }))
      const { default: AccountPage } = await import("@/app/app/account/page")
      const tree = await AccountPage({
        searchParams: Promise.resolve(searchParams),
      })
      return { tree, ProfilePanel, BillingPanel, AccountTabBar }
    }

    it("defaults to the profile panel when tab is missing or invalid", async () => {
      const { tree, ProfilePanel, BillingPanel, AccountTabBar } =
        await renderAccount({})

      expect(findByType(tree, ProfilePanel)).not.toBeNull()
      expect(findByType(tree, BillingPanel)).toBeNull()
      expect(findByType(tree, AccountTabBar)?.props).toMatchObject({
        activeTab: "profile",
      })
    })

    it("renders the billing panel and forwards Stripe outcome params", async () => {
      const { tree, BillingPanel, AccountTabBar } = await renderAccount({
        tab: "billing",
        checkout: "success",
      })

      const panel = findByType(tree, BillingPanel)
      expect(panel).not.toBeNull()
      expect(panel?.props).toMatchObject({
        params: { checkout: "success", portal: undefined },
      })
      expect(findByType(tree, AccountTabBar)?.props).toMatchObject({
        activeTab: "billing",
      })
    })

    it("falls back to the profile panel for removed settings tab links", async () => {
      const { tree, ProfilePanel, BillingPanel } = await renderAccount({
        tab: "settings",
      })

      expect(findByType(tree, ProfilePanel)).not.toBeNull()
      expect(findByType(tree, BillingPanel)).toBeNull()
    })
  })

  describe("legacy redirects", () => {
    it("redirects /app/profile to the Account profile tab", async () => {
      vi.resetModules()
      const redirect = redirectMock()
      vi.doMock("next/navigation", () => ({ redirect }))
      const { default: ProfilePage } = await import("@/app/app/profile/page")

      await expect(ProfilePage()).rejects.toThrow(
        "NEXT_REDIRECT:/app/account?tab=profile"
      )
    })

    it("redirects /app/settings to the Account hub", async () => {
      vi.resetModules()
      const redirect = redirectMock()
      vi.doMock("next/navigation", () => ({ redirect }))
      const { default: SettingsPage } = await import("@/app/app/settings/page")

      await expect(SettingsPage()).rejects.toThrow("NEXT_REDIRECT:/app/account")
    })

    it("redirects /app/billing onto the Billing tab with checkout outcome preserved", async () => {
      vi.resetModules()
      const redirect = redirectMock()
      vi.doMock("next/navigation", () => ({ redirect }))
      const { default: BillingPage } = await import("@/app/app/billing/page")

      await expect(
        BillingPage({ searchParams: Promise.resolve({ checkout: "success" }) })
      ).rejects.toThrow(
        "NEXT_REDIRECT:/app/account?tab=billing&checkout=success"
      )
    })

    it("redirects /app/billing with no params straight to the Billing tab", async () => {
      vi.resetModules()
      const redirect = redirectMock()
      vi.doMock("next/navigation", () => ({ redirect }))
      const { default: BillingPage } = await import("@/app/app/billing/page")

      await expect(
        BillingPage({ searchParams: Promise.resolve({}) })
      ).rejects.toThrow("NEXT_REDIRECT:/app/account?tab=billing")
    })

    it("forwards the portal=missing outcome onto the Billing tab", async () => {
      vi.resetModules()
      const redirect = redirectMock()
      vi.doMock("next/navigation", () => ({ redirect }))
      const { default: BillingPage } = await import("@/app/app/billing/page")

      await expect(
        BillingPage({ searchParams: Promise.resolve({ portal: "missing" }) })
      ).rejects.toThrow("NEXT_REDIRECT:/app/account?tab=billing&portal=missing")
    })
  })

  describe("stripe and navigation contracts", () => {
    it("keeps Stripe checkout, cancel, and portal URLs on /app/billing", () => {
      const billingActions = readProjectFile("app/app/billing/actions.ts")

      expect(billingActions).toContain("/app/billing?checkout=success")
      expect(billingActions).toContain("/app/billing?checkout=cancelled")
      expect(billingActions).toContain("/app/billing?portal=missing")
    })

    it("points the shell account entry and billing CTAs at the Account hub", () => {
      const shell = readProjectFile("components/layout/merchant-app-shell.tsx")
      const billingStatus = readProjectFile(
        "components/merchant/billing-status.tsx"
      )
      const activity = readProjectFile("lib/merchant/activity.ts")

      expect(shell).toContain('href: "/app/account", label: "Account"')
      expect(shell).not.toContain('href: "/app/billing"')
      expect(shell).not.toContain('href: "/app/settings"')
      expect(shell).not.toContain('href: "/app/profile"')
      expect(billingStatus).toContain('actionHref: "/app/account?tab=billing"')
      expect(billingStatus).not.toContain('actionHref: "/app/billing"')
      expect(activity).toContain('href: "/app/account?tab=billing"')
      expect(activity).not.toContain('href: "/app/account?tab=settings"')
    })
  })
})
