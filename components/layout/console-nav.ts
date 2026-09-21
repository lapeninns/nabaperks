import {
  Activity03Icon,
  AlertDiamondIcon,
  AnalyticsUpIcon,
  Building02Icon,
  CreditCardIcon,
  DiscountTag01Icon,
  Home01Icon,
  Megaphone01Icon,
  QrCode01Icon,
  SecurityCheckIcon,
  Settings01Icon,
  Shield01Icon,
  SquareLockPasswordIcon,
  Store01Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"

import { CONSOLE_TAB_ICON, type ConsoleTab } from "@/components/brand/icons"
import type { IconGlyph } from "@/components/brand/icon"

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
// already routes back there), so the sidebar highlights a section on those
// screens.
const ACTIVITY_ALIAS_PREFIXES = ["/app/scan", "/app/rewards"]

// Below the rail breakpoint the console has four tabs, and everything that is
// configured once (poster, members, offers, announcements, setup, account)
// is reached from More. Those routes keep the More tab lit so the operator
// always knows which tab they came through; the rail never renders More and
// highlights the destination itself instead.
const MORE_ALIAS_PREFIXES = [
  "/app/more",
  "/app/qr",
  "/app/customers",
  "/app/offers",
  "/app/announcements",
  "/app/launch",
  "/app/account",
]

function matchesPrefix(currentPath: string, prefixes: readonly string[]) {
  return prefixes.some(
    (prefix) => currentPath === prefix || currentPath.startsWith(`${prefix}/`)
  )
}

export function isActiveNavItem(
  currentPath: string,
  currentTab: string | null,
  href: string
): boolean {
  const { path, tab: expectedTab } = parseNavHref(href)

  if (
    path === "/app/activity" &&
    matchesPrefix(currentPath, ACTIVITY_ALIAS_PREFIXES)
  ) {
    return true
  }

  if (path === "/app/more") {
    return matchesPrefix(currentPath, MORE_ALIAS_PREFIXES)
  }

  if (path === "/app") {
    // Counter is the bare console root only: a `?tab=` on /app is never a
    // Counter view, so the tab bar must not claim it.
    return currentPath === path && expectedTab === null && currentTab === null
  }

  if (path === "/admin") {
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
  { href: "/app", label: "Dashboard", icon: Home01Icon, prefetch: "auto" },
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
  {
    href: "/app/offers",
    label: "Offers",
    icon: DiscountTag01Icon,
    prefetch: "auto",
  },
] satisfies readonly ShellNavItem[]

export type MerchantTabItem = ShellNavItem & { readonly tab: ConsoleTab }

/** The four bottom-tab destinations below the 900px rail breakpoint. */
export const merchantTabItems = [
  {
    tab: "counter",
    href: "/app",
    label: "Counter",
    icon: CONSOLE_TAB_ICON.counter,
    prefetch: "auto",
  },
  {
    tab: "activity",
    href: "/app/activity",
    label: "Activity",
    icon: CONSOLE_TAB_ICON.activity,
    prefetch: "auto",
  },
  {
    tab: "numbers",
    href: "/app/numbers",
    label: "Numbers",
    icon: CONSOLE_TAB_ICON.numbers,
    prefetch: "auto",
  },
  {
    tab: "more",
    href: "/app/more",
    label: "More",
    icon: CONSOLE_TAB_ICON.more,
  },
] as const satisfies readonly MerchantTabItem[]

/**
 * Which bottom tab a merchant route belongs to, or `null` for routes the tab
 * bar does not claim (onboarding, poster print, the offer pass scan). Pure so
 * the routing table is unit-tested once instead of re-derived per component.
 */
export function resolveMerchantTab(
  currentPath: string,
  currentTab: string | null
): ConsoleTab | null {
  const path = currentPath.split(/[?#]/, 1)[0] ?? currentPath
  const item = merchantTabItems.find((candidate) =>
    isActiveNavItem(path, currentTab, candidate.href)
  )
  return item?.tab ?? null
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
  { href: "/admin/evidence", label: "Evidence", icon: AnalyticsUpIcon },
  { href: "/admin/merchants", label: "Merchants", icon: Store01Icon },
  { href: "/admin/customers", label: "Customers", icon: UserMultiple02Icon },
  { href: "/admin/referrals", label: "Referrals", icon: Megaphone01Icon },
  { href: "/admin/billing", label: "Billing", icon: CreditCardIcon },
  { href: "/admin/privacy", label: "Privacy", icon: Shield01Icon },
  { href: "/admin/fraud", label: "Fraud", icon: AlertDiamondIcon },
  { href: "/admin/audit", label: "Audit", icon: SecurityCheckIcon },
  { href: "/admin/security", label: "Security", icon: SquareLockPasswordIcon },
] satisfies readonly ShellNavItem[]
