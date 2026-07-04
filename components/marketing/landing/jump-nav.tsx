/**
 * On-page chapter bar — a crawlable, JS-free table of contents. Each link
 * targets an H2 micro-chapter below so a skimming buyer (and an AI crawler
 * summarising the page) can jump to the intent they care about. Pure CSS +
 * anchors keeps INP at zero; every target section sets `scroll-mt` so the sticky
 * header never occludes the landing spot.
 *
 * Mobile uses a native `<details>` list (full labels, 44px tap targets) instead
 * of a horizontal chip hunt. From `sm` the skimmable chip bar wraps in place.
 */
import { Section } from "@/components/layout"
import { cn } from "@/lib/utils"

const jumpLinks = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#anti-fraud", label: "Why stamps can’t be faked" },
  { href: "#for-venues", label: "For your venue" },
  { href: "#pricing", label: "Pricing" },
] as const

const chipLinkClassName =
  "pressable mono-meta focus-ring inline-flex items-center rounded-full border-2 border-line bg-card px-3.5 py-1.5 whitespace-nowrap transition-colors hover:border-ink hover:bg-accent hover:text-accent-foreground"

const mobileLinkClassName =
  "pressable focus-ring flex min-h-11 items-center rounded-[var(--radius)] border-2 border-transparent px-3 py-2 text-sm font-medium leading-snug text-foreground transition-colors hover:border-line hover:bg-accent hover:text-accent-foreground"

export function JumpNav() {
  return (
    <Section as="div" size="tight" entrance={false}>
      <nav aria-label="On this page" className="relative">
        <details className="group rounded-[var(--radius)] border-2 border-line bg-card sm:hidden">
          <summary className="pressable mono-meta focus-ring flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 outline-none [&::-webkit-details-marker]:hidden">
            On this page
            <span aria-hidden="true" className="text-primary">
              <span className="group-open:hidden">+</span>
              <span className="hidden group-open:inline">–</span>
            </span>
          </summary>
          <ul className="flex flex-col gap-0.5 px-2 pb-2">
            {jumpLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href} className={mobileLinkClassName}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </details>

        <ul
          className={cn(
            "hidden gap-2 sm:flex sm:flex-wrap",
            "-mx-1 px-1 pb-1"
          )}
        >
          {jumpLinks.map((link) => (
            <li key={link.href}>
              <a href={link.href} className={chipLinkClassName}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </Section>
  )
}
