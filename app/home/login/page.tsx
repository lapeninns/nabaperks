import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { CustomerLoginForm } from "@/components/customer/customer-login-form"
import { CustomerShell } from "@/components/layout"
import { getCustomerSession } from "@/lib/customer/session"
import { safeNextPath } from "@/lib/navigation/safe-next-path"
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata"

export const metadata: Metadata = {
  ...PRIVATE_ROUTE_METADATA,
  title: "My Nabaperks · sign in",
}

type HomeLoginPageProps = {
  searchParams: Promise<{
    next?: string | string[] | undefined
  }>
}

export default async function HomeLoginPage({
  searchParams,
}: HomeLoginPageProps) {
  const params = await searchParams
  const nextParam = Array.isArray(params.next) ? params.next[0] : params.next
  const next = safeNextPath(nextParam ?? "/home")
  const session = await getCustomerSession()

  if (session) {
    redirect(next)
  }

  return (
    <CustomerShell>
      <CustomerLoginForm next={next} />
    </CustomerShell>
  )
}
