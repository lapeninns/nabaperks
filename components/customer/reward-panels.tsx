import type { ReactNode } from "react"
import Link from "next/link"

import { CelebrationUrlCleanup } from "@/components/customer/celebration-url-cleanup"
import { CustomerReceipt } from "@/components/customer/customer-flow-system"
import { CustomerProfileGateForm } from "@/components/customer/profile-gate-forms"
import { RewardCollectionLive } from "@/components/customer/reward-collection-live"
import { RewardTicket, StatusBanner } from "@/components/loyalty"
import { StampCelebration } from "@/components/motion"
import { Button } from "@/components/ui/button"
import {
  waitingRewardTiming,
  type CustomerExperienceViewModel,
} from "@/lib/customer/experience/copy"
import { formatRedeemedProofLine } from "@/lib/customer/experience/redeemed-proof"
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
        headingLevel="h2"
        state="waiting"
        name={exp.reward.rewardName}
        description={rewardTermsNode(exp.reward)}
        readyDate={readyDate}
      />
      <StatusBanner title="Give it a day to breathe" tone="warning">
        {waitingRewardTiming(exp.reward.redeemableFrom)}
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
        headingLevel="h2"
        state={
          exp.profileGate.dateOfBirthVerified
            ? "ready"
            : "verification_required"
        }
        name={exp.reward.rewardName}
        description={rewardTermsNode(exp.reward)}
      />
      {exp.profileGate.complete ? (
        <>
          {/* One instruction per screen (F18b): the title confirms the state and
              the single "scans this QR" line lives beside the QR itself. */}
          {exp.profileGate.dateOfBirthVerified ? (
            <StatusBanner title="Ready for merchant scan." tone="success" />
          ) : (
            <StatusBanner title="ID check needed" tone="warning">
              Show this code and your photo ID to the venue owner.
            </StatusBanner>
          )}
          <RewardCollectionLive
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
  const proofLine = formatRedeemedProofLine(
    exp.reward.redeemedAt,
    exp.merchantName
  )
  const receipt = (
    <CustomerReceipt
      venueName={exp.merchantName}
      eyebrow="Redeemed"
      footerLeft={cardNumber(exp.reward.membershipId)}
      footerRight="REDEEMED"
    >
      <RewardTicket
        headingLevel="h2"
        state="redeemed"
        name={exp.reward.rewardName}
        description={rewardTermsNode(exp.reward)}
        sealSlammed={exp.justRedeemed}
      />
      <StatusBanner title="Reward collected." tone="success">
        The merchant has scanned your QR. A new stamp cycle has started.
      </StatusBanner>
      {proofLine ? (
        <p className="mono-id text-center tracking-[0.08em] text-muted-foreground">
          {proofLine}
        </p>
      ) : null}
    </CustomerReceipt>
  )

  return (
    <section className="grid gap-5">
      {exp.justRedeemed ? <CelebrationUrlCleanup /> : null}
      {exp.justRedeemed ? (
        <StampCelebration>{receipt}</StampCelebration>
      ) : (
        receipt
      )}
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
  return <>{reward.rewardTerms}</>
}

function cardNumber(membershipId: string): string {
  return `CARD Nº ${membershipId.slice(0, 8).toUpperCase()}`
}
