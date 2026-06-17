import { headers } from "next/headers"
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
  const user = await getCurrentUser()

  if (!user) {
    const returnPath = readMerchantRequestPath(await headers())
    redirect(merchantLoginHref(returnPath))
  }

  return (
    <MerchantAppShell signOutAction={signOutAction}>
      {children}
    </MerchantAppShell>
  )
}
