import {
  MerchantCompactActivitySkeleton,
  MerchantDashboardMetricsSkeleton,
  MerchantPageTitleSkeleton,
} from "@/components/merchant/loading-skeletons"
import AdminLoading from "@/app/admin/loading"

/**
 * Loading-state preview bodies for the merchant/admin console harness. They
 * render the *real* route skeletons inside the shell so the screenshot spec can
 * prove the skeleton dimensions hold the layout steady (no jump, no overflow) at
 * 375px — the swap to populated content must not shift the page.
 *
 * Pure presentation; no Supabase / server-only imports.
 */

/**
 * Mirrors `/app` mid-stream: the route-level page-title placeholder
 * (`MerchantPageTitleSkeleton`, what `app/app/loading.tsx` shows) above the two
 * section fallbacks the dashboard streams (`MerchantDashboardMetricsSkeleton`
 * for the members hero + metric tiles, `MerchantCompactActivitySkeleton` for the
 * recent-activity receipt).
 */
export function MerchantDashboardLoadingScreen() {
  return (
    <div className="grid gap-6">
      <MerchantPageTitleSkeleton />
      <MerchantDashboardMetricsSkeleton />
      <MerchantCompactActivitySkeleton />
    </div>
  )
}

/**
 * Mirrors `/admin/customers` mid-load. The admin pages resolve their readbacks
 * before rendering (no per-section Suspense), so the route-level
 * `app/admin/loading.tsx` skeleton is the real fallback — rendered here verbatim
 * inside the admin shell.
 */
export function AdminCustomersLoadingScreen() {
  return <AdminLoading />
}
