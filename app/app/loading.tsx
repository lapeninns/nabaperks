import { MerchantPageTitleSkeleton } from "@/components/merchant/loading-skeletons"

// Generic route fallback for every `/app/*` segment: just the page-title
// placeholder. Each page then renders its real title synchronously and streams
// its own structural section skeletons, so the route → page transition is a
// single predictable step instead of a dashboard-shaped flash.
export default function MerchantAppLoading() {
  return (
    <div
      aria-label="Loading merchant workspace"
      role="status"
      className="grid gap-6"
    >
      <MerchantPageTitleSkeleton />
    </div>
  )
}
