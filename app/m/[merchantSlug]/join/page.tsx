import Link from "next/link"

import {
  CustomerIdentityForm,
  CustomerJoinForm,
} from "@/components/customer/join-forms"
import { Eyebrow, ReceiptCard, VenueMark } from "@/components/brand"
import { CustomerShell } from "@/components/layout"
import {
  ProgressTrack,
  RewardTeaser,
  StampGrid,
  StatusBanner,
} from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import { getCurrentUser } from "@/lib/auth/session"
import {
  getExistingMembershipForCurrentUser,
  getMerchantJoinContext,
} from "@/lib/customer/join"

type MerchantJoinPageProps = {
  params: Promise<{
    merchantSlug: string
  }>
  searchParams: Promise<{
    qr?: string
    membership?: string
  }>
}

export default async function MerchantJoinPage({
  params,
  searchParams,
}: MerchantJoinPageProps) {
  const { merchantSlug } = await params
  const query = await searchParams
  let context: Awaited<ReturnType<typeof getMerchantJoinContext>>

  try {
    context = await getMerchantJoinContext(merchantSlug, query.qr)
  } catch {
    return <UnavailableJoin />
  }

  if (!context?.available) {
    return <UnavailableJoin />
  }

  const user = await getCurrentUser()
  const membership = user
    ? await getExistingMembershipForCurrentUser(context.merchant.id)
    : null
  const merchantTermsUrl = `/merchant/${merchantSlug}/terms`

  return (
    <CustomerShell className="grid content-center">
      <ReceiptCard edge className="grid gap-5">
        <div className="grid gap-2 text-center">
          <Eyebrow>No app loyalty</Eyebrow>
          <h1 className="text-3xl font-extrabold leading-tight text-balance">
            Join {context.merchant.business_name} Rewards - no app needed.
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            {context.loyaltyCard.card_name}. Collect visit stamps and reveal a
            surprise reward on the final stamp.
          </p>
        </div>

        <div>
          <ReceiptCard edge className="grid gap-4 text-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="grid gap-1">
                <Eyebrow>Mystery visit summary</Eyebrow>
                <p className="text-base leading-tight font-extrabold">
                  Collect {context.loyaltyCard.stamps_required} visit stamps
                </p>
              </div>
              <VenueMark size={48} name={context.merchant.business_name} />
            </div>

            <StampGrid current={0} total={context.loyaltyCard.stamps_required} />

            <p className="leading-6 text-muted-foreground">
              Your assigned reward stays hidden until the final stamp and can be
              redeemed from the next UK business day.
            </p>

            <ProgressTrack
              current={0}
              total={context.loyaltyCard.stamps_required}
              label="Visits to reveal"
            />
            {context.loyaltyCard.min_spend_pence !== null ? (
              <p className="font-mono text-xs text-muted-foreground">
                Minimum spend {formatPence(context.loyaltyCard.min_spend_pence)}.
              </p>
            ) : null}
            <Link
              className="inline-flex w-fit text-xs font-bold underline underline-offset-4"
              href={merchantTermsUrl}
            >
              View full venue terms
            </Link>
          </ReceiptCard>
        </div>

        {membership ? (
          <CustomerCardSummary
            membershipId={membership.id}
            stampsRequired={context.loyaltyCard.stamps_required}
            currentStampCount={membership.current_stamp_count}
          />
        ) : user ? (
          <CustomerJoinForm
            merchantSlug={merchantSlug}
            qrId={query.qr}
            merchantTermsUrl={merchantTermsUrl}
          />
        ) : (
          <CustomerIdentityForm merchantSlug={merchantSlug} qrId={query.qr} />
        )}
      </ReceiptCard>
    </CustomerShell>
  )
}

function CustomerCardSummary({
  membershipId,
  stampsRequired,
  currentStampCount,
}: {
  membershipId: string
  stampsRequired: number
  currentStampCount: number
}) {
  return (
    <div className="grid gap-4">
      <StatusBanner title="You're already joined" tone="success">
        Your stamp card is ready. Continue from your current progress.
      </StatusBanner>
      <StampGrid current={currentStampCount} total={stampsRequired} />
      <ProgressTrack
        current={currentStampCount}
        total={stampsRequired}
        label="Current progress"
      />
      <RewardTeaser
        locked
        title={`Locked until visit ${stampsRequired}`}
        description={
          <>
          {currentStampCount} of {stampsRequired} stamps collected.
          </>
        }
      />
      <Button asChild size="lg" className="w-full">
        <Link href={`/card/${membershipId}`}>Open your stamp card</Link>
      </Button>
    </div>
  )
}

function UnavailableJoin() {
  return (
    <CustomerShell className="grid content-center">
      <StatusBanner
        title="This loyalty card is unavailable"
        tone="neutral"
        className="text-center"
      >
        Ask a team member for the current loyalty QR.
      </StatusBanner>
    </CustomerShell>
  )
}

function formatPence(pence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100)
}

