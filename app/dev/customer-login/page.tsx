import { notFound } from "next/navigation"

import { CustomerLoginForm } from "@/components/customer/customer-login-form"
import { CustomerShell } from "@/components/layout"
import { safeNextPath } from "@/lib/navigation/safe-next-path"
import { submitLoginFixture } from "./actions"

export default async function CustomerLoginHarness({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string; next?: string }>
}) {
  if (process.env.NODE_ENV === "production") notFound()
  const { scenario = "default", next = "/home" } = await searchParams
  return (
    <CustomerShell>
      <CustomerLoginForm
        next={safeNextPath(next)}
        loginAction={submitLoginFixture.bind(null, scenario)}
      />
    </CustomerShell>
  )
}
