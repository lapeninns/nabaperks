import Link from "next/link"
import { redirect } from "next/navigation"

import { GiftIcon } from "@hugeicons/core-free-icons"

import { EmptyState, MonoTag, PageTitle, ReceiptCard } from "@/components/brand"
import { Disclosure } from "@/components/merchant/launch/disclosure"
import { SendRewardForm } from "@/components/merchant/send-reward-form"
import { Button } from "@/components/ui/button"
import { getCurrentMerchant } from "@/lib/auth/session"
import {
  getMerchantSentRewards,
  type SentReward,
} from "@/lib/merchant/sent-rewards"
import { rewardPresetsForBusinessType } from "@/lib/merchant/reward-presets"

export const dynamic = "force-dynamic"

/** Rows shown before the rest fold into the "Older sent rewards" disclosure. */
const RECENT_SENT_VISIBLE = 5

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/London",
})

export default async function SendRewardPage({
  searchParams,
}: {
  searchParams?: Promise<{
    member?: string | string[]
    label?: string | string[]
  }>
}) {
  const merchant = await getCurrentMerchant()
  if (!merchant) {
    redirect("/app/onboarding")
  }

  const params = searchParams ? await searchParams : {}
  const membershipId = firstParam(params.member)
  const memberLabel = firstParam(params.label)
  const sent = await getMerchantSentRewards(merchant.id)

  const recent = sent.slice(0, RECENT_SENT_VISIBLE)
  const older = sent.slice(RECENT_SENT_VISIBLE)

  return (
    <div className="grid min-w-0 gap-6">
      <PageTitle
        eyebrow="Members"
        title="Send a reward"
        description="Give a member a reward outside the stamp card. It redeems like any other reward, and you choose when it expires."
        actions={
          <Button asChild variant="secondary">
            <Link href="/app/customers">Back to members</Link>
          </Button>
        }
      />

      {/* Form and its history side by side from lg, stacked below it. */}
      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-6">
        <ReceiptCard className="grid gap-4" padding="md">
          <SendRewardForm
            membershipId={membershipId}
            memberLabel={memberLabel}
            presets={rewardPresetsForBusinessType(merchant.business_type)}
          />
        </ReceiptCard>

        {/* Always rendered, so a first-time merchant learns the history exists
            rather than meeting a section that only appears once it is too late
            to be a surprise. Capped at five with the rest behind a disclosure,
            so a venue that sends weekly does not grow an endless page. */}
        <ReceiptCard className="grid gap-3" padding="md">
          <h2 className="text-lg leading-snug font-extrabold text-foreground">
            Recently sent
          </h2>
          {sent.length > 0 ? (
            <>
              <p className="mono-meta text-muted-foreground">
                Pending: waiting for the member to claim it · Claimed: already
                redeemed at your counter
              </p>
              <ul className="grid gap-2">
                {recent.map((reward) => (
                  <SentRow key={reward.rewardId} reward={reward} />
                ))}
              </ul>
              {older.length > 0 ? (
                <Disclosure label={`Older sent rewards (${older.length})`}>
                  <ul className="grid gap-2">
                    {older.map((reward) => (
                      <SentRow key={reward.rewardId} reward={reward} />
                    ))}
                  </ul>
                </Disclosure>
              ) : null}
            </>
          ) : (
            <EmptyState
              headingLevel={3}
              icon={GiftIcon}
              title="Nothing sent yet"
              description="Rewards you send by hand show up here with their claim status."
              className="bg-background"
            />
          )}
        </ReceiptCard>
      </div>
    </div>
  )
}

function SentRow({ reward }: { reward: SentReward }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary px-3 py-2.5">
      <div className="grid min-w-0 gap-0.5">
        <span className="text-sm font-bold text-foreground">
          {reward.rewardName}
        </span>
        <span className="text-xs text-muted-foreground">
          {reward.memberLabel} ·{" "}
          {dateFormatter.format(new Date(reward.createdAt))}
        </span>
      </div>
      <MonoTag tone={reward.statusTone}>{reward.statusLabel}</MonoTag>
    </li>
  )
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
