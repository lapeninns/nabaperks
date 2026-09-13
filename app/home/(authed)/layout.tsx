import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { CustomerAppShell } from "@/components/layout"
import { getCustomerSession } from "@/lib/customer/session"
import { getCurrentCustomer } from "@/lib/customer/identity"
import {
  customerLoginHref,
  customerSessionResetHref,
} from "@/lib/navigation/safe-next-path"
import { readRequestPath } from "@/lib/navigation/request-path"
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata"

export const metadata: Metadata = PRIVATE_ROUTE_METADATA

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

  // Sign-out is not a shell concern any more: it lives in the Profile screen's
  // account section (`app/home/(authed)/profile/page.tsx`), still submitted from a
  // form to the same `signOutCustomerAction` server action.
  return <CustomerAppShell>{children}</CustomerAppShell>
}
