import type { ReactNode } from "react"

import { MarketingFunnelTracker } from "@/components/analytics/marketing-funnel-tracker"
import Link from "next/link"

import { Logo } from "@/components/brand"

import { MarketingHeaderNav } from "./marketing-header-nav"

const legalLinkClass =
  "focus-ring inline-flex min-h-11 items-center rounded-full px-3 underline-offset-4 hover:bg-accent hover:text-accent-foreground hover:underline"

export function MarketingLayout({
  children,
  focused = false,
}: {
  children: ReactNode
  /**
   * Auth funnel mode hides the sign-up CTA so sign-up, verification and reset
   * flows stay focused. The logo and legal links remain visible.
   */
  focused?: boolean
}) {
  return (
    <div className="min-h-[100dvh] overflow-x-clip bg-background">
      <MarketingFunnelTracker />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:border-2 focus:border-ink focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-bold"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b-2 border-ink bg-card">
        <div className="mx-auto flex w-full max-w-marketing-chrome items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Logo
            linked={false}
            className="max-[420px]:[&>span:last-child]:sr-only"
          />
          {focused ? null : <MarketingHeaderNav />}
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="border-t-2 border-dashed border-border bg-card">
        <div className="mx-auto flex w-full max-w-marketing-chrome flex-col items-center gap-3 px-6 py-6 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <div className="flex items-center gap-3">
            <Logo label="nabaperks" linked={false} />
            <span className="mono-id tracking-[0.08em] whitespace-nowrap text-muted-foreground">
              © {new Date().getFullYear()}
            </span>
          </div>
          <nav aria-label="Legal links" className="flex flex-wrap gap-2">
            <Link className={legalLinkClass} href="/terms">
              Terms
            </Link>
            <Link className={legalLinkClass} href="/privacy">
              Privacy
            </Link>
            <Link className={legalLinkClass} href="/cookies">
              Cookies
            </Link>
            <Link className={legalLinkClass} href="/merchant-terms">
              Merchant terms
            </Link>
            <Link className={legalLinkClass} href="/data-processing">
              Data processing
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
