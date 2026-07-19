"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { Button } from "@/components/ui/button"
import { ROUTES } from "@/lib/marketing/facts"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: ROUTES.howItWorks, label: "How it works" },
  { href: ROUTES.pricing, label: "Pricing" },
  { href: `${ROUTES.home}#faq`, label: "FAQ" },
] as const

/**
 * Public marketing nav — the SaaS-blueprint set: Features (How it works),
 * Pricing, FAQ, Log in, and the primary CTA. Text links surface from `md:` up;
 * below that the Log in + CTA stand alone and the footer carries the full link
 * set — no hamburger, so the header never traps focus on the acquisition path.
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
                className={cn(
                  "focus-ring inline-flex min-h-11 items-center rounded-full px-3 text-sm font-bold whitespace-nowrap",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
      <Button asChild variant="ghost" size="sm" className="max-sm:hidden">
        <Link href="/login">Log in</Link>
      </Button>
      <Button asChild size="sm">
        <Link href={ROUTES.signup}>Start free pilot</Link>
      </Button>
    </nav>
  )
}
