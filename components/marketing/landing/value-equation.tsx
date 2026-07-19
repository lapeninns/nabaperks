import { Eyebrow, ReceiptCard, SectionHeader } from "@/components/brand"
import { Section } from "@/components/layout"
import { Card, CardContent } from "@/components/ui/card"
import { VALUE_EQUATION, VALUE_MATH } from "@/lib/marketing/facts"

/**
 * Why pubs say yes: the offer pack's value case in customer voice, plus the
 * price-to-value maths — always rendered with its worked-example label.
 */
export function ValueEquation() {
  return (
    <Section id="value">
      <SectionHeader
        eyebrow="Why pubs say yes"
        title="Priced like software. Delivered like a service."
        description="Software price, service delivery — here's what that means at your counter."
      />
      <div className="grid gap-3.5 pt-6 sm:grid-cols-2">
        {VALUE_EQUATION.map((item) => (
          <Card key={item.lever} size="sm" data-elevation="flat">
            <CardContent className="grid gap-2">
              <Eyebrow>{item.lever}</Eyebrow>
              <h3 className="text-base leading-snug font-extrabold text-foreground">
                {item.heading}
              </h3>
              <p className="text-sm leading-6 text-muted-foreground">
                {item.detail}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <ReceiptCard edge padding="md" wrapperClassName="pt-6" className="gap-2">
        <p className="mono-meta text-muted-foreground">Quick maths</p>
        <p className="text-sm leading-6 text-muted-foreground">
          {VALUE_MATH.assumptionLine}
        </p>
        <p className="text-xl leading-snug font-extrabold text-foreground">
          {VALUE_MATH.coverLine}
        </p>
        <p className="mono-id text-muted-foreground uppercase">
          {VALUE_MATH.illustrativeNote}
        </p>
      </ReceiptCard>
    </Section>
  )
}
