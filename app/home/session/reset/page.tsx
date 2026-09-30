import type { Metadata } from "next"

import { resetCustomerSessionAction } from "@/app/home/session/reset/actions"
import { ReceiptCard, VenueMark } from "@/components/brand"
import { CustomerShell } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { safeNextPath } from "@/lib/navigation/safe-next-path"
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata"

export const metadata: Metadata = {
  ...PRIVATE_ROUTE_METADATA,
  title: "Sign in again · Nabaperks",
}

type CustomerSessionResetPageProps = {
  searchParams: Promise<{ next?: string | string[] }>
}

export default async function CustomerSessionResetPage({
  searchParams,
}: CustomerSessionResetPageProps) {
  const params = await searchParams
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next
  const next = safeNextPath(rawNext ?? "/home")

  return (
    <CustomerShell>
      <ReceiptCard edge className="grid gap-6">
        <div className="grid justify-items-center gap-3 text-center">
          <VenueMark size={56} name="Nabaperks" caption="My Nabaperks" />
          <div className="grid gap-2">
            <h1 className="text-2xl leading-tight font-extrabold text-balance">
              Sign in again
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              We couldn&apos;t open your cards with this sign-in. Sign in again
              with your mobile number. Your stamps are safe.
            </p>
          </div>
        </div>

        <form action={resetCustomerSessionAction} className="grid gap-3">
          <input type="hidden" name="next" value={next} />
          <Button type="submit">Sign in again</Button>
        </form>
      </ReceiptCard>
    </CustomerShell>
  )
}
