import { Suspense } from "react"

import { PageTitle } from "@/components/brand"
import { AccountTabBar } from "@/components/merchant/account/account-tab-bar"
import {
  firstAccountSearchParamValue,
  resolveAccountOutcomeParams,
  resolveAccountTab,
  type AccountSearchParams,
} from "@/components/merchant/account/account-tabs"
import { BillingPanel } from "@/components/merchant/account/billing-panel"
import { LocationsPanel } from "@/components/merchant/account/locations-panel"
import { ProfilePanel } from "@/components/merchant/account/profile-panel"
import {
  AccountBillingPanelSkeleton,
  AccountProfilePanelSkeleton,
} from "@/components/merchant/loading-skeletons"

export const dynamic = "force-dynamic"

const TAB_HEADING = {
  profile: {
    title: "Profile",
    description: "Your business and venue details. Save when you're done.",
  },
  billing: {
    title: "Billing",
    description: "Your plan and payments, handled securely by Stripe.",
  },
  locations: {
    title: "Locations",
    description: "Add venues, review join QR links, and keep each site ready.",
  },
} as const

type AccountPageProps = {
  searchParams: Promise<AccountSearchParams>
}

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const params = await searchParams
  const tab = resolveAccountTab(params.tab)
  const outcomeParams = resolveAccountOutcomeParams(params)
  const locationStatus = firstAccountSearchParamValue(params.locations)

  const heading = TAB_HEADING[tab]

  return (
    <div className="grid gap-6">
      <PageTitle title={heading.title} description={heading.description} />
      <AccountTabBar activeTab={tab} />

      {tab === "locations" ? (
        <Suspense key="locations" fallback={<AccountProfilePanelSkeleton />}>
          <LocationsPanel status={locationStatus} />
        </Suspense>
      ) : tab === "billing" ? (
        <Suspense key="billing" fallback={<AccountBillingPanelSkeleton />}>
          <BillingPanel params={outcomeParams} />
        </Suspense>
      ) : (
        <Suspense key="profile" fallback={<AccountProfilePanelSkeleton />}>
          <ProfilePanel />
        </Suspense>
      )}
    </div>
  )
}
