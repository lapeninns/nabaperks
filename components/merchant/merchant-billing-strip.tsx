import { NavigationLink as Link } from "@/components/ui/navigation-link"
import { Alert02Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { getCurrentMerchant } from "@/lib/auth/session"
import {
  merchantBillingStateCopy,
  shouldShowMerchantBillingStrip,
} from "@/lib/merchant/billing-status-copy"
import { getBillingStatus } from "@/lib/merchant/dashboard-counts"

/**
 * Persistent billing attention strip under the console top bar. Streams in
 * its own Suspense boundary from the shared layout so every tab carries it;
 * a failed read renders nothing rather than blocking the shell. It never
 * blocks the Counter QR — a venue that owes money still has customers at
 * the bar.
 */
export async function MerchantBillingStrip() {
  const merchant = await getCurrentMerchant()
  if (!merchant) return null

  let status: string
  try {
    status = await getBillingStatus(merchant.id, merchant.status)
  } catch {
    return null
  }

  if (!shouldShowMerchantBillingStrip(status)) return null

  return <MerchantBillingStripView status={status} />
}

/** Presentational half, mounted DB-free by the harness. */
export function MerchantBillingStripView({
  status,
}: {
  readonly status: string
}) {
  const copy = merchantBillingStateCopy(status)

  return (
    <Alert
      variant="destructive"
      data-console-billing-strip={status}
      className="mb-4 rounded-lg border-2 border-ink shadow-xs"
    >
      <Icon icon={Alert02Icon} size={16} />
      <AlertTitle>{copy.title}</AlertTitle>
      <AlertDescription>{copy.description}</AlertDescription>
      {copy.actionHref ? (
        // Column 2 beside the icon, like the title and description, so the
        // CTA never widens the icon column on compact phones.
        <div className="col-start-2 mt-2">
          <Button asChild variant="outline" size="sm" className="w-fit">
            <Link href={copy.actionHref} prefetch={false}>
              {copy.actionLabel}
            </Link>
          </Button>
        </div>
      ) : null}
    </Alert>
  )
}
