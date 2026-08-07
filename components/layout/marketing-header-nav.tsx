"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { Button } from "@/components/ui/button"
import { captureMarketingFunnelEvent } from "@/components/analytics/marketing-funnel-tracker"
import { ROUTES } from "@/lib/marketing/facts"
import { cn } from "@/lib/utils"

import { MARKETING_GUTTER } from "./section"

const NAV_ITEMS = [
  { href: ROUTES.howItWorks, label: "How it works" },
  { href: ROUTES.pricing, label: "Pricing" },
  { href: ROUTES.faq, label: "FAQ" },
] as const

const RAIL_ITEMS = [...NAV_ITEMS, { href: "/login", label: "Log in" }] as const

/**
 * Nav link treatment. `--radius-md` (6px), so the links read as smaller
 * siblings of the 10px `Button` beside them rather than as 9999px SaaS pills —
 * DESIGN.md · Shapes reserves full circles for the stamp family and its named
 * exceptions, which the public header is not on.
 */
const navLinkClass =
  "focus-ring inline-flex min-h-11 items-center rounded-(--radius-md) px-3 text-sm font-bold whitespace-nowrap"

const navLinkTone = (active: boolean) =>
  active
    ? "bg-accent text-accent-foreground"
    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"

/**
 * Public marketing nav — the SaaS-blueprint set: Features (How it works),
 * Pricing, FAQ, Log in, and the primary CTA. Text links surface from `md:` up;
 * below that the same set is carried by `MarketingHeaderRail`, so the header
 * never trades navigation for a hamburger and never traps focus.
 */
export function MarketingHeaderNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Public" className="flex items-center gap-1 sm:gap-2">
      <ul className="hidden items-center gap-1 md:flex">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(navLinkClass, navLinkTone(active))}
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
      <Button asChild variant="ghost" size="sm" className="max-md:hidden">
        <Link href="/login">Log in</Link>
      </Button>
      <Button asChild size="sm">
        <Link
          href={ROUTES.signup}
          onClick={() => {
            void captureMarketingFunnelEvent("merchant_signup_clicked")
          }}
        >
          Start your launch
        </Link>
      </Button>
    </nav>
  )
}

/**
 * The phone/small-tablet half of the header nav: a scrollable chip rail pinned
 * under the header bar below `md`. Without it the header on a phone carried
 * only the logo and the CTA, so How it works, Pricing, FAQ and Log in lived
 * nowhere but the footer — up to eight viewports below the fold on `/`.
 * Chips are `min-h-11`, the rail is a labelled focusable scroll region, and
 * nothing overlays the page, so there is still no focus trap.
 */
export function MarketingHeaderRail() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Public sections"
      className="border-t-2 border-dashed border-border md:hidden"
    >
      <ul
        tabIndex={0}
        className={cn(
          "focus-ring mx-auto flex w-full max-w-marketing-chrome items-center gap-1 overflow-x-auto pb-1",
          MARKETING_GUTTER
        )}
      >
        {RAIL_ITEMS.map((item) => {
          const active = pathname === item.href

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(navLinkClass, navLinkTone(active))}
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
