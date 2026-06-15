import type { ReactNode } from "react"
import {
  AlertDiamondIcon,
  AnalyticsUpIcon,
  CreditCardIcon,
  SecurityCheckIcon,
  Shield01Icon,
  Store01Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"

import { Logo, MonoTag } from "@/components/brand"
import { ShellNavigation, type ShellNavItem } from "./shell-navigation"

const adminNavItems: ShellNavItem[] = [
  { href: "/admin/pilot", label: "Pilot", icon: AnalyticsUpIcon },
  { href: "/admin/merchants", label: "Merchants", icon: Store01Icon },
  { href: "/admin/customers", label: "Customers", icon: UserMultiple02Icon },
  { href: "/admin/billing", label: "Billing", icon: CreditCardIcon },
  { href: "/admin/privacy", label: "Privacy", icon: Shield01Icon },
  { href: "/admin/fraud", label: "Fraud", icon: AlertDiamondIcon },
  { href: "/admin/audit", label: "Audit", icon: SecurityCheckIcon },
]

const supportStatusItems = [
  "Service-role readbacks",
  "Audited support actions",
  "MFA-aware access",
]

export function AdminShell({
  children,
  operatorEmail,
  mfaRequired = false,
}: {
  children: ReactNode
  operatorEmail?: string
  mfaRequired?: boolean
}) {
  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-40 border-b-2 border-ink bg-card">
        <div className="mx-auto grid w-full max-w-7xl gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <Logo href="/admin" label="Nabaperks Admin" />
            <ShellNavigation
              items={adminNavItems}
              mobileTitle="Admin navigation"
              mobileDescription="Open support sections for pilot, merchants, customers, billing, privacy, fraud, and audit."
              desktopClassName="lg:flex"
            />
          </div>
          <div className="hidden items-center justify-between gap-3 overflow-x-auto pb-1 md:flex">
            {operatorEmail ? (
              <MonoTag tone="ink" className="shrink-0">
                Operator: {operatorEmail}
              </MonoTag>
            ) : null}
            {supportStatusItems.map((item) => (
              <MonoTag
                key={item}
                tone="plain"
                className="shrink-0 border-ink bg-background text-muted-foreground"
              >
                {item}
              </MonoTag>
            ))}
            <MonoTag tone="leaf" className="shrink-0">
              {mfaRequired ? "AAL2 verified" : "Admin verified"}
            </MonoTag>
          </div>
        </div>
      </header>
      {mfaRequired ? (
        <div
          role="status"
          className="border-b-2 border-ink bg-reward/12 px-6 py-3 text-sm font-semibold text-reward-foreground"
        >
          MFA enforcement is enabled for this admin session.
        </div>
      ) : null}
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  )
}

export { adminNavItems }
