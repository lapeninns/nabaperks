import Link from "next/link"

import { MonoTag, SectionHeader } from "@/components/brand"
import { Section } from "@/components/layout"
import { PERSONAS } from "@/lib/marketing/facts"
import { cn } from "@/lib/utils"

import { SnapRail, SnapRailItem } from "./snap-rail"

/**
 * Persona spokes on the same offer engine. Pubs lead — the offer was built for
 * them; the other verticals link to honestly-framed variants. On phones the
 * four cards ride a horizontal snap rail; from `sm` up they grid.
 */
export function VenuePersonas() {
  return (
    <Section id="personas" size="dense">
      <SectionHeader
        eyebrow="Who it's for"
        title="Built for pubs first"
        description="Pubs are who this was built for. The same card works honestly for a few close cousins."
      />
      <div className="pt-5 sm:pt-6">
        <SnapRail
          label="Venue types the card works for"
          className="sm:grid-cols-2 lg:grid-cols-4"
        >
          {PERSONAS.map((persona) => (
            <SnapRailItem
              key={persona.slug}
              className={cn(
                "surface-card grid content-start gap-2.5 p-4",
                persona.primary && "border-primary"
              )}
            >
              <MonoTag
                tone={persona.primary ? "accent" : "plain"}
                className="justify-self-start"
              >
                {persona.primary ? "Built for pubs" : persona.navLabel}
              </MonoTag>
              <h3 className="text-base leading-snug font-extrabold text-foreground">
                {persona.quietQuestion}
              </h3>
              <Link
                href={persona.path}
                className="focus-ring mt-auto justify-self-start rounded-full text-sm font-bold text-primary underline-offset-4 hover:underline"
              >
                {persona.title} →
              </Link>
            </SnapRailItem>
          ))}
        </SnapRail>
      </div>
    </Section>
  )
}
