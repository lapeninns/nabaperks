import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowDown01Icon, Tick02Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { CelebrationUrlCleanup } from "@/components/customer/celebration-url-cleanup"
import { CustomerReceipt } from "@/components/customer/customer-flow-system"
import { CustomerProfileGateForm } from "@/components/customer/profile-gate-forms"
import { RewardCollectionLive } from "@/components/customer/reward-collection-live"
import { RewardTicket, StatusBanner } from "@/components/loyalty"
import { StampCelebration } from "@/components/motion"
import { Button } from "@/components/ui/button"
import {
  collectionDoneChecklist,
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
  ProfileGate,
  RewardView,
} from "@/lib/customer/experience/types"
import {
  collectionWindowCopy,
  formatCollectionAvailableLabel,
  formatCollectionDeadline,
} from "@/lib/customer/reward-collection-state"

type WaitingExperience = Extract<CustomerExperience, { kind: "reward_waiting" }>

type ReadyExperience = Extract<CustomerExperience, { kind: "reward_ready" }>

export function RewardWaitingPanel({ exp }: { exp: WaitingExperience }) {
  if (exp.preparing) return <RewardPreparePanel exp={exp} />

  const readyDate = exp.reward.availableFrom
    ? formatCollectionAvailableLabel(exp.reward.availableFrom)
    : null
  const setup = exp.profileGate
    ? collectionSetup(exp.profileGate, exp.reward.requiresAgeCheck)
    : undefined

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
        requiresAgeCheck={exp.reward.requiresAgeCheck}
        earningTerms={exp.reward.earningTerms}
        expiryText={formatCollectionDeadline(exp.reward.expiresAt)}
        collectionWindowText={collectionWindowCopy(exp.reward)}
      />
      {/* The date is the server's and setup never moves it, so the offer to
          get ready is worded as something the guest can do now, not sooner. */}
      {setup?.outstanding ? (
        <>
          <p className="text-center text-sm leading-6 text-muted-foreground">
            You can get it ready now.
          </p>
          <Button asChild size="lg" className="w-full">
            <Link href={`/reward/${exp.reward.rewardId}?prepare=1`}>
              Get it ready
            </Link>
          </Button>
        </>
      ) : null}
      <Button asChild size="lg" variant="secondary" className="w-full">
        <Link href={`/card/${exp.reward.membershipId}`}>Back to my card</Link>
      </Button>
    </CustomerReceipt>
  )
}

/**
 * The optional early step from a waiting reward: the same collection details
 * the ready reward asks for, completed before the reward opens. It reuses the
 * existing gate form and its server actions, so nothing here can move the
 * reward's timing or make it collectable sooner, and there is no QR on this
 * screen. The date is stated once, as the server gave it.
 */
function RewardPreparePanel({ exp }: { exp: WaitingExperience }) {
  const gate = exp.profileGate
  const setup = gate
    ? collectionSetup(gate, exp.reward.requiresAgeCheck)
    : undefined
  const backHref = `/reward/${exp.reward.rewardId}`

  return (
    <section className="grid gap-4">
      {gate && setup?.outstanding ? (
        <>
          <CollectionDoneList gate={gate} />
          <CustomerProfileGateForm rewardId={exp.reward.rewardId} gate={gate} />
          <p className="text-center text-xs leading-5 text-muted-foreground">
            {waitingRewardTiming(exp.reward.availableFrom)} Getting it ready now
            doesn&apos;t change the date.
          </p>
        </>
      ) : (
        <StatusBanner title="Your details are ready" tone="success">
          {waitingRewardTiming(exp.reward.availableFrom)}
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
  const setup = collectionSetup(exp.profileGate, exp.reward.requiresAgeCheck)

  return setup.outstanding ? (
    <RewardCollectionSetupPanel exp={exp} />
  ) : (
    <RewardCollectionPanel exp={exp} setup={setup} qrSrc={qrSrc} />
  )
}

/**
 * Collection requirements that are still outstanding. The shell headline is the
 * next unmet requirement and the reward stays named beside it as context, so
 * nothing on the screen tells the customer to present a code they cannot
 * produce yet. What is already done shows as a ticked list, never as fields.
 */
function RewardCollectionSetupPanel({ exp }: { exp: ReadyExperience }) {
  return (
    <section className="grid gap-4">
      <CollectionDoneList gate={exp.profileGate} />
      <CustomerProfileGateForm
        rewardId={exp.reward.rewardId}
        gate={exp.profileGate}
      />
    </section>
  )
}

/** The compact "done" checklist: each met requirement with a tick. */
function CollectionDoneList({ gate }: { gate: ProfileGate }) {
  const done = collectionDoneChecklist(gate)
  if (done.length === 0) return null

  return (
    <ul
      className="grid gap-1 rounded-lg border-2 border-dashed border-border px-3 py-2"
      aria-label="Already done"
      data-collection-done
    >
      {done.map((item) => (
        <li
          key={item}
          className="flex items-center gap-2 text-sm leading-6 text-ink-soft"
        >
          <Icon icon={Tick02Icon} size={16} className="text-leaf" />
          {item}
        </li>
      ))}
    </ul>
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
        poll={qrSrc === undefined}
      />
      {/* The upgrade window is a nudge, not the action: it sits after the code so
          a short landscape viewport still shows the whole scannable code above
          the fixed navigation. */}
      {collectionWindowCopy(exp.reward) ? (
        <StatusBanner title="Collection upgrade" tone="success">
          {collectionWindowCopy(exp.reward)}
        </StatusBanner>
      ) : null}
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
        {reward.earningTerms ? (
          <p className="text-sm leading-6 text-muted-foreground">
            {reward.earningTerms}
          </p>
        ) : null}
        {formatCollectionDeadline(reward.expiresAt) ? (
          <p className="text-sm leading-6 text-muted-foreground">
            {formatCollectionDeadline(reward.expiresAt)}
          </p>
        ) : null}
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
      // "Collect" throughout, never the internal "redeem" (R5).
      eyebrow="Reward collected"
      footerLeft={cardNumber(exp.reward.membershipId)}
      footerRight="COLLECTED"
    >
      <RewardTicket
        headingLevel="h2"
        state="redeemed"
        eyebrow="Collected"
        name={exp.reward.rewardName}
        description={rewardTermsNode(exp.reward)}
        sealSlammed={exp.justRedeemed}
      />
      {/* The shell headline says "Collected. Enjoy."; this adds only what
          changed on the card and, below, when and where. */}
      <p className="text-center text-sm leading-6 text-muted-foreground">
        Your card has started again from the first stamp.
      </p>
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
