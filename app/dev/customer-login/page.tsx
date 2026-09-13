import { notFound } from "next/navigation"

import { CustomerLoginForm } from "@/components/customer/customer-login-form"
import { CustomerShell } from "@/components/layout"
import { requestLoginFixture, verifyLoginFixture } from "./actions"

export default async function CustomerLoginHarness({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string }>
}) {
  if (process.env.NODE_ENV === "production") notFound()
  const { scenario = "default" } = await searchParams
  return (
    <CustomerShell>
      <CustomerLoginForm
        next="/home"
        requestCodeAction={requestLoginFixture.bind(null, scenario)}
        verifyCodeAction={verifyLoginFixture.bind(null, scenario)}
      />
    </CustomerShell>
  )
}
