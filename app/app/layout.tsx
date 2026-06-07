import { redirect } from "next/navigation"

import { signOutAction } from "@/app/(auth)/actions"
import { MerchantAppShell } from "@/components/layout"
import { getCurrentUser } from "@/lib/auth/session"

export default async function MerchantAppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login?next=/app")
  }

  return (
    <MerchantAppShell signOutAction={signOutAction}>{children}</MerchantAppShell>
  )
}
