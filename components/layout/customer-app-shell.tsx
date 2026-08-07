import type { ReactNode } from "react"

import { Logo } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { CustomerTabBar } from "./customer-tab-bar"
import { SkipLink } from "./skip-link"

export function CustomerAppShell({
  children,
  signOutAction,
}: {
  children: ReactNode
  signOutAction: React.ComponentProps<"form">["action"]
}) {
  return (
    <div className="min-h-svh bg-background">
      <SkipLink />
      <header className="sticky top-0 z-40 border-b-2 border-ink bg-card">
        {/* One customer column: the shared 410px token (CUS-P2-12/16). */}
        <div className="mx-auto flex w-full max-w-customer items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Logo href="/home" />
          <form action={signOutAction}>
            {/* Default size keeps the header action on the 44px tap contract
                (CUS-P2-14). */}
            <Button type="submit" variant="secondary">
              Log out
            </Button>
          </form>
        </div>
      </header>
      {/* pb clears the fixed bottom tab bar + iOS safe area. */}
      <main
        id="main"
        className="mx-auto w-full max-w-customer px-4 pt-6 pb-32 sm:px-6"
      >
        {children}
      </main>
      <CustomerTabBar />
    </div>
  )
}
