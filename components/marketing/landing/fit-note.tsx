import Link from "next/link"

import { Section } from "@/components/layout"
import { PlanIncludesList } from "@/components/marketing"
import { MARKETING_TEXT_LINK } from "@/components/marketing/text-link"
import { LANDING, ROUTES } from "@/lib/marketing/facts"
import { cn } from "@/lib/utils"

/**
 * One short self-selection beat. The old VenueFit rendered the full
 * qualify/disqualify tables here; those live on /loyalty-for-pubs, which
 * already renders MARKET.qualify and MARKET.disqualify in full. This band only
 * has to let the wrong pub recognise itself and leave.
 *
 * It is a left-aligned two-column band, not a centred chromeless stack: the
 * three fit lines are qualification criteria, so they are set as a checked
 * list (the `PlanIncludesList` idiom the pricing sheet owns) with the honest
 * disqualifier as a dashed aside beside them. Centred, unmarked lines read as
 * a page break between the composed ProductMoment and the bordered pricing
 * sheet — not as a gate the reader is meant to apply to themselves.
 *
 * Keeps `id="fit"` — the marketing footer links to `/#fit`.
 */
export function FitNote() {
  return (
    <Section id="fit" size="dense">
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] md:items-start md:gap-10">
        <div className="grid content-start gap-4">
          <h2 className="max-w-[24ch] text-2xl leading-tight font-extrabold text-balance text-foreground sm:text-3xl">
            {LANDING.fit.title}
          </h2>
          <PlanIncludesList items={LANDING.fit.lines} />
        </div>
        <div className="grid content-start gap-3 rounded-lg border-2 border-dashed border-line-strong p-4 sm:p-5">
          <p className="text-sm leading-6 text-muted-foreground">
            {LANDING.fit.honest}
          </p>
          <Link
            href={ROUTES.pubs}
            className={cn(
              MARKETING_TEXT_LINK,
              "justify-self-start text-primary"
            )}
          >
            {LANDING.fit.link}
          </Link>
        </div>
      </div>
    </Section>
  )
}
