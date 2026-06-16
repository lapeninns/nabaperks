import type { ReactNode } from "react"
import {
  Activity03Icon,
  Building02Icon,
  Home01Icon,
  Logout01Icon,
  Rocket01Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"

import { Icon, Logo } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { ShellNavigation, type ShellNavItem } from "./shell-navigation"

const merchantNavItems: ShellNavItem[] = [
  { href: "/app", label: "Home", icon: Home01Icon },
  { href: "/app/launch", label: "Launch", icon: Rocket01Icon },
  { href: "/app/customers", label: "Customers", icon: UserMultiple02Icon },
  { href: "/app/activity", label: "Activity", icon: Activity03Icon },
]

const merchantAccountItems: ShellNavItem[] = [
  { href: "/app/account", label: "Account", icon: Building02Icon },
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
              mobileDescription="Move between home, launch setup, customers, and activity. Your business profile and billing sit under Account."
              desktopClassName="md:flex"
            />
            <form action={signOutAction}>
              <Button type="submit" variant="secondary" size="sm">
                <Icon icon={Logout01Icon} size={16} />
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
