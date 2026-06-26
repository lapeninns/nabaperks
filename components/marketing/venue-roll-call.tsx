import { VenueMark } from "@/components/brand"
import { STAMPING_VENUES } from "@/lib/marketing/venues"
import { cn } from "@/lib/utils"

/**
 * Honest, quote-free social proof: a rubber-stamp roll-call of the real venues
 * already running a Nabaperks card. Each row is a `VenueMark` roundel beside the
 * venue's real name and postcode — no quotes, scores, or invented venues. The
 * list comes verbatim from `lib/marketing/venues.ts`.
 */
export function VenueRollCall({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-8", className)}>
      <div className="grid gap-2.5">
        <p className="eyebrow">From the counter</p>
        <h2 className="text-[clamp(1.9rem,4vw,2.8rem)] leading-[1.04] font-extrabold tracking-[-0.02em] text-balance">
          Counters already stamping.
        </h2>
        <p className="max-w-[44ch] text-sm leading-6 text-muted-foreground sm:text-base">
          Real venues, real postcodes — the card is already on these counters.
        </p>
      </div>
      <ul className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        {STAMPING_VENUES.map((venue) => (
          <li
            key={venue.postcode}
            className="flex items-center gap-3 border-b-2 border-dashed border-border pb-4 sm:border-none sm:pb-0"
          >
            <VenueMark initials={venue.initials} size={40} />
            <div className="grid min-w-0 gap-0.5">
              <span className="leading-tight font-bold text-balance">
                {venue.name}
              </span>
              <span className="font-mono text-[0.7rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                {venue.postcode}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
