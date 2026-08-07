import { PageTitle } from "@/components/brand"
import { ActivityFeedSkeleton } from "@/components/merchant/loading-skeletons"

/**
 * Activity's own route fallback (03#66).
 *
 * The generic `/app/*` fallback is a lone page-title skeleton, so navigating
 * here showed three layout states: title skeleton → real title + feed skeleton
 * → content. The route fallback and the page's own Suspense fallback are now
 * the same shape, and because the page title is static copy it is rendered for
 * real rather than as a bar. `app/app/scan/loading.tsx` is the same pattern.
 */
export default function MerchantActivityLoading() {
  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Activity"
        title="Activity"
        description="Everything happening on your loyalty card: joins, stamps, rewards, and QR downloads."
      />
      <ActivityFeedSkeleton />
    </div>
  )
}
