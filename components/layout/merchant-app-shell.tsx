import type { ReactNode } from "react"

import { Logo } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { ShellNavigation, type ShellNavItem } from "./shell-navigation"

const merchantNavItems: ShellNavItem[] = [
  { href: "/app", label: "Home" },
  { href: "/app/launch", label: "Launch" },
  { href: "/app/redeem", label: "Redeem" },
  { href: "/app/customers", label: "Customers" },
]

const merchantAccountItems: ShellNavItem[] = [
  { href: "/app/billing", label: "Billing" },
  { href: "/app/settings", label: "ROI settings" },
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
      <header className="sticky top-0 z-40 border-b-2 border-ink bg-card">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Logo href="/app" />
          <div className="flex items-center gap-2">
            <ShellNavigation
              items={merchantNavItems}
              secondaryItems={merchantAccountItems}
              secondaryLabel="Account"
              mobileTitle="Merchant navigation"
              mobileDescription="Move between home, launch setup, reward redemption, and customers. Billing and ROI settings sit under Account."
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
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  )
}

export { merchantNavItems, merchantAccountItems }
