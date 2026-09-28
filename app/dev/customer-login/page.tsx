import { notFound } from "next/navigation"

import { CustomerLoginForm } from "@/components/customer/customer-login-form"
import { CustomerShell } from "@/components/layout"
import type { JoinEmailMode } from "@/lib/customer/experience/types"
import { safeNextPath } from "@/lib/navigation/safe-next-path"
import { submitLoginFixture } from "./actions"

/** `?mode=existing|full` shows email sign-in; anything else is phone only. */
function harnessEmailMode(mode: string | undefined): JoinEmailMode {
  return mode === "existing" || mode === "full" ? mode : "off"
}

export default async function CustomerLoginHarness({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string; next?: string; mode?: string }>
}) {
  if (process.env.NODE_ENV === "production") notFound()
  const { scenario = "default", next = "/home", mode } = await searchParams
  return (
    <CustomerShell>
      <CustomerLoginForm
        next={safeNextPath(next)}
        emailMode={harnessEmailMode(mode)}
        loginAction={submitLoginFixture.bind(null, scenario)}
      />
    </CustomerShell>
  )
}
