import { redirect } from "next/navigation"

import { signOutCustomerAction } from "@/app/wallet/actions"
import { CustomerAppShell } from "@/components/layout"
import { getCustomerSession } from "@/lib/customer/session"

export default async function WalletLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getCustomerSession()

  if (!session) {
    redirect("/wallet/login?next=/wallet")
  }

  return (
    <CustomerAppShell signOutAction={signOutCustomerAction}>
      {children}
    </CustomerAppShell>
  )
}
