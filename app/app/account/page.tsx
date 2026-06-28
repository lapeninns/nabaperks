import { Suspense } from "react"

import { PageTitle } from "@/components/brand"
import { AccountTabBar } from "@/components/merchant/account/account-tab-bar"
import { resolveAccountTab } from "@/components/merchant/account/account-tabs"
import { BillingPanel } from "@/components/merchant/account/billing-panel"
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
} as const

type AccountPageProps = {
  searchParams: Promise<{
    tab?: string
    checkout?: string
    portal?: string
  }>
}

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const params = await searchParams
  const tab = resolveAccountTab(params.tab)

  const heading = TAB_HEADING[tab]

  return (
    <div className="grid gap-6">
      <PageTitle title={heading.title} description={heading.description} />
      <AccountTabBar activeTab={tab} />

      {tab === "billing" ? (
        <Suspense key="billing" fallback={<AccountBillingPanelSkeleton />}>
          <BillingPanel
            params={{ checkout: params.checkout, portal: params.portal }}
          />
        </Suspense>
      ) : (
        <Suspense key="profile" fallback={<AccountProfilePanelSkeleton />}>
          <ProfilePanel />
        </Suspense>
      )}
    </div>
  )
}
