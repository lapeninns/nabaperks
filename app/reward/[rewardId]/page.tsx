import Link from "next/link"

import { RewardRedemptionForm } from "@/components/customer/reward-redemption-form"
import { CustomerShell } from "@/components/layout"
import { RewardTeaser, StatusBanner } from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import { getCustomerRewardState } from "@/lib/customer/reward"

type RewardPageProps = {
  params: Promise<{
    rewardId: string
  }>
}

export default async function RewardPage({ params }: RewardPageProps) {
  const { rewardId } = await params
  const rewardState = await getCustomerRewardState(rewardId)

  if (rewardState.status !== "ready") {
    return <RewardAccessState status={rewardState.status} />
  }

  const { reward, assignedReward, loyaltyCard, merchant, membership } = rewardState
  const redeemable =
    reward.status === "unlocked" &&
    !rewardState.unavailableReason &&
    membership.current_stamp_count >= loyaltyCard.stamps_required &&
    (!reward.redeemable_from || reward.redeemable_from <= ukTodayIso())

  return (
    <RewardShell>
      <section className="surface-card grid gap-5 rounded-[2rem] border bg-card p-6 shadow-xs">
        <div className="grid gap-2 text-center">
          <p className="font-mono text-xs uppercase text-muted-foreground">
            Reward
          </p>
          <h1 className="text-3xl font-extrabold leading-tight text-balance">
            {assignedReward.reward_name}
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            {merchant.business_name}
          </p>
        </div>

        <RewardTeaser
          locked={reward.status !== "unlocked"}
          title={assignedReward.reward_name}
          description={
            <>
              {assignedReward.reward_terms}
              {assignedReward.min_spend_pence !== null ? (
                <>
                  {" "}
                  Minimum spend {formatPence(assignedReward.min_spend_pence)}.
                </>
              ) : null}
            </>
          }
        />

        <RewardStatusPanel
          status={reward.status}
          unavailableReason={rewardState.unavailableReason}
          redeemable={redeemable}
          redeemableFrom={reward.redeemable_from}
        />

        {redeemable ? (
          <RewardRedemptionForm rewardId={reward.id} />
        ) : (
          <Button asChild size="lg" variant="secondary" className="w-full">
            <Link href={`/card/${reward.membership_id}`}>Return to card</Link>
          </Button>
        )}
      </section>
    </RewardShell>
  )
}

function RewardStatusPanel({
  status,
  unavailableReason,
  redeemable,
  redeemableFrom,
}: {
  status: string
  unavailableReason?: string
  redeemable: boolean
  redeemableFrom: string | null
}) {
  if (unavailableReason) {
    return (
      <StatusBanner title="Reward unavailable" tone="error">
        {unavailableReason}
      </StatusBanner>
    )
  }

  if (status === "redeemed") {
    return (
      <StatusBanner title="Reward redeemed" tone="neutral">
        This reward has already been redeemed.
      </StatusBanner>
    )
  }

  if (status === "cancelled" || status === "expired") {
    return (
      <StatusBanner title="Reward unavailable" tone="error">
        This reward is no longer available.
      </StatusBanner>
    )
  }

  if (
    status === "unlocked" &&
    redeemableFrom &&
    redeemableFrom > ukTodayIso()
  ) {
    return (
      <StatusBanner title="Come back later" tone="warning">
        Come back from the next UK business day to redeem this reward.
      </StatusBanner>
    )
  }

  if (!redeemable) {
    return (
      <StatusBanner title="Not ready yet" tone="neutral">
        This reward is not ready to redeem.
      </StatusBanner>
    )
  }

  return (
    <StatusBanner title="Ready for staff confirmation." tone="success">
      Ask a team member to enter the venue staff PIN.
    </StatusBanner>
  )
}

function RewardAccessState({
  status,
}: {
  status: "unauthenticated" | "unauthorized" | "not_found"
}) {
  const message =
    status === "unauthenticated"
      ? "Verify your identity from the venue QR to view this reward."
      : status === "unauthorized"
        ? "This reward belongs to another customer."
        : "This reward could not be found."

  return (
    <RewardShell>
      <section className="surface-card rounded-[2rem] border bg-card p-6 text-center shadow-xs">
        <p className="font-mono text-xs uppercase text-muted-foreground">
          Stampiee loyalty
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight">
          Reward unavailable
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {message}
        </p>
      </section>
    </RewardShell>
  )
}

function RewardShell({ children }: { children: React.ReactNode }) {
  return <CustomerShell>{children}</CustomerShell>
}

function formatPence(pence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100)
}

function ukTodayIso() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value

  return `${year}-${month}-${day}`
}
