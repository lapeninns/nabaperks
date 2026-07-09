import Link from "next/link"

import { SectionHeader } from "@/components/brand"
import { Button } from "@/components/ui/button"
import {
  merchantBillingStateCopy,
  shouldShowMerchantDashboardBillingNotice,
} from "@/lib/merchant/billing-status-copy"

// The billing-status → copy/routing logic now lives in a pure, unit-tested lib.
// Re-export the predicate/formatter so existing importers keep one import site.
export {
  formatMerchantBillingStatus,
  shouldShowMerchantDashboardBillingNotice,
} from "@/lib/merchant/billing-status-copy"

export function MerchantBillingNotice({ status }: { readonly status: string }) {
  if (!shouldShowMerchantDashboardBillingNotice(status)) return null

  const billing = merchantBillingStateCopy(status)

  return (
    <section className={billing.className}>
      <SectionHeader
        title={<span className={billing.titleClassName}>{billing.title}</span>}
        description={billing.description}
        actions={
          billing.actionHref ? (
            <Button asChild variant={billing.actionVariant} size="sm">
              <Link href={billing.actionHref} prefetch={false}>
                {billing.actionLabel}
              </Link>
            </Button>
          ) : null
        }
      />
    </section>
  )
}

export function MerchantBillingAccessNote({
  status,
}: {
  readonly status: string
}) {
  const billing = merchantBillingStateCopy(status)

  return <p className={billing.noteClassName}>{billing.description}</p>
}
