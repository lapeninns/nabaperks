import Link from "next/link"

import { PageTitle } from "@/components/brand"
import { MerchantCustomersTableSkeleton } from "@/components/merchant/loading-skeletons"
import { Button } from "@/components/ui/button"

/**
 * Members' own route fallback (03#66).
 *
 * The generic `/app/*` fallback is a lone page-title skeleton, so navigating
 * here showed three layout states: title skeleton -> real title + table
 * skeleton -> content. The route fallback and the page's own Suspense fallback
 * are now the same shape, and because the page title and its two actions are
 * static copy they render for real rather than as bars — the same pattern as
 * `app/app/activity/loading.tsx` and `app/app/scan/loading.tsx`.
 *
 * The actions are real links on purpose: they work while the table streams, so
 * a merchant heading for "Invite customers" is not made to wait for a member
 * list they were never going to read.
 */
export default function MerchantCustomersLoading() {
  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Members"
        title="Loyalty members"
        description="Stamp progress and reward status for everyone who has joined your card."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href="/app/customers/invite">Invite customers</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/app/customers/send-reward">Send a reward</Link>
            </Button>
          </div>
        }
      />
      <MerchantCustomersTableSkeleton />
    </div>
  )
}
