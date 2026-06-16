import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { signOutCustomerAction } from "@/app/home/actions"
import { CustomerAppShell } from "@/components/layout"
import { getCustomerSession } from "@/lib/customer/session"
import { getCurrentCustomer } from "@/lib/customer/identity"
import {
  customerLoginHref,
  customerSessionResetHref,
} from "@/lib/navigation/safe-next-path"
import { readRequestPath } from "@/lib/navigation/request-path"

export default async function HomeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const returnPath = readRequestPath(await headers())
  const session = await getCustomerSession()

  if (!session) {
    redirect(customerLoginHref(returnPath))
  }

  const customer = await getCurrentCustomer()

  if (!customer) {
    redirect(customerSessionResetHref(returnPath))
  }

  return (
    <CustomerAppShell signOutAction={signOutCustomerAction}>
      {children}
    </CustomerAppShell>
  )
}
