import { SectionHeader } from "@/components/brand"
import { Section } from "@/components/layout"
import { Card, CardContent } from "@/components/ui/card"
import { CORE_OFFER, DFY_LAUNCH } from "@/lib/marketing/facts"

/**
 * The trimmed-and-stacked core offer: four components, each with the pack's
 * own "why it is valuable" line.
 */
export function OfferStack() {
  return (
    <Section id="offer">
      <SectionHeader
        eyebrow="The core offer"
        title="What the launch actually includes"
        description={DFY_LAUNCH.intro}
      />
      <div className="grid gap-3.5 pt-6 sm:grid-cols-2">
        {CORE_OFFER.map((component, index) => (
          <Card key={component.name} size="sm">
            <CardContent className="grid gap-2">
              <span className="mono-meta text-primary">
                Nº {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="text-base leading-snug font-extrabold text-foreground">
                {component.name}
              </h3>
              <p className="text-sm leading-6 text-muted-foreground">
                {component.detail}
              </p>
              <p className="border-t-2 border-dashed border-border pt-2 text-sm leading-6 text-muted-foreground">
                <span className="font-bold text-foreground">
                  Why it matters:
                </span>{" "}
                {component.why}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="pt-4 text-sm leading-6 text-muted-foreground">
        {DFY_LAUNCH.yourPart}
      </p>
    </Section>
  )
}
