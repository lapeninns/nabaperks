import Link from "next/link"

import {
  CustomerIdentityForm,
  CustomerJoinForm,
} from "@/components/customer/join-forms"
import { Eyebrow } from "@/components/brand"
import { CustomerShell } from "@/components/layout"
import { RewardTeaser, StampGrid } from "@/components/loyalty"
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
  const context = await getMerchantJoinContext(merchantSlug, query.qr)

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
      <section className="grid gap-5 rounded-3xl border bg-card p-6 shadow-xs">
        <div className="grid gap-2 text-center">
          <Eyebrow>No app loyalty</Eyebrow>
          <h1 className="text-3xl font-extrabold leading-tight">
            Join {context.merchant.business_name} Rewards - no app needed.
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            {context.loyaltyCard.card_name}. Collect visit stamps and reveal a
            surprise reward on the final stamp.
          </p>
        </div>

        <div className="rounded-3xl border bg-background p-4 text-sm">
          <p className="font-bold">Mystery visit summary</p>
          <p className="mt-2 leading-6 text-muted-foreground">
            Collect {context.loyaltyCard.stamps_required} visit stamps. Your
            assigned reward stays hidden until the final stamp and can be
            redeemed from the next UK business day.
          </p>
          {context.loyaltyCard.min_spend_pence !== null ? (
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              Minimum spend {formatPence(context.loyaltyCard.min_spend_pence)}.
            </p>
          ) : null}
          <Link
            className="mt-3 inline-flex text-xs font-bold underline underline-offset-4"
            href={merchantTermsUrl}
          >
            View full venue terms
          </Link>
        </div>

        {membership ? (
          <CustomerCardSummary
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
      </section>
    </CustomerShell>
  )
}

function CustomerCardSummary({
  stampsRequired,
  currentStampCount,
}: {
  stampsRequired: number
  currentStampCount: number
}) {
  return (
    <div className="grid gap-4">
      <StampGrid current={currentStampCount} total={stampsRequired} />
      <RewardTeaser
        locked
        title={`Locked until visit ${stampsRequired}`}
        description={
          <>
          {currentStampCount} of {stampsRequired} stamps collected.
          </>
        }
      />
    </div>
  )
}

function UnavailableJoin() {
  return (
    <CustomerShell className="grid content-center">
      <section className="rounded-3xl border bg-card p-6 text-center shadow-xs">
        <Eyebrow>Stampiee loyalty</Eyebrow>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight">
          This loyalty card is unavailable
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Ask a team member for the current loyalty QR.
        </p>
      </section>
    </CustomerShell>
  )
}

function formatPence(pence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100)
}
