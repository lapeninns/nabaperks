import { PageTitle, ReceiptCard } from "@/components/brand"
import { Skeleton } from "@/components/ui/skeleton"

// Scan-scoped route fallback. The generic `/app/*` loading.tsx renders a
// left-aligned page-title skeleton, which snaps awkwardly to this route's
// centered receipt card. Mirror the real scan route instead: the real
// PageTitle (instantly available, so no skeleton flash or title-size shift)
// above a narrow centered receipt card holding the camera viewport frame, a
// status line, and the back action — so the route → page swap never shifts
// layout.
export default function MerchantRewardScanLoading() {
  return (
    <div className="mx-auto grid w-full max-w-xl gap-6">
      <PageTitle
        eyebrow="Customer codes"
        title="Scan customer code"
        description="Point your camera at the code on the customer's phone. It can be a reward to collect or a discount pass to honour, and we will open the right screen for it."
      />
      <ReceiptCard
        edge
        className="grid gap-5 p-6"
        role="status"
        aria-label="Loading reward scanner"
      >
        <Skeleton className="mx-auto aspect-square w-full max-w-sm rounded-[var(--radius-lg)]" />

        <Skeleton className="h-4 w-40" />

        <Skeleton className="h-11 w-full sm:w-40" />
      </ReceiptCard>
    </div>
  )
}
