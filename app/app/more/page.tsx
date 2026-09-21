import { redirect } from "next/navigation"
import { Suspense } from "react"

import { signOutAction } from "@/app/(auth)/actions"
import { MoreListSkeleton } from "@/components/merchant/loading-skeletons"
import { MoreList } from "@/components/merchant/more-list"
import { MoreRailRedirect } from "@/components/merchant/more-rail-redirect"
import { getCurrentMerchant } from "@/lib/auth/session"
import { loadMoreRowsInput } from "@/lib/merchant/more-data"
import { buildMoreRows } from "@/lib/merchant/more-model"

export const dynamic = "force-dynamic"

/** More — the configure-once destinations (handoff §6.4). */
export default async function MerchantMorePage() {
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    redirect("/app/onboarding")
  }

  return (
    <>
      <MoreRailRedirect />
      <Suspense fallback={<MoreListSkeleton />}>
        <MoreListStream merchant={merchant} />
      </Suspense>
    </>
  )
}

async function MoreListStream({
  merchant,
}: {
  merchant: { readonly id: string; readonly requires_billing: boolean | null }
}) {
  const input = await loadMoreRowsInput(merchant)
  return <MoreList rows={buildMoreRows(input)} signOutAction={signOutAction} />
}
