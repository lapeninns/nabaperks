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
  ScanIcon,
  SecurityCheckIcon,
  Settings01Icon,
  Shield01Icon,
  SquareLockPasswordIcon,
  Store01Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"

import type { IconGlyph } from "@/components/brand"

export type ShellNavItem = {
  href: string
  label: string
  icon?: IconGlyph
  prefetch?: "auto"
  /**
   * Optional task-frequency group. When set, `ConsoleSidebarNav` renders one
   * labelled `SidebarGroup` per distinct value, in first-appearance order.
   * Items without a group render as one unlabelled list, which is what the
   * admin rail still does.
   */
  group?: string
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

// The reward scan-detail flows (/app/rewards/scan/*) have no nav item of their
// own; they live under Activity (collection revalidates the activity feed, and
// the scan 404's CTA already routes back there), so the sidebar highlights a
// section on those screens. `/app/scan` is NO LONGER aliased here — it now has
// its own Counter entry, and leaving it would light two rows at once.
const ACTIVITY_ALIAS_PREFIXES = ["/app/rewards"]

export function isActiveNavItem(
  currentPath: string,
  currentTab: string | null,
  href: string
): boolean {
  const { path, tab: expectedTab } = parseNavHref(href)

  if (
    path === "/app/activity" &&
    ACTIVITY_ALIAS_PREFIXES.some(
      (prefix) => currentPath === prefix || currentPath.startsWith(`${prefix}/`)
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

/**
 * Grouped by how often a venue reaches for the surface, not by build order.
 * The rail used to be one flat list of seven, so a setup-time surface (Setup,
 * Poster) sat at exactly the weight of the counter's daily work and of growth
 * tools a pre-launch venue cannot use yet. `group` drives the labelled
 * `SidebarGroup`s in ConsoleSidebarNav; the array itself stays flat so every
 * existing consumer (and the offers/announcements source contracts) is
 * unchanged.
 *
 * Scan now has an entry of its own. It used to have none at all — it aliased to
 * Activity — so the console's single most-repeated counter action was reachable
 * only by typing the URL or arriving from a members row.
 */
export const merchantNavItems = [
  {
    href: "/app",
    label: "Dashboard",
    icon: Home01Icon,
    prefetch: "auto",
    group: "Counter",
  },
  {
    href: "/app/scan",
    label: "Scan",
    icon: ScanIcon,
    prefetch: "auto",
    group: "Counter",
  },
  {
    href: "/app/qr",
    label: "Poster",
    icon: QrCode01Icon,
    prefetch: "auto",
    group: "Counter",
  },
  {
    href: "/app/customers",
    label: "Members",
    icon: UserMultiple02Icon,
    prefetch: "auto",
    group: "Members",
  },
  {
    href: "/app/activity",
    label: "Activity",
    icon: Activity03Icon,
    prefetch: "auto",
    group: "Members",
  },
  {
    href: "/app/offers",
    label: "Offers",
    icon: DiscountTag01Icon,
    prefetch: "auto",
    group: "Grow",
  },
  {
    href: "/app/announcements",
    label: "Announce",
    icon: Megaphone01Icon,
    group: "Grow",
  },
  {
    href: "/app/launch",
    label: "Setup",
    icon: Settings01Icon,
    group: "Setup",
  },
] satisfies readonly ShellNavItem[]

/** The phone counter rail (`MerchantTabBar`): the four highest-frequency
 *  surfaces. Scan has no sidebar item of its own — it aliases to Activity
 *  there — so the tab bar is the only one-tap route to the scanner. */
export const merchantTabBarItems = [
  { href: "/app", label: "Dashboard", icon: Home01Icon, prefetch: "auto" },
  { href: "/app/scan", label: "Scan", icon: ScanIcon, prefetch: "auto" },
  { href: "/app/qr", label: "Poster", icon: QrCode01Icon },
  {
    href: "/app/customers",
    label: "Members",
    icon: UserMultiple02Icon,
    prefetch: "auto",
  },
] satisfies readonly ShellNavItem[]

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
