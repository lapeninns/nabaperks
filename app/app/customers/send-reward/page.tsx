import Link from "next/link"
import { redirect } from "next/navigation"

import { MonoTag, PageTitle } from "@/components/brand"
import { SendRewardForm } from "@/components/merchant/send-reward-form"
import { Button } from "@/components/ui/button"
import { getCurrentMerchant } from "@/lib/auth/session"
import {
  getMerchantSentRewards,
  type SentReward,
} from "@/lib/merchant/sent-rewards"

export const dynamic = "force-dynamic"

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

      <section className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:p-6">
        <SendRewardForm membershipId={membershipId} memberLabel={memberLabel} />
      </section>

      {sent.length > 0 ? (
        <section className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:p-6">
          <h2 className="text-lg leading-snug font-extrabold text-foreground">
            Recently sent
          </h2>
          <ul className="grid gap-2">
            {sent.map((reward) => (
              <SentRow key={reward.rewardId} reward={reward} />
            ))}
          </ul>
        </section>
      ) : null}
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
          {reward.memberLabel} · {dateFormatter.format(new Date(reward.createdAt))}
          {reward.kind === "invite" ? " · Invite" : ""}
        </span>
      </div>
      <MonoTag tone={reward.statusTone}>{reward.statusLabel}</MonoTag>
    </li>
  )
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
