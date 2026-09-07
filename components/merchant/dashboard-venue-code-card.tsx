import { Eyebrow, MonoTag, ReceiptCard } from "@/components/brand"
import type { resetVenueCodeAction } from "@/app/app/actions"
import {
  VenueCodeResetForm,
  VenueCodeReveal,
} from "@/components/merchant/venue-code-reveal"
import { getCurrentMerchant } from "@/lib/auth/session"
import { getVenueCodeToday } from "@/lib/merchant/venue-code"

/**
 * Dashboard card for today's venue code — the fallback a team member reads
 * out when a customer's phone couldn't confirm they're at the venue. Streamed
 * in its own Suspense boundary so the read never blocks the header or the
 * metrics. The async half hits Supabase; the view is mounted DB-free by the
 * `/dev/app-harness` with fixture props.
 */
export async function DashboardVenueCodeCard() {
  const merchant = await getCurrentMerchant()
  if (!merchant) return null

  const today = await getVenueCodeToday(merchant.id)
  return <DashboardVenueCodeCardView code={today?.code ?? null} />
}

type DashboardVenueCodeCardViewProps = {
  readonly code: string | null
  readonly resetAction?: typeof resetVenueCodeAction
}

export function DashboardVenueCodeCardView({
  code,
  resetAction,
}: DashboardVenueCodeCardViewProps) {
  return (
    <ReceiptCard edge className="grid gap-4">
      <div className="grid gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <Eyebrow>Today&apos;s code</Eyebrow>
          <MonoTag tone="sun">Changes daily at 5am</MonoTag>
        </div>
        <h2 className="text-xl leading-tight font-extrabold sm:text-2xl">
          Team code
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          If a member&apos;s phone can&apos;t confirm they&apos;re here, read
          them this code. They type it on their own phone and today&apos;s stamp
          lands as normal.
        </p>
      </div>

      {code ? (
        <VenueCodeReveal code={code} />
      ) : (
        <p className="rounded-lg border-2 border-dashed border-ink/25 bg-paper-deep/45 p-3 text-sm leading-5 font-bold text-muted-foreground">
          Today&apos;s code isn&apos;t available right now. Refresh in a moment.
        </p>
      )}

      <VenueCodeResetForm action={resetAction} />
    </ReceiptCard>
  )
}
