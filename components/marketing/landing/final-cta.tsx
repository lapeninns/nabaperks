import Link from "next/link"

import { Button } from "@/components/ui/button"

/**
 * Final CTA — the close, value before friction one last time. Centred and
 * single-column on every size; the three actions wrap on narrow screens.
 */
export function FinalCta() {
  return (
    <section className="mx-auto w-full max-w-2xl px-6 pt-12 pb-16 text-center sm:pt-16">
      <p className="font-mono text-[0.72rem] font-bold tracking-[0.1em] text-primary uppercase">
        Your first stamp is waiting
      </p>
      <h2 className="mx-auto mt-4 max-w-[18ch] text-[clamp(1.9rem,4.6vw,3.125rem)] leading-[0.99] font-extrabold tracking-[-0.02em] text-balance">
        Set up your venue this afternoon.
      </h2>
      <p className="mx-auto mt-4 max-w-[44ch] text-base leading-relaxed text-muted-foreground">
        Build your card, preview the QR flow, and start a 30-day pilot when you
        activate your live venue QR. Then it is £29/month for one venue.
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Button asChild size="lg">
          <Link href="/signup">Start a merchant trial</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/pricing">View pricing</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/login">Log in</Link>
        </Button>
      </div>
    </section>
  )
}
