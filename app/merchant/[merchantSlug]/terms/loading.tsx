import { ReceiptCard } from "@/components/brand"
import { CustomerShell } from "@/components/layout"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * The venue terms page awaits a merchant + card read on first paint; this
 * mirrors the terms receipt (header, rule, term rows, action) so direct hits
 * see movement instead of a freeze on slow networks (CUS-P3-20).
 */
export default function MerchantTermsLoading() {
  return (
    <CustomerShell className="grid content-center">
      <div aria-busy="true" className="grid gap-6">
        <ReceiptCard className="grid gap-4">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-6 w-48 max-w-full" />
          <hr className="w-rule" />
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="grid gap-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </ReceiptCard>
        <div className="grid gap-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </CustomerShell>
  )
}
