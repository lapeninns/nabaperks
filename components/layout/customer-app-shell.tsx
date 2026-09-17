import type { ReactNode } from "react"

import { Logo } from "@/components/brand"
import { CustomerTabBar } from "./customer-tab-bar"

export function CustomerAppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-40 border-b-2 border-ink bg-card">
        {/* One customer column: the shared 410px token (CUS-P2-12/16). The header's
            resting state is the wordmark alone, centred — the screen's own task
            owns the page, and the destructive account action sits in Profile. */}
        <div className="mx-auto flex w-full max-w-customer items-center justify-center px-4 py-3 sm:px-6">
          <Logo href="/home" />
        </div>
      </header>
      {/* pb clears the fixed bottom tab bar + iOS safe area. */}
      <main className="mx-auto w-full max-w-customer px-4 pt-6 pb-32 sm:px-6">
        {children}
      </main>
      <CustomerTabBar />
    </div>
  )
}
