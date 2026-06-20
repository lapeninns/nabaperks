import {
  Activity03Icon,
  AlertDiamondIcon,
  AnalyticsUpIcon,
  Building02Icon,
  CreditCardIcon,
  Home01Icon,
  Rocket01Icon,
  SecurityCheckIcon,
  Shield01Icon,
  Store01Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"

import type { IconGlyph } from "@/components/brand"

export type ShellNavItem = {
  href: string
  label: string
  icon?: IconGlyph
}

export function isActivePath(currentPath: string, href: string) {
  if (href === "/app" || href === "/admin") {
    return currentPath === href
  }

  return currentPath === href || currentPath.startsWith(`${href}/`)
}

export const merchantNavItems = [
  { href: "/app", label: "Home", icon: Home01Icon },
  { href: "/app/launch", label: "Launch", icon: Rocket01Icon },
  { href: "/app/customers", label: "Customers", icon: UserMultiple02Icon },
  { href: "/app/activity", label: "Activity", icon: Activity03Icon },
] satisfies readonly ShellNavItem[]

export const merchantAccountItems = [
  { href: "/app/account", label: "Account", icon: Building02Icon },
] satisfies readonly ShellNavItem[]

export const adminNavItems = [
  { href: "/admin/pilot", label: "Pilot", icon: AnalyticsUpIcon },
  { href: "/admin/merchants", label: "Merchants", icon: Store01Icon },
  { href: "/admin/customers", label: "Customers", icon: UserMultiple02Icon },
  { href: "/admin/billing", label: "Billing", icon: CreditCardIcon },
  { href: "/admin/privacy", label: "Privacy", icon: Shield01Icon },
  { href: "/admin/fraud", label: "Fraud", icon: AlertDiamondIcon },
  { href: "/admin/audit", label: "Audit", icon: SecurityCheckIcon },
] satisfies readonly ShellNavItem[]
