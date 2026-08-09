import type { ReactNode } from "react"

import { Logo } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  CUSTOMER_COLUMN_INSET,
  CUSTOMER_COLUMN_MIN_H,
  CUSTOMER_COLUMN_TOP,
} from "./customer-column"
import { CustomerTabBar, TAB_BAR_CLEARANCE } from "./customer-tab-bar"
import { SkipLink } from "./skip-link"

export function CustomerAppShell({
  children,
  signOutAction,
}: {
  children: ReactNode
  signOutAction: React.ComponentProps<"form">["action"]
}) {
  return (
    <div className={cn(CUSTOMER_COLUMN_MIN_H, "bg-background")}>
      <SkipLink />
      <header className="sticky top-0 z-40 border-b-2 border-ink bg-card">
        {/* One customer column: the shared 410px token (CUS-P2-12/16). */}
        {/* py-2, not py-3: the row height is already set by the 44px tap floor on
            both children, so the extra 4px each side was pure chrome on every
            authed screen. Compact logo below sm reclaims width for the action.
            (02#2, partial) */}
        <div className="mx-auto flex w-full max-w-customer items-center justify-between gap-4 px-4 py-2 sm:px-6">
          <Logo href="/home" wordmarkClassName="hidden min-[380px]:inline" />
          <form action={signOutAction}>
            {/* Default size keeps the header action on the 44px tap contract
                (CUS-P2-14). */}
            <Button type="submit" variant="secondary">
              Log out
            </Button>
          </form>
        </div>
      </header>
      {/* Clearance for the fixed bottom bar comes from the bar's own module, so
          the reservation cannot drift from the thing it clears (CUS 02#1). */}
      <main
        id="main"
        className={cn(
          "mx-auto w-full max-w-customer",
          // Gutters and top padding come from the shared customer rhythm so the
          // authed tabs, the flow steps and /q no longer start at three
          // different heights (CUS 02#5).
          CUSTOMER_COLUMN_INSET,
          CUSTOMER_COLUMN_TOP,
          TAB_BAR_CLEARANCE
        )}
      >
        {children}
      </main>
      <CustomerTabBar />
    </div>
  )
}
