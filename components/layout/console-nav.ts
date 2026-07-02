import {
  Activity03Icon,
  AlertDiamondIcon,
  AnalyticsUpIcon,
  Building02Icon,
  CreditCardIcon,
  Home01Icon,
  Megaphone01Icon,
  QrCode01Icon,
  SecurityCheckIcon,
  Settings01Icon,
  Shield01Icon,
  Store01Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"

import type { IconGlyph } from "@/components/brand"

export type ShellNavItem = {
  href: string
  label: string
  icon?: IconGlyph
  prefetch?: "auto"
}

export function isActivePath(currentPath: string, href: string) {
  if (href === "/app" || href === "/admin") {
    return currentPath === href
  }

  return currentPath === href || currentPath.startsWith(`${href}/`)
}

export function parseNavHref(href: string): {
  path: string
  tab: string | null
} {
  const [path, queryString] = href.split("?", 2)

  if (!queryString) {
    return { path, tab: null }
  }

  return { path, tab: new URLSearchParams(queryString).get("tab") }
}

// The counter scan flows have no nav item of their own; they live under
// Activity (collection revalidates the activity feed, and the scan 404's CTA
// already routes back there), so both the sidebar and the tab bar highlight
// a section on those screens.
const ACTIVITY_ALIAS_PREFIXES = ["/app/scan", "/app/rewards"]

export function isActiveNavItem(
  currentPath: string,
  currentTab: string | null,
  href: string
): boolean {
  const { path, tab: expectedTab } = parseNavHref(href)

  if (
    path === "/app/activity" &&
    ACTIVITY_ALIAS_PREFIXES.some(
      (prefix) =>
        currentPath === prefix || currentPath.startsWith(`${prefix}/`)
    )
  ) {
    return true
  }

  if (path === "/app" || path === "/admin") {
    return currentPath === path && expectedTab === null
  }

  if (expectedTab !== null) {
    if (currentPath !== path) {
      return false
    }

    const activeTab = currentTab ?? "profile"
    return expectedTab === activeTab
  }

  return isActivePath(currentPath, href)
}

export const merchantNavItems = [
  { href: "/app", label: "Home", icon: Home01Icon, prefetch: "auto" },
  { href: "/app/launch", label: "Setup", icon: Settings01Icon },
  { href: "/app/qr", label: "Poster", icon: QrCode01Icon, prefetch: "auto" },
  {
    href: "/app/customers",
    label: "Members",
    icon: UserMultiple02Icon,
    prefetch: "auto",
  },
  {
    href: "/app/activity",
    label: "Activity",
    icon: Activity03Icon,
    prefetch: "auto",
  },
  { href: "/app/announcements", label: "Announce", icon: Megaphone01Icon },
] satisfies readonly ShellNavItem[]

/** Primary destinations for the merchant mobile bottom tab bar. */
export const merchantTabBarItems = [
  { href: "/app", label: "Home", icon: Home01Icon, prefetch: "auto" },
  { href: "/app/qr", label: "Poster", icon: QrCode01Icon, prefetch: "auto" },
  {
    href: "/app/customers",
    label: "Members",
    icon: UserMultiple02Icon,
    prefetch: "auto",
  },
  {
    href: "/app/activity",
    label: "Activity",
    icon: Activity03Icon,
    prefetch: "auto",
  },
  {
    href: "/app/account?tab=profile",
    label: "Account",
    icon: Building02Icon,
  },
] satisfies readonly ShellNavItem[]

export function isMerchantTabActive(
  currentPath: string,
  currentTab: string | null,
  href: string
) {
  const { path } = parseNavHref(href)

  if (path === "/app/account") {
    return (
      currentPath === "/app/account" ||
      currentPath.startsWith("/app/account/")
    )
  }

  return isActiveNavItem(currentPath, currentTab, href)
}

export const merchantAccountItems = [
  {
    href: "/app/account?tab=profile",
    label: "Profile",
    icon: Building02Icon,
  },
  {
    href: "/app/account?tab=billing",
    label: "Billing",
    icon: CreditCardIcon,
  },
] satisfies readonly ShellNavItem[]

export const adminNavItems = [
  // The console hub itself — without this entry the overview shows no active
  // item and is unreachable from the sidebar (isActiveNavItem already
  // special-cases the bare "/admin" path).
  { href: "/admin", label: "Overview", icon: Home01Icon },
  { href: "/admin/pilot", label: "Pilot", icon: AnalyticsUpIcon },
  { href: "/admin/merchants", label: "Merchants", icon: Store01Icon },
  { href: "/admin/customers", label: "Customers", icon: UserMultiple02Icon },
  { href: "/admin/billing", label: "Billing", icon: CreditCardIcon },
  { href: "/admin/privacy", label: "Privacy", icon: Shield01Icon },
  { href: "/admin/fraud", label: "Fraud", icon: AlertDiamondIcon },
  { href: "/admin/audit", label: "Audit", icon: SecurityCheckIcon },
] satisfies readonly ShellNavItem[]
