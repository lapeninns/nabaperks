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
  activePath,
}: {
  children: ReactNode
  signOutAction: React.ComponentProps<"form">["action"]
  /**
   * Optional active-path override forwarded to `ShellNavigation`. Left undefined
   * for the real authenticated shell (it falls back to `usePathname()`); the
   * `/dev` preview passes the surface's real route so the correct tab lights up.
   */
  activePath?: string
}) {
  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-40 border-b-2 border-ink bg-card">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6">
          {/*
            Mobile shows the ✱ mark only (the wordmark signature) so the three
            controls fit at 375px without clipping "Log out"; the full wordmark
            returns at `sm:`. The link's `aria-label` keeps the accessible name.
          */}
          <Logo href="/app" wordmarkClassName="hidden sm:inline" />
          <div className="flex items-center gap-2">
            <ShellNavigation
              items={merchantNavItems}
              secondaryItems={merchantAccountItems}
              secondaryLabel="Account"
              mobileTitle="Merchant navigation"
              mobileDescription="Move between home, launch setup, customers, and activity. Your business profile and billing sit under Account."
              desktopClassName="md:flex"
              activePath={activePath}
            />
            <form action={signOutAction}>
              {/*
                Default size keeps the logout control at h-11 (44px) for a
                comfortable thumb target and matches the Menu trigger height. The
                visible "Log out" text is the accessible name (leading glyph is
                decorative via the Icon wrapper).
              */}
              <Button type="submit" variant="secondary">
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
