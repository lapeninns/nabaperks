import { ReceiptCard } from "@/components/brand"
import { ScanCardHeader } from "@/components/merchant/merchant-reward-scanner"
import { Skeleton } from "@/components/ui/skeleton"

// Scan-scoped route fallback. The generic `/app/*` loading.tsx renders a
// left-aligned page-title skeleton, which snaps awkwardly to this route's
// centered receipt card. Mirror the real scanner surface instead: a narrow,
// centered receipt card with the real shared header (instantly available, so no
// skeleton flash or title-size shift), the camera viewport frame, a status
// line, and the back action — so the route → page swap never shifts layout.
export default function MerchantRewardScanLoading() {
  return (
    <div className="mx-auto w-full max-w-xl">
      <ReceiptCard
        edge
        className="grid gap-5 p-6"
        role="status"
        aria-label="Loading reward scanner"
      >
        <ScanCardHeader />

        <Skeleton className="min-h-64 rounded-[var(--radius-lg)]" />

        <Skeleton className="h-4 w-40" />

        <Skeleton className="h-11 w-full sm:w-40" />
      </ReceiptCard>
    </div>
  )
}
