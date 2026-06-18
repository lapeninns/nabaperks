import { CustomerHomeSkeleton } from "@/components/customer/loading-skeletons"

// Sits inside the authed CustomerAppShell, so the header and tab bar stay put
// while the dashboard data resolves. Covers the dashboard, activity, rewards,
// and profile tabs unless one adds its own loading.tsx.
export default function HomeLoading() {
  return <CustomerHomeSkeleton />
}
