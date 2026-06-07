import type { ReactNode } from "react"

import { Logo } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { ShellNavigation, type ShellNavItem } from "./shell-navigation"

const merchantNavItems: ShellNavItem[] = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/card", label: "Card" },
  { href: "/app/qr", label: "QR" },
  { href: "/app/customers", label: "Customers" },
  { href: "/app/activity", label: "Activity" },
  { href: "/app/settings", label: "Settings" },
  { href: "/app/billing", label: "Billing" },
]

export function MerchantAppShell({
  children,
  signOutAction,
}: {
  children: ReactNode
  signOutAction: React.ComponentProps<"form">["action"]
}) {
  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-40 border-b bg-card/85 backdrop-blur supports-backdrop-filter:bg-card/75">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <Logo href="/app" />
          <div className="flex items-center gap-2">
            <ShellNavigation
              items={merchantNavItems}
              mobileTitle="Merchant navigation"
              mobileDescription="Move between dashboard, setup, QR, customers, activity, settings, and billing."
              desktopClassName="md:flex"
            />
            <form action={signOutAction}>
              <Button type="submit" variant="secondary" size="sm">
                Log out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 py-8">{children}</main>
    </div>
  )
}

export { merchantNavItems }
