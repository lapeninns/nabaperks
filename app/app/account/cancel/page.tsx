import Link from "next/link"
import { redirect } from "next/navigation"
import {
  ArrowLeft01Icon,
  ReceiptPoundSterlingIcon,
} from "@hugeicons/core-free-icons"

import { EmptyState, Icon, PageTitle, ReceiptCard } from "@/components/brand"
import { CancellationInterviewForm } from "@/components/merchant/account/cancellation-interview-form"
import { Button } from "@/components/ui/button"
import { getCurrentMerchant } from "@/lib/auth/session"
import { getMerchantBilling } from "@/lib/merchant/billing"

export const metadata = { title: "Review cancellation" }

export default async function CancellationReviewPage() {
  const merchant = await getCurrentMerchant()
  if (!merchant) redirect("/app/onboarding")

  const result = await getMerchantBilling(merchant.id)
  const cancellable =
    result.ok &&
    Boolean(result.billing?.stripe_subscription_id) &&
    ["trialing", "active", "past_due"].includes(result.billing?.status ?? "")

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Account · Billing"
        title="Before you cancel"
        description="Tell us what did not work. You can request help without changing your subscription, or continue straight to Stripe cancellation."
        actions={
          // "Stay" is the outcome the product wants, so it is visible on
          // arrival rather than a full-width secondary below a form the
          // merchant has to scroll past first (03#62).
          <Button asChild variant="secondary">
            <Link href="/app/account?tab=billing">
              <Icon icon={ArrowLeft01Icon} size={16} />
              Back to billing
            </Link>
          </Button>
        }
      />
      {cancellable ? (
        <ReceiptCard edge padding="md" className="gap-5">
          <CancellationInterviewForm />
        </ReceiptCard>
      ) : (
        // Nothing to cancel is an empty state with a way onwards, not a
        // near-blank card holding one muted sentence (03#62).
        <EmptyState
          icon={ReceiptPoundSterlingIcon}
          title="Nothing to cancel"
          description="There is no active or trialling subscription on this venue. Your billing page shows the current plan state."
          actions={
            <Button asChild>
              <Link href="/app/account?tab=billing">Open billing</Link>
            </Button>
          }
        />
      )}
    </div>
  )
}
