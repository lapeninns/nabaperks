/**
 * On-page chapter bar — a crawlable, JS-free table of contents. Each chip is a
 * hash link to an H2 micro-chapter below, so a skimming buyer (and an AI crawler
 * summarising the page) can jump straight to the intent they care about. Pure
 * CSS + anchors keeps INP at zero; every target section sets `scroll-mt` so the
 * sticky header never occludes the landing spot.
 */
import { Section } from "@/components/layout"

const jumpLinks = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#no-app", label: "No app vs wallet vs paper" },
  { href: "#anti-fraud", label: "Why stamps can’t be faked" },
  { href: "#for-venues", label: "For your venue" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
] as const

export function JumpNav() {
  return (
    <Section as="div" size="tight">
      <nav aria-label="On this page" className="relative">
        <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden">
          {jumpLinks.map((link) => (
            <li key={link.href} className="shrink-0">
              <a
                href={link.href}
                className="pressable mono-meta focus-ring inline-flex items-center rounded-full border-2 border-line bg-card px-3.5 py-1.5 whitespace-nowrap transition-colors hover:border-ink hover:bg-accent hover:text-accent-foreground"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
        {/* Right-edge fade: signals that more chips scroll off-screen on
            phones; the row wraps from `sm` so the hint disappears there. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent sm:hidden"
        />
      </nav>
    </Section>
  )
}
