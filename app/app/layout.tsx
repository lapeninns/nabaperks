import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"

import { signOutAction } from "@/app/(auth)/actions"
import { MerchantAppShell } from "@/components/layout"
import { getCurrentUser } from "@/lib/auth/session"
import { merchantLoginHref } from "@/lib/navigation/safe-next-path"
import { readMerchantRequestPath } from "@/lib/navigation/request-path"

export default async function MerchantAppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const requestHeaders = await headers()
  const returnPath = readMerchantRequestPath(requestHeaders)
  const activePath = stripSearch(returnPath)
  const user = await getCurrentUser()

  if (!user) {
    redirect(merchantLoginHref(returnPath))
  }

  const cookieStore = await cookies()
  const defaultSidebarOpen = cookieStore.get("sidebar_state")?.value !== "false"

  return (
    <MerchantAppShell
      signOutAction={signOutAction}
      activePath={activePath}
      variant={isMerchantSetupPath(activePath) ? "setup" : "full"}
      defaultSidebarOpen={defaultSidebarOpen}
    >
      {children}
    </MerchantAppShell>
  )
}

function stripSearch(path: string): string {
  return path.split("?")[0] ?? path
}

function isMerchantSetupPath(path: string): boolean {
  return (
    path === "/app/onboarding" ||
    path.startsWith("/app/onboarding/") ||
    path === "/app/launch" ||
    path.startsWith("/app/launch/")
  )
}
