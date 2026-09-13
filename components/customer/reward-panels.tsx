import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowDown01Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { CelebrationUrlCleanup } from "@/components/customer/celebration-url-cleanup"
import { CustomerReceipt } from "@/components/customer/customer-flow-system"
import { CustomerProfileGateForm } from "@/components/customer/profile-gate-forms"
import { RewardCollectionLive } from "@/components/customer/reward-collection-live"
import { RewardTicket, StatusBanner } from "@/components/loyalty"
import { StampCelebration } from "@/components/motion"
import { Button } from "@/components/ui/button"
import {
  collectionSetup,
  type CollectionSetup,
} from "@/lib/customer/experience/collection-stage"
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

type WaitingExperience = Extract<
  CustomerExperience,
  { kind: "reward_waiting" }
>

type ReadyExperience = Extract<CustomerExperience, { kind: "reward_ready" }>

export function RewardWaitingPanel({ exp }: { exp: WaitingExperience }) {
  if (exp.preparing) return <RewardPreparePanel exp={exp} />

  const readyDate = exp.reward.redeemableFrom
    ? formatStampDisplayDateFromIso(exp.reward.redeemableFrom)
    : null
  const setup = exp.profileGate ? collectionSetup(exp.profileGate) : undefined

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
      {/* Offered only where something is genuinely outstanding: a customer
          whose details are already saved and verified sees no extra step. */}
      {setup?.outstanding ? (
        <Button asChild size="lg" className="w-full">
          <Link href={`/reward/${exp.reward.rewardId}?prepare=1`}>
            Get ready to collect
          </Link>
        </Button>
      ) : null}
      <Button asChild size="lg" variant="secondary" className="w-full">
        <Link href={`/card/${exp.reward.membershipId}`}>Return to card</Link>
      </Button>
    </CustomerReceipt>
  )
}

/**
 * The optional early step from a waiting reward: the same collection details
 * the ready reward asks for, completed before the reward opens. It reuses the
 * existing gate form and its server actions, so nothing here can move the
 * reward's timing or make it collectable sooner — the panel says so in as many
 * words, and there is no QR on this screen.
 */
function RewardPreparePanel({ exp }: { exp: WaitingExperience }) {
  const gate = exp.profileGate
  const setup = gate ? collectionSetup(gate) : undefined
  const backHref = `/reward/${exp.reward.rewardId}`

  return (
    <section className="grid gap-4">
      {gate && setup?.outstanding ? (
        <>
          <CustomerProfileGateForm rewardId={exp.reward.rewardId} gate={gate} />
          <p className="text-center text-xs leading-5 text-muted-foreground">
            Finishing this now does not change when your reward opens.{" "}
            {waitingRewardTiming(exp.reward.redeemableFrom)}
          </p>
        </>
      ) : (
        <StatusBanner title="Your details are ready" tone="success">
          Nothing else to complete. {waitingRewardTiming(exp.reward.redeemableFrom)}
        </StatusBanner>
      )}
      <Button asChild size="lg" variant="secondary" className="w-full">
        <Link href={backHref}>Back to your reward</Link>
      </Button>
    </section>
  )
}

export function RewardReadyPanel({
  exp,
  qrSrc,
}: {
  exp: ReadyExperience
  /** Harness-only QR source override — see {@link RewardCollectionQr}. */
  qrSrc?: string
}) {
  const setup = collectionSetup(exp.profileGate)

  return setup.outstanding ? (
    <RewardCollectionSetupPanel exp={exp} setup={setup} />
  ) : (
    <RewardCollectionPanel exp={exp} setup={setup} qrSrc={qrSrc} />
  )
}

/**
 * Collection requirements that are still outstanding. The shell headline is the
 * step ("Complete your details" / "Verify your email") and the reward stays
 * named beside it as context, so nothing on the screen tells the customer to
 * present a code they cannot produce yet.
 */
function RewardCollectionSetupPanel({
  exp,
  setup,
}: {
  exp: ReadyExperience
  setup: CollectionSetup
}) {
  return (
    <section className="grid gap-4">
      <CustomerProfileGateForm
        rewardId={exp.reward.rewardId}
        gate={exp.profileGate}
      />
      {setup.stage === "details" ? (
        <p className="text-center text-xs leading-5 text-muted-foreground">
          Your reward is held for you while you finish this.
        </p>
      ) : null}
    </section>
  )
}

/**
 * The collection screen, with the code first. Repeated headings, the receipt
 * frame and the reward blurb used to push the QR below the fold on a 390×844
 * phone; the shell now carries the reward name and venue, so this panel is the
 * scannable code, the one instruction beside it, the photo-ID requirement where
 * the venue still has to check it, and the terms behind a disclosure.
 */
function RewardCollectionPanel({
  exp,
  setup,
  qrSrc,
}: {
  exp: ReadyExperience
  setup: CollectionSetup
  qrSrc?: string
}) {
  return (
    <section className="grid gap-3 short:gap-2">
      <RewardCollectionLive
        rewardId={exp.reward.rewardId}
        rewardName={exp.reward.rewardName}
        idCheckRequired={setup.stage === "id_check"}
        qrSrc={qrSrc}
      />
      <RewardDetailsDisclosure
        reward={exp.reward}
        merchantName={exp.merchantName}
      />
    </section>
  )
}

/**
 * The reward blurb, its terms and the card number, after the code rather than
 * above it. Collapsed by default and keyboard operable — the same quiet
 * disclosure the card screen uses for its own technical details.
 */
function RewardDetailsDisclosure({
  reward,
  merchantName,
}: {
  reward: RewardView
  merchantName: string
}) {
  return (
    <details className="group text-left">
      <summary className="focus-ring flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 rounded-sm text-xs font-bold text-ink-soft underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">
        Reward details and terms
        <Icon
          icon={ArrowDown01Icon}
          size={14}
          className="text-ink-soft transition-transform duration-[var(--w-dur-fast)] ease-[var(--w-ease)] group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="mt-2 grid gap-2">
        <p className="text-sm leading-6 text-muted-foreground">
          {reward.rewardName} at {merchantName}. {reward.rewardTerms}
        </p>
        <p className="mono-id tracking-[0.08em] text-muted-foreground">
          {cardNumber(reward.membershipId)}
        </p>
      </div>
    </details>
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
        The team has scanned your code. A new stamp cycle has started.
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
