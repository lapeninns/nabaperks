import Link from "next/link"

import { Section } from "@/components/layout"
import { Button } from "@/components/ui/button"

import { ReassuranceBar } from "./reassurance-bar"

/**
 * Mid-page CTA — compact conversion bridge after proof and anti-fraud, before
 * the long venue-content stretch. Keeps the next signup ask within reach of
 * visitors who have already seen the core value prop.
 */
export function MidPageCta() {
  return (
    <Section aria-label="Start your card-backed pilot" size="compact">
      <div className="surface-card flex flex-col items-center gap-5 px-6 py-7 text-center sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:px-8 sm:py-6 sm:text-left">
        <div className="max-w-md">
          <h2 className="text-[clamp(1.35rem,3vw,1.75rem)] leading-tight font-extrabold tracking-[-0.02em] text-balance">
            Start your 30-day pilot.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">
            See the whole scan-to-reward flow on your own card. Card required —
            cancel anytime.
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-col items-center gap-3 sm:w-auto sm:items-end">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/signup">Start free pilot</Link>
          </Button>
          <ReassuranceBar
            points={["Card required — cancel anytime", "No contract"]}
            className="justify-center sm:justify-end"
          />
        </div>
      </div>
    </Section>
  )
}
