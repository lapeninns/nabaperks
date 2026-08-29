import type { ReactNode } from "react"

import { MARKETING_ANCHOR_OFFSET } from "@/components/layout"
import type { PubGuideSection } from "@/lib/marketing/facts"
import { cn } from "@/lib/utils"

/**
 * One numbered band of the pub buyer's guide — the hub's section primitive.
 *
 * The Nº marker is the print kit's numbering idiom carried onto the web, and it
 * is what makes the hub read as a structured guide rather than a stack of sales
 * bands. Prose is capped at a reading measure; structured payloads passed as
 * `children` run the full column width so a comparison can breathe.
 * Server component.
 */
export function GuideSection({
  section,
  index,
  children,
}: {
  section: PubGuideSection
  /** Zero-based position in `PUB_GUIDE_SECTIONS`; drives the Nº marker. */
  index: number
  children?: ReactNode
}) {
  return (
    <section
      id={section.id}
      className={cn(
        // The dashed rule is the section separator: the page used to hold a
        // 48-64px gap between bands, which is the largest gap token on the
        // marketing surface applied to the tallest page in the product. The
        // first band sits under the hero and needs no rule.
        "grid gap-4 border-t-2 border-dashed border-border pt-8 first:border-t-0 first:pt-0",
        MARKETING_ANCHOR_OFFSET
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="mono-meta text-primary">
          Nº{String(index + 1).padStart(2, "0")}
        </p>
        <p className="mono-meta text-muted-foreground">{section.eyebrow}</p>
      </div>
      <h2 className="max-w-[26ch] text-2xl leading-tight font-extrabold tracking-tight text-balance text-foreground sm:text-3xl">
        {section.heading}
      </h2>
      {section.paragraphs.length > 0 ? (
        <div className="grid max-w-[68ch] gap-3">
          {section.paragraphs.map((paragraph) => (
            <p
              key={paragraph}
              className="text-base leading-7 text-muted-foreground"
            >
              {paragraph}
            </p>
          ))}
        </div>
      ) : null}
      {children}
    </section>
  )
}
