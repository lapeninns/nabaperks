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
  const sidebarCookieOpen = cookieStore.get("sidebar_state")?.value !== "false"
  const posterFocus = isPosterPrintPath(activePath)

  return (
    <MerchantAppShell
      signOutAction={signOutAction}
      activePath={activePath}
      variant={isMerchantSetupPath(activePath) ? "setup" : "full"}
      hideMobileChrome={posterFocus}
      defaultSidebarOpen={sidebarCookieOpen}
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

// The poster print preview is a full-bleed surface that carries its own header
// (PosterPreviewChrome). Suppress the shell's mobile header + bottom tab bar so
// they don't double-stack or occlude the scaled A4 sheet on phones.
function isPosterPrintPath(path: string): boolean {
  return path.startsWith("/app/qr/poster/")
}
