import type { Metadata } from "next"
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { Suspense } from "react"

import { signOutAction } from "@/app/(auth)/actions"
import { MerchantAppShell } from "@/components/layout"
import { MerchantSetupReminder } from "@/components/merchant/merchant-setup-reminder"
import { getCurrentUser } from "@/lib/auth/session"
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

  const cookieStore = await cookies()
  const sidebarCookieOpen = cookieStore.get("sidebar_state")?.value !== "false"

  // The shell derives its variant (full vs. setup) and mobile-chrome suppression
  // from the live pathname on the client. This layout is shared across every
  // `/app/*` route and the App Router preserves it across soft navigations, so a
  // request-time variant computed here would go stale (the reported "sidebar
  // sometimes disappears" bug). We only seed the cookie-backed sidebar state.
  return (
    <MerchantAppShell
      signOutAction={signOutAction}
      defaultSidebarOpen={sidebarCookieOpen}
    >
      <Suspense fallback={null}>
        <MerchantSetupReminder />
      </Suspense>
      {children}
    </MerchantAppShell>
  )
}
