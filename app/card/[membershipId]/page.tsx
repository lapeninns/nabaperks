import Link from "next/link"

import { Eyebrow, ReceiptCard, VenueMark } from "@/components/brand"
import { CustomerShell } from "@/components/layout"
import {
  ProgressTrack,
  RewardTeaser,
  StampGrid,
  StatusBanner,
} from "@/components/loyalty"
import { StampCelebration } from "@/components/motion"
import { Button } from "@/components/ui/button"
import { getCustomerCardState } from "@/lib/customer/card"

type CustomerCardPageProps = {
  params: Promise<{
    membershipId: string
  }>
  searchParams: Promise<{
    stamp?: string
    reward?: string
  }>
}

export default async function CustomerCardPage({
  params,
  searchParams,
}: CustomerCardPageProps) {
  const { membershipId } = await params
  const { stamp, reward } = await searchParams
  const cardState = await getCustomerCardState(membershipId)

  if (cardState.status !== "ready") {
    return <CardAccessState status={cardState.status} />
  }

  if (!cardState.loyaltyCard) {
    return (
      <CardShell>
        <UnavailableCard message="This loyalty card is unavailable." />
      </CardShell>
    )
  }

  const { membership, merchant, loyaltyCard, latestReward } = cardState
  const target = loyaltyCard.stamps_required
  const current = Math.min(membership.current_stamp_count, target)
  const rewardUnlocked = latestReward?.status === "unlocked"
  const rewardRedeemable =
    rewardUnlocked &&
    (!latestReward.redeemable_from || latestReward.redeemable_from <= ukTodayIso())
  const stampsBlocked = cardState.billingStatus === "cancelled"

  return (
    <CardShell>
      <div className="grid gap-4">
        {stamp === "issued" ? (
          <StampCelebration>
            <StatusBanner
              title="Stamp added."
              tone="success"
              className="text-center"
            >
              That&apos;s one. Your progress has been updated.
            </StatusBanner>
          </StampCelebration>
        ) : null}
        {reward === "redeemed" ? (
          <StatusBanner
            title="Reward redeemed."
            tone="success"
            className="text-center"
          >
            New stamp cycle started.
          </StatusBanner>
        ) : null}

        <ReceiptCard edge className="grid gap-5" aria-label="Stamp card">
            <div className="flex items-start justify-between gap-4">
              <div className="grid gap-1">
                <Eyebrow>Digital stamp card</Eyebrow>
                <h1 className="text-2xl leading-tight font-extrabold text-balance">
                  {merchant.business_name}
                </h1>
                <p className="text-sm leading-6 text-muted-foreground">
                  {loyaltyCard.card_name}
                </p>
              </div>
              <VenueMark size={56} name={merchant.business_name} />
            </div>

            <hr className="w-rule" />

            <StampGrid
              current={current}
              total={target}
              slamIndex={stamp === "issued" ? current - 1 : -1}
            />

            <ProgressTrack
              current={current}
              total={target}
              label="Reward progress"
              className="rounded-lg bg-accent p-4"
            />

            <RewardState
              teaserName={loyaltyCard.reward_name}
              teaserTerms={loyaltyCard.reward_terms}
              latestReward={latestReward}
              rewardRedeemable={Boolean(rewardRedeemable)}
            />

            {cardState.unavailableReason ? (
              <UnavailableCard message={cardState.unavailableReason} />
            ) : rewardUnlocked && rewardRedeemable ? (
              <Button asChild size="lg" variant="reward" className="w-full">
                <Link href={`/reward/${latestReward.id}`}>Redeem reward</Link>
              </Button>
            ) : rewardUnlocked ? (
              <StatusNotice message="Come back from the next UK business day to redeem." />
            ) : stampsBlocked ? (
              <StatusNotice message="This merchant is not accepting new stamps right now." />
            ) : (
              <Button asChild size="lg" className="w-full">
                <Link href={`/card/${membership.id}/stamp`}>
                  Get today&apos;s stamp
                </Link>
              </Button>
            )}

            <div className="flex items-center justify-between">
              <span className="font-mono text-[0.625rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                Nabaperks loyalty
              </span>
              <span className="font-mono text-[0.625rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                One stamp per day
              </span>
            </div>
        </ReceiptCard>
      </div>
    </CardShell>
  )
}


function RewardState({
  teaserName,
  teaserTerms,
  latestReward,
  rewardRedeemable,
}: {
  teaserName: string
  teaserTerms: string
  latestReward: {
    id: string
    status: string
    reward_name: string
    reward_terms: string
    min_spend_pence: number | null
    redeemable_from: string | null
  } | null
  rewardRedeemable: boolean
}) {
  const revealed = latestReward?.status === "unlocked"
  const rewardName = revealed ? latestReward.reward_name : teaserName
  const rewardTerms = revealed ? latestReward.reward_terms : teaserTerms
  const minSpendPence =
    revealed && latestReward.min_spend_pence !== undefined
      ? latestReward.min_spend_pence
      : null

  return (
    <RewardTeaser
      locked={!revealed}
      title={rewardName}
      description={
        <>
          {rewardTerms}
          {minSpendPence !== null ? (
            <>
              {" "}
              Minimum spend {formatPence(minSpendPence)}.
            </>
          ) : null}
          {rewardRedeemable ? " Reward ready to redeem." : null}
          {revealed && !rewardRedeemable
            ? " Come back from the next UK business day to redeem."
            : null}
        </>
      }
    />
  )
}

function UnavailableCard({ message }: { message: string }) {
  return (
    <StatusBanner title="Card unavailable" tone="error">
      {message}
    </StatusBanner>
  )
}

function StatusNotice({ message }: { message: string }) {
  return (
    <StatusBanner title="Stamps unavailable" tone="warning">
      {message}
    </StatusBanner>
  )
}

function CardAccessState({
  status,
}: {
  status: "unauthenticated" | "unauthorized" | "not_found"
}) {
  const message =
    status === "unauthenticated"
      ? "Verify your identity from the venue QR to view this card."
      : status === "unauthorized"
        ? "This card belongs to another customer."
        : "This card could not be found."

  return (
    <CardShell>
      <section className="surface-card p-6 text-center">
        <p className="font-mono text-xs uppercase text-muted-foreground">
          Nabaperks loyalty
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight">
          Card unavailable
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {message}
        </p>
      </section>
    </CardShell>
  )
}

function CardShell({ children }: { children: React.ReactNode }) {
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
