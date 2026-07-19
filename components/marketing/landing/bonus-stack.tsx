import { MonoTag, SectionHeader } from "@/components/brand"
import { Section } from "@/components/layout"
import { Card, CardContent } from "@/components/ui/card"
import { BONUS_STACK, BONUS_STACK_NOTE } from "@/lib/marketing/facts"

/**
 * The three named bonuses. Each card leads with the obstacle it removes and
 * closes with its substantiable anchor — never an invented reference price.
 */
export function BonusStack() {
  return (
    <Section id="bonuses">
      <SectionHeader
        eyebrow="Included free"
        title="Three bonuses that clear the usual headaches"
        description="Each one exists because pub owners kept naming the same obstacle."
      />
      <div className="grid gap-3.5 pt-6 lg:grid-cols-3">
        {BONUS_STACK.map((bonus, index) => (
          <Card key={bonus.name} size="sm">
            <CardContent className="grid h-full content-start gap-2">
              <div className="flex items-center justify-between gap-2">
                <MonoTag tone="sun">Bonus {index + 1}</MonoTag>
              </div>
              <p className="text-sm leading-6 text-muted-foreground italic">
                “{bonus.obstacle}”
              </p>
              <h3 className="text-base leading-snug font-extrabold text-foreground">
                {bonus.name}
              </h3>
              <p className="text-sm leading-6 text-muted-foreground">
                {bonus.detail}
              </p>
              <p className="mt-auto border-t-2 border-dashed border-border pt-2 text-xs leading-5 text-muted-foreground">
                {bonus.anchor}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="pt-4 text-xs leading-5 text-muted-foreground">
        {BONUS_STACK_NOTE}
      </p>
    </Section>
  )
}
