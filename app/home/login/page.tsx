import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { Eyebrow, ReceiptCard, VenueMark } from "@/components/brand"
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
      <ReceiptCard edge className="grid gap-6">
        <div className="grid justify-items-center gap-3 text-center">
          <VenueMark size={56} name="Nabaperks" caption="My Nabaperks" />
          <div className="grid gap-1">
            <Eyebrow>My Nabaperks</Eyebrow>
            <h1 className="text-2xl leading-tight font-extrabold text-balance">
              Welcome back
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              Sign in to see every loyalty card you&apos;ve collected, track
              your rewards, and pick up where you left off.
            </p>
          </div>
        </div>

        <CustomerLoginForm next={next} />

        <p className="border-t-2 border-ink/15 pt-4 text-center text-sm leading-6 text-muted-foreground">
          New here? Scan a venue&apos;s QR code to collect your first stamp —
          your first card is created automatically.
        </p>
      </ReceiptCard>
    </CustomerShell>
  )
}
