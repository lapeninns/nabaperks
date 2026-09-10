import Link from "next/link"
import { notFound } from "next/navigation"

import { PageTitle, ReceiptCard } from "@/components/brand"
import {
  firstAccountSearchParamValue,
  type AccountSearchParams,
} from "@/components/merchant/account/account-tabs"
import { Button } from "@/components/ui/button"
import { isCancellableMerchantSubscription } from "@/lib/merchant/billing-cancellable"

import { CancellationInterviewHarnessClient } from "./harness-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type CancelHarnessPageProps = {
  searchParams?: Promise<AccountSearchParams>
}

const HARNESS_SUBSCRIPTION_ID = "sub_harness_owned"

/**
 * Cancellation interview harness — mounts the REAL
 * {@link CancellationInterviewForm} with fixture billing states that follow the
 * production cancellable rule (`stripe_subscription_id` present and status in
 * trialing | active | past_due). The injected action never contacts Stripe.
 */
export default async function CancelHarnessPage({
  searchParams,
}: CancelHarnessPageProps) {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const params = searchParams ? await searchParams : {}
  const billingState = firstAccountSearchParamValue(params.billing) ?? "none"
  const billing = resolveCancelHarnessBilling(billingState)
  const cancellable = isCancellableMerchantSubscription(billing)

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Account · Billing"
        title="Before you cancel"
        description="Tell us what did not work. You can request help without changing your subscription, or continue straight to Stripe cancellation."
      />
      <ReceiptCard edge padding="md" className="gap-5">
        {cancellable ? (
          <CancellationInterviewHarnessClient />
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            There is no active or trialling subscription available to cancel.
          </p>
        )}
        <Button asChild variant="secondary" className="w-full sm:w-fit">
          <Link href="/app/account?tab=billing">Back to billing</Link>
        </Button>
      </ReceiptCard>
    </div>
  )
}

function resolveCancelHarnessBilling(state: string): {
  stripe_subscription_id: string | null
  status: string | null
} | null {
  if (state === "trialing" || state === "active" || state === "past_due") {
    return {
      stripe_subscription_id: HARNESS_SUBSCRIPTION_ID,
      status: state,
    }
  }

  if (state === "cancelled") {
    return {
      stripe_subscription_id: HARNESS_SUBSCRIPTION_ID,
      status: "cancelled",
    }
  }

  return null
}
