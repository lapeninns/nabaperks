import { redirect } from "next/navigation"

import { signOutCustomerAction } from "@/app/home/actions"
import { CustomerAppShell } from "@/components/layout"
import { getCustomerSession } from "@/lib/customer/session"

export default async function HomeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getCustomerSession()

  if (!session) {
    redirect("/home/login?next=/home")
  }

  return (
    <CustomerAppShell signOutAction={signOutCustomerAction}>
      {children}
    </CustomerAppShell>
  )
}
