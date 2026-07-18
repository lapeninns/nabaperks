import Link from "next/link"

import { MonoTag, SectionHeader } from "@/components/brand"
import { Section } from "@/components/layout"
import { Card, CardContent } from "@/components/ui/card"
import { PERSONAS } from "@/lib/marketing/facts"
import { cn } from "@/lib/utils"

/**
 * Persona spokes on the same offer engine. Pubs lead — the offer was built for
 * them; the other verticals link to honestly-framed variants.
 */
export function VenuePersonas() {
  return (
    <Section id="personas">
      <SectionHeader
        eyebrow="Who it's for"
        title="Built for pubs first. Honest about the rest."
        description="One engine, four counters. The pub offer leads because that's the niche the launch was designed around."
      />
      <div className="grid gap-3.5 pt-6 sm:grid-cols-2 lg:grid-cols-4">
        {PERSONAS.map((persona) => (
          <Card
            key={persona.slug}
            size="sm"
            className={cn(persona.primary && "border-primary")}
          >
            <CardContent className="grid h-full content-start gap-2.5">
              <MonoTag
                tone={persona.primary ? "accent" : "plain"}
                className="justify-self-start"
              >
                {persona.primary ? "The primary offer" : persona.navLabel}
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
            </CardContent>
          </Card>
        ))}
      </div>
    </Section>
  )
}
