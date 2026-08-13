import type { ReactNode } from "react"
import { ArrowDown01Icon } from "@hugeicons/core-free-icons"

import { MarketingFunnelTracker } from "@/components/analytics/marketing-funnel-tracker"
import { WebVitalsReporter } from "@/components/analytics/web-vitals-reporter"
import Link from "next/link"

import { Icon, Logo } from "@/components/brand"
import { BRAND, LEGAL_CONTACT, ROUTES } from "@/lib/marketing/facts"

import { MarketingHeaderNav, MarketingHeaderRail } from "./marketing-header-nav"
import { MARKETING_GUTTER } from "./section"
import { SkipLink } from "./skip-link"

// min-h-9 (36px), not min-h-11. Footer links are low-frequency navigation, not
// primary targets; WCAG 2.5.8's 24px minimum is the applicable floor and the
// list spacing already provides separation. At 44px each, 13 links cost ~572px
// of footer on every public page. (05#47)
//
// `rounded-(--radius-md)`, not `rounded-full`. DESIGN.md reserves full circles
// for the stamp family and names its exceptions, one of which is "the
// legal-link halo family" — that is `legalLinkClass` below, the /terms
// /privacy /cookies row. These thirteen are site navigation, not legal links,
// so the pill here was drift. They now read as smaller siblings of the 10px
// button rather than soft SaaS pills. (01#6)
const footerLinkClass =
  "focus-ring inline-flex min-h-9 items-center rounded-(--radius-md) px-3 py-1.5 underline-offset-4 hover:bg-accent hover:text-accent-foreground hover:underline"

/**
 * Legal links are low-frequency and were costing three wrapped rows of 44px
 * pills at the bottom of every public page. They now set as one wrapped
 * sentence of 36px targets — still well clear of the WCAG 2.2 target-size
 * minimum, roughly 90px shorter on a phone.
 */
const legalLinkClass =
  "focus-ring inline-flex min-h-9 items-center rounded-full px-2 underline-offset-4 hover:bg-accent hover:text-accent-foreground hover:underline"

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
      { href: ROUTES.faq, label: "FAQ" },
      { href: ROUTES.demo, label: "Live demo" },
      { href: ROUTES.signup, label: "Start your launch" },
    ],
  },
  {
    heading: "For food-led pubs",
    links: [
      { href: ROUTES.pubs, label: "Is Nabaperks right for your pub?" },
      { href: `${ROUTES.home}#fit`, label: "Check your pub's fit" },
      {
        href: `${ROUTES.pricing}#guarantees`,
        label: "Guarantees and conditions",
      },
    ],
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
      { href: ROUTES.about, label: `About ${BRAND.name}` },
      { href: `mailto:${LEGAL_CONTACT.supportEmail}`, label: "Contact" },
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
      <WebVitalsReporter />
      <SkipLink />
      <header className="sticky top-0 z-40 border-b-2 border-ink bg-card">
        <div
          className={`mx-auto flex w-full max-w-marketing-chrome items-center justify-between gap-3 py-3 ${MARKETING_GUTTER}`}
        >
          {/* Linked on every surface (default) so auth funnel pages keep the
              "Nabaperks home" escape hatch the a11y contract requires. */}
          <Logo
            href={ROUTES.home}
            className="max-[420px]:[&>span:last-child]:sr-only"
          />
          {focused ? null : <MarketingHeaderNav />}
        </div>
        {/* Below `md:` the header bar has room for the logo and one key only,
            so the rest of the nav rides a second scrollable row rather than
            being exiled to a footer that sits several viewports down. */}
        {focused ? null : <MarketingHeaderRail />}
      </header>
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <footer className="border-t-2 border-dashed border-border bg-card">
        {focused ? (
          // Focused (auth funnel) keeps the original single-row footer —
          // markup-identical so the blessed auth visual baselines stay stable.
          <div
            className={`mx-auto flex w-full max-w-marketing-chrome flex-col items-center gap-3 py-6 text-sm text-muted-foreground sm:flex-row sm:justify-between ${MARKETING_GUTTER}`}
          >
            <FooterIdentity />
            <FooterLegalNav />
          </div>
        ) : (
          <div
            className={`mx-auto w-full max-w-marketing-chrome py-6 text-sm text-muted-foreground sm:py-8 ${MARKETING_GUTTER}`}
          >
            {/* Two DOM branches, one of them always `display: none`.
                Measured, chromium+firefox+webkit: there is no cross-browser
                CSS-only way to force a <details> open above a breakpoint.
                `details:not([open]) > * { display: block }` and
                `details { display: contents }` reveal nothing in any of the
                three engines; `details::details-content { content-visibility:
                visible }` works in Firefox only. So the single-tree version
                shipped by 05#47 left columns 2-4 CLOSED at every width, with
                `sm:pointer-events-none` on the summary making them
                unopenable by pointer: 8 of 13 site links invisible and
                unreachable on desktop. Measured cost of that hiding: zero.
                The desktop footer is 390.94px tall whether the three columns
                are open or closed, because the tallest column sets the row.
                Rendering the disclosure below `sm:` and the plain four-across
                list from `sm:` keeps the 144px the accordion actually saves on
                a phone (680px -> 536px) and gives the links back. Only one
                branch is ever in the accessibility tree, so there is no
                duplicate-link cost. (01#2, corrects 05#47) */}
            <nav aria-label="Site links" className="pb-6">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:hidden">
                {FOOTER_COLUMNS.map((column, index) => (
                  // NOT `display: grid` on the <details> itself — that makes
                  // every child a grid item and the UA stops collapsing the
                  // closed content, which silently defeats the disclosure.
                  <details
                    key={column.heading}
                    open={index === 0}
                    className="group block content-start"
                  >
                    <summary className="focus-ring eyebrow flex min-h-11 cursor-pointer list-none items-center justify-between rounded-(--radius-md) px-3">
                      {column.heading}
                      {/* The house chevron through the brand Icon wrapper, not
                          a raw "▾" text glyph. DESIGN.md · Iconography: "Render
                          every icon through the brand `Icon` wrapper"; the same
                          ArrowDown01Icon already turns in Disclosure,
                          MarketingDisclosure, SelectField and ProfileSection.
                          A text arrow sets in Bricolage at whatever metrics the
                          font gives it and cannot carry the 2px house stroke. */}
                      <Icon
                        icon={ArrowDown01Icon}
                        size={16}
                        className="shrink-0 text-muted-foreground transition-transform duration-[var(--w-dur-fast)] ease-[var(--w-ease)] group-open:rotate-180 motion-reduce:transition-none"
                      />
                    </summary>
                    <FooterLinkList column={column} />
                  </details>
                ))}
              </div>
              <div className="hidden gap-6 gap-y-2 sm:grid sm:grid-cols-4">
                {FOOTER_COLUMNS.map((column) => (
                  <div
                    key={column.heading}
                    className="grid content-start gap-1"
                  >
                    <p className="eyebrow px-3 pb-1">{column.heading}</p>
                    <FooterLinkList column={column} />
                  </div>
                ))}
              </div>
            </nav>

            <div className="flex flex-col items-center gap-3 border-t-2 border-dashed border-border pt-6 sm:flex-row sm:justify-between">
              <FooterIdentity withMotto />
              <FooterLegalNav />
            </div>
          </div>
        )}
      </footer>
    </div>
  )
}

