import { MonoTag } from "@/components/brand"
import { getActiveSeasonalOffer } from "@/lib/marketing/seasonal-offer"
import { cn } from "@/lib/utils"

/**
 * CampaignStrip — the seasonal offer wrapper in two shapes.
 *
 * `card` is the standalone dashed aside (unchanged from the original
 * SeasonalOfferBanner). `strip` bonds to the top edge of a PricingSheet: sun
 * ground, ink bottom border, no radius of its own — the sheet's
 * `overflow-hidden` clips it to the sheet's corners.
 *
 * Returns null when no window is active. The resolver never invents a
 * deadline once a window expires.
 */
export function CampaignStrip({
  variant = "card",
  className,
}: {
  variant?: "card" | "strip" | "chip"
  className?: string
}) {
  const offer = getActiveSeasonalOffer()

  if (!offer) return null

  if (variant === "chip") {
    return (
      <p
        aria-label="Current seasonal offer"
        className={cn(
          "inline-flex items-center gap-2 rounded-(--radius-sheet) border-2 border-ink bg-card px-4 py-1.5",
          className
        )}
      >
        <span aria-hidden="true" className="size-1.5 shrink-0 bg-primary" />
        <span className="mono-meta text-foreground">{offer.deadlineLine}</span>
      </p>
    )
  }

  if (variant === "strip") {
    return (
      <aside
        aria-label="Current seasonal offer"
        className={cn(
          "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b-2 border-ink bg-seal px-5 py-3 text-seal-foreground sm:px-7",
          className
        )}
      >
        <p className="mono-meta">{offer.deadlineLine}</p>
        <p className="text-sm leading-6 font-bold">{offer.name}</p>
      </aside>
    )
  }

  return (
    <aside
      aria-label="Current seasonal offer"
      className={cn(
        "grid gap-2 rounded-lg border-2 border-dashed border-primary bg-primary/8 p-4",
        className
      )}
    >
      <MonoTag tone="sun" className="justify-self-start">
        Fixed campaign window
      </MonoTag>
      <p className="text-base leading-6 font-extrabold text-foreground">
        {offer.name}
      </p>
      <p className="text-sm leading-6 font-bold text-foreground">
        {offer.deadlineLine}
      </p>
      <p className="text-xs leading-5 text-muted-foreground">
        {offer.termsLine}
      </p>
    </aside>
  )
}
