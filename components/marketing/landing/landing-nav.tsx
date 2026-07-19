import Link from "next/link"

import { Section } from "@/components/layout"

const LANDING_LINKS = [
  { href: "#problem", label: "The problem" },
  { href: "#launch", label: "Five-step launch" },
  { href: "#features", label: "What's included" },
  { href: "#fit", label: "Is your pub a fit?" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "Questions" },
] as const

/** Compact in-page navigation for people and crawlable section relationships. */
export function LandingNav() {
  return (
    <nav aria-label="On this page">
      <Section as="div" size="compact">
        <p className="mono-meta pb-3 text-muted-foreground">
          Choose what you need
        </p>
        <ul className="flex snap-x [scrollbar-width:none] gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
          {LANDING_LINKS.map((link) => (
            <li key={link.href} className="shrink-0 snap-start">
              <Link
                href={link.href}
                className="focus-ring inline-flex min-h-11 items-center rounded-full border-2 border-ink bg-card px-4 text-sm font-bold text-foreground hover:bg-accent hover:text-accent-foreground"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </nav>
  )
}
