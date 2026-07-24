import Link from "next/link"

import { Section } from "@/components/layout"
import { LANDING, ROUTES } from "@/lib/marketing/facts"

/**
 * One short self-selection beat. The old VenueFit rendered the full
 * qualify/disqualify tables here; those live on /loyalty-for-pubs, which
 * already renders MARKET.qualify and MARKET.disqualify in full. This band only
 * has to let the wrong pub recognise itself and leave.
 *
 * Keeps `id="fit"` — the marketing footer links to `/#fit`.
 */
export function FitNote() {
  return (
    <Section id="fit" size="dense">
      <div className="mx-auto grid max-w-2xl justify-items-center gap-5 text-center">
        <h2 className="text-2xl leading-tight font-extrabold text-balance text-foreground sm:text-3xl">
          {LANDING.fit.title}
        </h2>
        <ul className="grid gap-1.5">
          {LANDING.fit.lines.map((line) => (
            <li key={line} className="text-base leading-7 text-foreground">
              {line}
            </li>
          ))}
        </ul>
        <p className="max-w-xl text-sm leading-6 text-muted-foreground">
          {LANDING.fit.honest}
        </p>
        <Link
          href={ROUTES.pubs}
          className="focus-ring rounded-sm text-sm font-bold text-primary underline underline-offset-4"
        >
          {LANDING.fit.link}
        </Link>
      </div>
    </Section>
  )
}
