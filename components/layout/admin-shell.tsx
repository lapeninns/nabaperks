import type { ReactNode } from "react"

import { Logo } from "@/components/brand"
import { ShellNavigation, type ShellNavItem } from "./shell-navigation"

const adminNavItems: ShellNavItem[] = [
  { href: "/admin/pilot", label: "Pilot" },
  { href: "/admin/merchants", label: "Merchants" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/billing", label: "Billing" },
  { href: "/admin/privacy", label: "Privacy" },
  { href: "/admin/fraud", label: "Fraud" },
  { href: "/admin/audit", label: "Audit" },
]

export function AdminShell({
  children,
  mfaRequired = false,
}: {
  children: ReactNode
  mfaRequired?: boolean
}) {
  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-40 border-b bg-card/85 backdrop-blur supports-backdrop-filter:bg-card/75">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <Logo href="/admin" label="Stampiee Admin" />
          <ShellNavigation
            items={adminNavItems}
            mobileTitle="Admin navigation"
            mobileDescription="Open support sections for pilot, merchants, customers, billing, privacy, fraud, and audit."
            desktopClassName="md:flex"
          />
        </div>
      </header>
      {mfaRequired ? (
        <div className="border-b border-reward/30 bg-reward/10 px-6 py-3 text-sm font-semibold text-reward-foreground">
          MFA enforcement is enabled for this admin session.
        </div>
      ) : null}
      <main className="mx-auto w-full max-w-7xl px-6 py-8">{children}</main>
    </div>
  )
}

export { adminNavItems }
