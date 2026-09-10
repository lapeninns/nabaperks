import Link from "next/link"
import { redirect } from "next/navigation"

import { PageTitle, ReceiptCard } from "@/components/brand"
import { CancellationInterviewForm } from "@/components/merchant/account/cancellation-interview-form"
import { Button } from "@/components/ui/button"
import { getCurrentMerchant } from "@/lib/auth/session"
import { getMerchantBilling } from "@/lib/merchant/billing"
import { isCancellableMerchantSubscription } from "@/lib/merchant/billing-cancellable"

export const metadata = { title: "Review cancellation" }

export default async function CancellationReviewPage() {
  const merchant = await getCurrentMerchant()
  if (!merchant) redirect("/app/onboarding")

  const result = await getMerchantBilling(merchant.id)
  const cancellable =
    result.ok && isCancellableMerchantSubscription(result.billing)

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Account · Billing"
        title="Before you cancel"
        description="Tell us what did not work. You can request help without changing your subscription, or continue straight to Stripe cancellation."
      />
      <ReceiptCard edge padding="md" className="gap-5">
        {cancellable ? (
          <CancellationInterviewForm />
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
