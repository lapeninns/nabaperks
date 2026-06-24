import { CustomerResolveSkeleton } from "@/components/customer/loading-skeletons"

// `/q/[qrId]` is the first screen after scanning the permanent venue QR, and it
// awaits real server work — resolve the QR, run the scan rate-limit, look up any
// membership — before redirecting to join or stamp-confirm. Without this Suspense
// boundary the navigation freezes on the previous page (or a blank tab on a cold
// scan) until Supabase answers, at the highest-traffic customer entry point.
export default function PublicQrLoading() {
  return <CustomerResolveSkeleton />
}
