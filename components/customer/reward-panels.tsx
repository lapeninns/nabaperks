import type { ReactNode } from "react"
import Link from "next/link"

import { CustomerReceipt } from "@/components/customer/customer-flow-system"
import { CustomerProfileGateForm } from "@/components/customer/profile-gate-forms"
import { RewardCollectionQr } from "@/components/customer/reward-collection-qr"
import { RewardTicket, StatusBanner } from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import type { CustomerExperienceViewModel } from "@/lib/customer/experience/copy"
import type {
  CustomerExperience,
  RewardView,
} from "@/lib/customer/experience/types"
import { formatStampDisplayDateFromIso } from "@/lib/customer/uk-calendar"

export function RewardWaitingPanel({
  exp,
}: {
  exp: Extract<CustomerExperience, { kind: "reward_waiting" }>
}) {
  const readyDate = exp.reward.redeemableFrom
    ? formatStampDisplayDateFromIso(exp.reward.redeemableFrom)
    : null

  return (
    <CustomerReceipt
      venueName={exp.merchantName}
      eyebrow="Mystery reward"
      footerLeft={cardNumber(exp.reward.membershipId)}
    >
      <RewardTicket
        state="waiting"
        name={exp.reward.rewardName}
        description={rewardTermsNode(exp.reward)}
        readyDate={readyDate}
      />
      <StatusBanner title="Give it a day to breathe" tone="warning">
        It&apos;s yours from opening time tomorrow.
      </StatusBanner>
      <Button asChild size="lg" variant="secondary" className="w-full">
        <Link href={`/card/${exp.reward.membershipId}`}>Return to card</Link>
      </Button>
    </CustomerReceipt>
  )
}

export function RewardReadyPanel({
  exp,
}: {
  exp: Extract<CustomerExperience, { kind: "reward_ready" }>
}) {
  return (
    <CustomerReceipt
      venueName={exp.merchantName}
      eyebrow="Mystery reward"
      footerLeft={cardNumber(exp.reward.membershipId)}
    >
      <RewardTicket
        state="ready"
        name={exp.reward.rewardName}
        description={rewardTermsNode(exp.reward)}
      />
      {exp.profileGate.complete ? (
        <>
          <StatusBanner title="Ready for merchant scan." tone="success">
            Show this QR at the counter. The merchant scans it from their device
            and collects the reward.
          </StatusBanner>
          <RewardCollectionQr
            rewardId={exp.reward.rewardId}
            rewardName={exp.reward.rewardName}
          />
        </>
      ) : (
        <CustomerProfileGateForm
          rewardId={exp.reward.rewardId}
          gate={exp.profileGate}
        />
      )}
    </CustomerReceipt>
  )
}

export function RedeemedProofPanel({
  exp,
  vm,
}: {
  exp: Extract<CustomerExperience, { kind: "redeemed_proof" }>
  vm: CustomerExperienceViewModel
}) {
  return (
    <section className="grid gap-5">
      <CustomerReceipt
        venueName={exp.merchantName}
        eyebrow="Redeemed"
        footerLeft={cardNumber(exp.reward.membershipId)}
        footerRight="REDEEMED"
      >
        <RewardTicket
          state="redeemed"
          name={exp.reward.rewardName}
          description={rewardTermsNode(exp.reward)}
        />
        <StatusBanner title="Reward collected." tone="success">
          The merchant has scanned your QR. A new stamp cycle has started.
        </StatusBanner>
      </CustomerReceipt>
      <PrimaryLink action={vm.primaryAction} />
    </section>
  )
}

function PrimaryLink({
  action,
  variant = "default",
}: {
  action?: { label: string; href: string }
  variant?: "default" | "secondary"
}) {
  if (!action) return null

  return (
    <Button asChild size="lg" variant={variant} className="w-full">
      <Link href={action.href}>{action.label}</Link>
    </Button>
  )
}

function rewardTermsNode(reward: RewardView): ReactNode {
  return (
    <>
      {reward.rewardTerms}
      {reward.minSpendPence !== null ? (
        <> Minimum spend {formatPence(reward.minSpendPence)}.</>
      ) : null}
    </>
  )
}

function cardNumber(membershipId: string): string {
  return `CARD Nº ${membershipId.slice(0, 8).toUpperCase()}`
}

function formatPence(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100)
}
