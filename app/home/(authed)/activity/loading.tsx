import { CustomerActivitySkeleton } from "@/components/customer/loading-skeletons"

// Each authed tab owns its own skeleton. Falling through to the dashboard's
// meant the activity feed announced itself as two loyalty cards with stamp
// rows, then re-laid out entirely when the real content landed (CUS 02#67).
export default function ActivityLoading() {
  return <CustomerActivitySkeleton />
}
