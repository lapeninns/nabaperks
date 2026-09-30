import Link from "next/link"

import { AlertDiamondIcon } from "@hugeicons/core-free-icons"

import { EmptyState } from "@/components/brand"
import {
  CustomerFlowShell,
  CustomerReceipt,
} from "@/components/customer/customer-flow-system"
import { Button } from "@/components/ui/button"
import { OPEN_MY_CARDS_LABEL } from "@/lib/copy/product-copy"

/** Guest journey Q3: a network or service failure, said in guest words. */
export const CUSTOMER_LOAD_FAILED_TITLE = "We couldn't load this card"
export const CUSTOMER_LOAD_FAILED_DESCRIPTION =
  "Check your signal or Wi-Fi, then try again."

/**
 * The join page or a venue QR could not load its venue and card because a
 * service it depends on failed or ran out of time. Nothing is known to be
 * wrong with the card or the QR, so the guest is offered a retry of the same
 * address instead of being sent to find another QR (QA BUG-041, BUG-042).
 */
export function CustomerLoadFailed({
  retryHref,
  screenLabel,
}: {
  retryHref: string
  screenLabel: string
}) {
  return (
    <CustomerFlowShell
      eyebrow="Try again"
      className="content-center"
      screenLabel={screenLabel}
    >
      <CustomerReceipt venueName="Nabaperks" eyebrow="Try again" hideFooter>
        <EmptyState
          icon={AlertDiamondIcon}
          title={CUSTOMER_LOAD_FAILED_TITLE}
          description={CUSTOMER_LOAD_FAILED_DESCRIPTION}
          headingLevel={1}
          className="w-full"
          actions={
            <div className="grid w-full gap-2">
              <Button asChild size="lg" className="w-full">
                <Link href={retryHref}>Try again</Link>
              </Button>
              <Button asChild size="lg" variant="secondary" className="w-full">
                <Link href="/home">{OPEN_MY_CARDS_LABEL}</Link>
              </Button>
            </div>
          }
        />
      </CustomerReceipt>
    </CustomerFlowShell>
  )
}
