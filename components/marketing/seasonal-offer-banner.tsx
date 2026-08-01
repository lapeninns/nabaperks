import { MonoTag } from "@/components/brand"
import { getActiveSeasonalOffer } from "@/lib/marketing/seasonal-offer"
import { cn } from "@/lib/utils"

export function SeasonalOfferBanner({ className }: { className?: string }) {
  const offer = getActiveSeasonalOffer()

  if (!offer) return null

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
