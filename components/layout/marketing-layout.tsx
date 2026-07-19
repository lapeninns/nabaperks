import type { ReactNode } from "react"

import { MarketingFunnelTracker } from "@/components/analytics/marketing-funnel-tracker"
import Link from "next/link"

import { Logo } from "@/components/brand"
import { OPERATOR, PERSONAS, ROUTES } from "@/lib/marketing/facts"

import { MarketingHeaderNav } from "./marketing-header-nav"

const footerLinkClass =
  "focus-ring inline-flex min-h-11 items-center rounded-full px-3 underline-offset-4 hover:bg-accent hover:text-accent-foreground hover:underline"

type FooterColumn = {
  heading: string
  links: readonly { href: string; label: string }[]
}

const FOOTER_COLUMNS: readonly FooterColumn[] = [
  {
    heading: "Product",
    links: [
      { href: ROUTES.howItWorks, label: "How it works" },
      { href: ROUTES.pricing, label: "Pricing" },
      { href: ROUTES.demo, label: "Live demo" },
      { href: ROUTES.signup, label: "Start free pilot" },
    ],
  },
  {
    heading: "Who it's for",
    links: PERSONAS.map((persona) => ({
      href: persona.path,
      label: persona.title,
    })),
  },
  {
    heading: "Guides",
    links: [
      { href: ROUTES.guideNoApp, label: "Reward regulars without an app" },
      { href: ROUTES.guideIdeas, label: "Best loyalty ideas for pubs" },
      { href: ROUTES.guidePaperVsQr, label: "Paper vs QR loyalty" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: ROUTES.about, label: `About ${OPERATOR.name}` },
      { href: `mailto:${OPERATOR.supportEmail}`, label: "Contact" },
    ],
  },
]

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
          {/* Linked on every surface (default) so auth funnel pages keep the
              "Nabaperks home" escape hatch the a11y contract requires. */}
          <Logo
            href={ROUTES.home}
            className="max-[420px]:[&>span:last-child]:sr-only"
          />
          {focused ? null : <MarketingHeaderNav />}
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="border-t-2 border-dashed border-border bg-card">
        {focused ? (
          // Focused (auth funnel) keeps the original single-row footer —
          // markup-identical so the blessed auth visual baselines stay stable.
          <div className="mx-auto flex w-full max-w-marketing-chrome flex-col items-center gap-3 px-6 py-6 text-sm text-muted-foreground sm:flex-row sm:justify-between">
            <FooterIdentity />
            <FooterLegalNav />
          </div>
        ) : (
          <div className="mx-auto w-full max-w-marketing-chrome px-6 py-6 text-sm text-muted-foreground sm:py-8">
            <nav
              aria-label="Site links"
              className="grid grid-cols-2 gap-x-3 gap-y-5 pb-6 sm:gap-6 lg:grid-cols-4"
            >
              {FOOTER_COLUMNS.map((column) => (
                <div key={column.heading} className="grid content-start gap-1">
                  <p className="eyebrow px-3 pb-1">{column.heading}</p>
                  <ul className="grid justify-items-start gap-0.5">
                    {column.links.map((link) => (
                      <li key={link.href}>
                        {link.href.startsWith("mailto:") ? (
                          <a className={footerLinkClass} href={link.href}>
                            {link.label}
                          </a>
                        ) : (
                          <Link className={footerLinkClass} href={link.href}>
                            {link.label}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
            <div className="flex flex-col items-center gap-3 border-t-2 border-dashed border-border pt-6 sm:flex-row sm:justify-between">
              <FooterIdentity />
              <FooterLegalNav />
            </div>
          </div>
        )}
      </footer>
    </div>
  )
}

function FooterIdentity() {
  return (
    <div className="flex items-center gap-3">
      <Logo label="nabaperks" linked={false} />
      <span className="mono-id tracking-[0.08em] whitespace-nowrap text-muted-foreground">
        © {new Date().getFullYear()}
      </span>
    </div>
  )
}

function FooterLegalNav() {
  return (
    <nav aria-label="Legal links" className="flex flex-wrap gap-2">
      <Link className={footerLinkClass} href="/terms">
        Terms
      </Link>
      <Link className={footerLinkClass} href="/privacy">
        Privacy
      </Link>
      <Link className={footerLinkClass} href="/cookies">
        Cookies
      </Link>
      <Link className={footerLinkClass} href="/merchant-terms">
        Merchant terms
      </Link>
      <Link className={footerLinkClass} href="/data-processing">
        Data processing
      </Link>
    </nav>
  )
}
