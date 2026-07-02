import Link from "next/link"

import { Section } from "@/components/layout"
import { Button } from "@/components/ui/button"

import { ReassuranceBar } from "./reassurance-bar"

/**
 * Final CTA — the close, value before friction one last time. Centred and
 * single-column on every size; the three actions wrap on narrow screens.
 */
export function FinalCta() {
  return (
    <Section width="narrow" className="max-w-2xl text-center">
      <p className="mono-meta tracking-[0.1em] text-primary">
        Your first stamp is waiting
      </p>
      <h2 className="mx-auto mt-4 max-w-[18ch] text-[clamp(1.9rem,4.6vw,3.125rem)] leading-[0.99] font-extrabold tracking-[-0.02em] text-balance">
        Set up your venue this afternoon.
      </h2>
      <p className="mx-auto mt-4 max-w-[44ch] text-base leading-relaxed text-muted-foreground">
        Build your card, preview the QR flow, and start a 30-day pilot when you
        activate your live venue QR. Then it is £29/month for one venue.
      </p>
      <p className="mx-auto mt-3 max-w-[46ch] text-sm leading-relaxed text-muted-foreground">
        No app for your customers, no POS for you — it works on any phone, tablet
        or till.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button asChild size="lg">
          <Link href="/signup">Start free pilot</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/pricing">View pricing</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/login">Log in</Link>
        </Button>
      </div>
      <ReassuranceBar
        points={["No payment to start", "No contract", "Cancel on a month's notice"]}
        className="mt-6 justify-center"
      />
    </Section>
  )
}