function FooterLinkList({ column }: { column: FooterColumn }) {
  return (
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
  )
}

function FooterIdentity({ withMotto = false }: { withMotto?: boolean }) {
  const row = (
    <div className="flex items-center gap-3">
      <Logo label="nabaperks" linked={false} />
      <span className="mono-id tracking-tag whitespace-nowrap text-muted-foreground">
        © {new Date().getFullYear()}
      </span>
    </div>
  )

  // The focused (auth funnel) footer keeps the bare row so its blessed visual
  // baselines stay stable. Only the full marketing footer carries the motto.
  if (!withMotto) return row

  return (
    <div className="grid justify-items-center gap-1 sm:justify-items-start">
      {row}
      <p className="text-muted-foreground">{BRAND.motto}</p>
    </div>
  )
}

/**
 * One wrapped sentence rather than five 44px pills — see `legalLinkClass`.
 * The hrefs stay literal in the markup: `tests/contracts/legal-pack-code-alignment`
 * greps this file for `href="/cookies"` and friends.
 */
function FooterLegalNav() {
  return (
    <nav
      aria-label="Legal links"
      className="flex flex-wrap items-center justify-center gap-x-0.5 gap-y-1 sm:justify-start"
    >
      <Link className={legalLinkClass} href="/terms">
        Terms
      </Link>
      <LegalSeparator />
      <Link className={legalLinkClass} href="/privacy">
        Privacy
      </Link>
      <LegalSeparator />
      <Link className={legalLinkClass} href="/cookies">
        Cookies
      </Link>
      <LegalSeparator />
      <Link className={legalLinkClass} href="/merchant-terms">
        Merchant terms
      </Link>
      <LegalSeparator />
      <Link className={legalLinkClass} href="/data-processing">
        Data processing
      </Link>
    </nav>
  )
}

function LegalSeparator() {
  return (
    <span aria-hidden="true" className="text-border">
      ·
    </span>
  )
}
