import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Suspense } from "react"

import { signOutAction } from "@/app/(auth)/actions"
import { MerchantAppShell } from "@/components/layout"
import { MerchantBillingStrip } from "@/components/merchant/merchant-billing-strip"
import { MerchantSetupReminder } from "@/components/merchant/merchant-setup-reminder"
import { getCurrentMerchant, getCurrentUser } from "@/lib/auth/session"
import { formatConsoleDate } from "@/lib/merchant/console-date"
import { merchantLoginHref } from "@/lib/navigation/safe-next-path"
import { readMerchantRequestPath } from "@/lib/navigation/request-path"
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata"

export const metadata: Metadata = PRIVATE_ROUTE_METADATA

export default async function MerchantAppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const requestHeaders = await headers()
  const returnPath = readMerchantRequestPath(requestHeaders)
  const user = await getCurrentUser()

  if (!user) {
    redirect(merchantLoginHref(returnPath))
  }

  // Cached for the request, so the pages' own reads add no query. A venue
  // without a profile yet (onboarding) simply gets the generic top bar.
  const merchant = await getCurrentMerchant()

  // The shell derives its variant (full vs. setup) and mobile-chrome suppression
  // from the live pathname on the client. This layout is shared across every
  // `/app/*` route and the App Router preserves it across soft navigations, so a
  // request-time variant computed here would go stale (the reported "sidebar
  // sometimes disappears" bug). Only stable, route-independent values are
  // passed down: the venue name and today's date label.
  return (
    <MerchantAppShell
      signOutAction={signOutAction}
      venueName={merchant?.business_name}
      todayLabel={formatConsoleDate(new Date())}
      liveDate
      billingNotice={
        <Suspense fallback={null}>
          <MerchantBillingStrip />
        </Suspense>
      }
      setupReminder={
        <Suspense fallback={null}>
          <MerchantSetupReminder />
        </Suspense>
      }
    >
      {children}
    </MerchantAppShell>
  )
}
