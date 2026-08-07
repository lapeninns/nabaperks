import { CustomerHomeSkeleton } from "@/components/customer/loading-skeletons"

// Sits inside the authed CustomerAppShell, so the header and tab bar stay put
// while the dashboard data resolves. This is the DASHBOARD's skeleton only —
// activity, rewards and profile each own one that matches what actually
// arrives (CUS 02#67).
export default function HomeLoading() {
  return <CustomerHomeSkeleton />
}
