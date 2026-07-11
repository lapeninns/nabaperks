import type { ReactNode } from "react"

import { MarketingFunnelTracker } from "@/components/analytics/marketing-funnel-tracker"
import Link from "next/link"

import { Logo } from "@/components/brand"
import { Marquee } from "@/components/marketing"
import { GUIDES } from "@/components/marketing/guides/guides-data"

import { MarketingHeaderNav } from "./marketing-header-nav"

export type MarketingNavLink = {
  href: string
  label: string
}

const defaultMarketingLinks: MarketingNavLink[] = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/login", label: "Log in" },
]

const legalLinkClass =
  "focus-ring inline-flex min-h-11 items-center rounded-full px-3 underline-offset-4 hover:bg-accent hover:text-accent-foreground hover:underline"

export function MarketingLayout({
  children,
  navLinks,
  logoHref = "/",
  focused = false,
}: {
  children: ReactNode
  /** Homepage can pass anchor links; pricing and legal pages use the default. */
  navLinks?: MarketingNavLink[]
  /** Merchant marketing pages should link home to `/`, not the customer `/start` surface. */
  logoHref?: string
  /**
   * Auth/checkout funnel mode: drop the marquee, the header nav (incl. the
   * "Start free pilot" CTA), and the mega footer so /signup, /signup/verify and
   * /reset-password don't leak clicks out of the flow. Legal links stay.
   */
  focused?: boolean
}) {
  const marketingLinks = navLinks ?? defaultMarketingLinks
  return (
    <div className="min-h-[100dvh] overflow-x-clip bg-background">
      <MarketingFunnelTracker />
      {/* Keyboard/SR users skip the marquee + sticky header on every route. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:border-2 focus:border-ink focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-bold"
      >
        Skip to content
      </a>
      {focused ? null : <Marquee />}
      <header className="sticky top-0 z-40 border-b-2 border-ink bg-card">
        <div className="mx-auto flex w-full max-w-marketing-chrome items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Logo
            href={logoHref}
            className="max-[420px]:[&>span:last-child]:sr-only"
          />
          {focused ? null : <MarketingHeaderNav links={marketingLinks} />}
        </div>
      </header>
      <main id="main">{children}</main>
      {focused ? (
        <footer className="border-t-2 border-dashed border-border bg-card">
          <div className="mx-auto flex w-full max-w-marketing-chrome flex-col items-center gap-3 px-6 py-6 text-sm text-muted-foreground sm:flex-row sm:justify-between">
            <div className="flex items-center gap-3">
              <Logo href={logoHref} label="nabaperks" linked={false} />
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
            </nav>
          </div>
        </footer>
      ) : (
        <footer className="border-t-2 border-dashed border-border bg-card">
          <div className="mx-auto flex w-full max-w-marketing-chrome flex-col gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            {/* max-sm:flex-wrap lets the credit drop below the logo at 320px
                (the pair overshoots the 288px content column); from sm up the
                row stays nowrap so the crowded footer row cannot squeeze the
                credit onto a second line. */}
            <div className="flex items-center gap-3 max-sm:flex-wrap max-sm:gap-y-1">
              <Logo href={logoHref} label="nabaperks" />
              <span className="mono-id tracking-[0.08em] whitespace-nowrap text-muted-foreground">
                © {new Date().getFullYear()} · Marketing by choice
              </span>
            </div>
            <nav aria-label="Merchant links" className="flex flex-wrap gap-2">
              <Link className={legalLinkClass} href="/how-it-works">
                How it works
              </Link>
              <Link className={legalLinkClass} href="/loyalty-for-pubs">
                Loyalty for pubs
              </Link>
              <Link className={legalLinkClass} href="/loyalty-for-cafes">
                Loyalty for cafes
              </Link>
              <Link className={legalLinkClass} href="/loyalty-for-takeaways">
                Loyalty for takeaways
              </Link>
              <Link className={legalLinkClass} href="/loyalty-for-bars">
                Loyalty for bars
              </Link>
              <Link className={legalLinkClass} href="/about">
                About
              </Link>
              <Link className={legalLinkClass} href="/pricing">
                Pricing
              </Link>
              <Link className={legalLinkClass} href="/signup">
                Start free pilot
              </Link>
            </nav>
            <nav
              aria-label="Pub loyalty guides"
              className="flex flex-wrap gap-2"
            >
              {GUIDES.map((guide) => (
                <Link
                  key={guide.href}
                  className={legalLinkClass}
                  href={guide.href}
                >
                  {guide.nav}
                </Link>
              ))}
            </nav>
            <nav aria-label="Legal links" className="flex flex-wrap gap-2">
              <Link className={legalLinkClass} href="/terms">
                Terms
              </Link>
              <Link className={legalLinkClass} href="/privacy">
                Privacy
              </Link>
            </nav>
          </div>
        </footer>
      )}
    </div>
  )
}
