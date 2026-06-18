import { CustomerCardSkeleton } from "@/components/customer/loading-skeletons"

// Covers `/card/[membershipId]` and its `/stamp` child — both force-dynamic, so
// without this the navigation freezes on the previous page until Supabase
// answers. The skeleton mirrors the receipt + stamp grid so nothing reflows.
export default function CustomerCardLoading() {
  return <CustomerCardSkeleton />
}
