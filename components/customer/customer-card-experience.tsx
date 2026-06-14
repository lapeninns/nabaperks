import type { ReactNode } from "react"
import Link from "next/link"

import {
  CustomerActionNote,
  CustomerFlowShell,
  CustomerReceipt,
  CustomerStampCard,
} from "@/components/customer/customer-flow-system"
import { CustomerTabBar } from "@/components/layout"
import {
  SelfServiceRedeemForm,
  SelfServiceStampForm,
} from "@/components/customer/self-service-forms"
import {
  PintReward,
  PintRewardCelebration,
  RewardTeaser,
  StatusBanner,
} from "@/components/loyalty"
import { StampCelebration } from "@/components/motion"
import { Button } from "@/components/ui/button"
import {
  getCustomerExperienceViewModel,
  type CustomerExperienceViewModel,
} from "@/lib/customer/experience/copy"
import type {
  CustomerExperience,
  CustomerExperienceKind,
  RewardView,
} from "@/lib/customer/experience/types"

/**
 * Single rendering surface for the card / stamp / reward routes. The route page
 * derives a {@link CustomerExperience}; this component maps it to the shell chrome
 * (one headline, from the view model) and the matching panel (one job, one CTA).
 * Join states are rendered by `JoinWizard`, not here.
 */
export function CustomerCardExperience({
  experience,
}: {
  experience: CustomerExperience
}) {
  const vm = getCustomerExperienceViewModel(experience)

  return (
    <>
      <CustomerFlowShell
        eyebrow={vm.eyebrow}
        title={vm.headline}
        description={vm.supportLine}
        className="pb-28"
        screenLabel={screenLabelFor(experience.kind)}
      >
        <ExperiencePanel experience={experience} vm={vm} />
      </CustomerFlowShell>
      <CustomerTabBar />
    </>
  )
}

function ExperiencePanel({
  experience,
  vm,
}: {
  experience: CustomerExperience
  vm: CustomerExperienceViewModel
}) {
  switch (experience.kind) {
    case "card_collecting":
      return <CardProgressPanel exp={experience} />
    case "card_stamped_today":
      return <AlreadyStampedPanel exp={experience} vm={vm} />
    case "stamp_confirm":
      return <StampConfirmPanel exp={experience} />
    case "reward_waiting":
      return <RewardWaitingPanel exp={experience} />
    case "reward_ready":
      return <RewardReadyPanel exp={experience} />
    case "redeemed_proof":
      return <RedeemedProofPanel exp={experience} vm={vm} />
    case "unavailable":
      return <UnavailablePanel exp={experience} vm={vm} />
    default:
      // Join states never reach this surface; render the calm fallback.
      return <UnavailablePanel exp={{ kind: "unavailable", reason: vm.supportLine ?? "" }} vm={vm} />
  }
}

function CardProgressPanel({
  exp,
}: {
  exp: Extract<CustomerExperience, { kind: "card_collecting" }>
}) {
  const cardComplete = exp.total > 0 && exp.current >= exp.total
  const rewardLocked = exp.reward === "none"
  const rewardTitle = rewardLocked
    ? "Something's under there."
    : (exp.rewardName ?? "Your reward")
  const rewardDescription = rewardLocked ? (
    <>Mystery reward stays sealed until the final stamp. {exp.rewardTerms}</>
  ) : (
    <>
      {exp.rewardTerms}
      {exp.minSpendPence !== null ? (
        <> Minimum spend {formatPence(exp.minSpendPence)}.</>
      ) : null}
      {exp.reward === "ready"
        ? " Reward ready to redeem."
        : " Give it a day to breathe - it's yours from opening time tomorrow."}
    </>
  )

  return (
    <div className="grid gap-4">
      <Link
        href="/home"
        className="inline-flex w-fit items-center gap-1 text-sm font-bold text-ink-soft underline-offset-4 transition-colors hover:text-foreground hover:underline"
      >
        <span aria-hidden="true">←</span> Your cards
      </Link>

      {exp.justStamped && cardComplete ? (
        // All stamps collected — the headline moment. Pour the pint.
        <PintRewardCelebration
          title="Pint unlocked!"
          message={
            exp.reward === "ready"
              ? "That's the full card. Claim your pint at the counter while you're here."
              : "That's the full card. Your pint is yours from opening time on the next UK business day."
          }
        />
      ) : exp.justJoined ? (
        <StampCelebration>
          <StatusBanner
            title={`Welcome to ${exp.merchantName}.`}
            tone="success"
            className="text-center"
          >
            {exp.justStamped
              ? "You're in — your first stamp is on the card."
              : "You're in. Scan the venue QR in store to collect your first stamp."}
            {exp.justStamped && exp.geoFlagged
              ? " Location could not be confirmed, so the venue may review it."
              : null}
          </StatusBanner>
        </StampCelebration>
      ) : exp.justStamped ? (
        <StampCelebration>
          <StatusBanner title="Stamp added." tone="success" className="text-center">
            That&apos;s one. Your progress has been updated.
            {exp.geoFlagged
              ? " Location could not be confirmed, so the venue may review it."
              : null}
          </StatusBanner>
        </StampCelebration>
      ) : null}

      {exp.justRedeemed ? (
        <StatusBanner title="Reward redeemed." tone="success" className="text-center">
          New stamp cycle started.
        </StatusBanner>
      ) : null}

      <CustomerStampCard
        venueName={exp.merchantName}
        cardName={exp.cardName}
        current={exp.current}
        total={exp.total}
        slamIndex={exp.slamIndex}
        rewardLocked={rewardLocked}
        rewardTitle={rewardTitle}
        rewardDescription={rewardDescription}
        hideFooter
      >
        {exp.reward === "ready" && exp.rewardId ? (
          <Button asChild size="lg" variant="reward" className="w-full">
            <Link href={`/reward/${exp.rewardId}`}>Redeem reward</Link>
          </Button>
        ) : exp.reward === "waiting" ? (
          <StatusNotice
            title="Give it a day to breathe"
            message="It's yours from opening time tomorrow."
          />
        ) : exp.stampsBlocked ? (
          <StatusNotice message="This merchant is not accepting new stamps right now." />
        ) : exp.justStamped ? (
          // Today's stamp is already on the card — confirm it instead of
          // prompting another scan, which would read as a failure.
          <StatusBanner title="Stamp secured." tone="success">
            Your next scan window opens on the next UK business day.
          </StatusBanner>
        ) : (
          <StatusBanner
            title="Scan the venue code to add your stamp."
            tone="neutral"
          >
            Use the printed QR in the venue. One stamp is available per UK
            business day.
          </StatusBanner>
        )}
      </CustomerStampCard>

      <CardDetailsDisclosure cardNumber={cardNumber(exp.membershipId)} />
    </div>
  )
}

/**
 * Secondary technical details (card number, stamp rule) tucked behind a quiet
 * disclosure so the dashboard reads as a reward, not a contract. Collapsed by
 * default — one calm line until the customer asks for the specifics.
 */
function CardDetailsDisclosure({ cardNumber }: { cardNumber: string }) {
  return (
    <details className="group text-left">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 text-xs font-bold text-ink-soft underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">
        Card details
        <span
          aria-hidden="true"
          className="transition-transform group-open:rotate-180"
        >
          ⌄
        </span>
      </summary>
      <dl className="mt-2 grid gap-1.5 font-mono text-[0.625rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
        <div className="flex justify-between gap-3">
          <dt>{cardNumber}</dt>
          <dd>One stamp per UK business day</dd>
        </div>
      </dl>
    </details>
  )
}

function AlreadyStampedPanel({
  exp,
  vm,
}: {
  exp: Extract<CustomerExperience, { kind: "card_stamped_today" }>
  vm: CustomerExperienceViewModel
}) {
  return (
    <section className="grid gap-5">
      <CustomerReceipt venueName={exp.merchantName} eyebrow="Today's visit">
        <StatusBanner title="You're already stamped today." tone="success">
          Come back tomorrow to keep building your card. Stamps are limited to
          one per UK business day.
        </StatusBanner>
        <CustomerActionNote title="One stamp a day" tone="leaf">
          Your progress is saved. The next stamp opens on the next UK business
          day.
        </CustomerActionNote>
      </CustomerReceipt>
      <PrimaryLink action={vm.primaryAction} />
    </section>
  )
}

function StampConfirmPanel({
  exp,
}: {
  exp: Extract<CustomerExperience, { kind: "stamp_confirm" }>
}) {
  return (
    <section className="grid gap-5">
      <CustomerReceipt venueName={exp.merchantName} eyebrow="Today's visit">
        <StatusBanner title="Ready to add today's stamp." tone="success">
          Tap once while you are at the venue. Stamps are limited to one per UK
          business day.
        </StatusBanner>
        <CustomerActionNote
          title="The printed QR ties this to the venue"
          tone="leaf"
        >
          Location can be checked when available, but the action still continues
          if your browser cannot share it.
        </CustomerActionNote>
        <SelfServiceStampForm
          membershipId={exp.membershipId}
          qrId={exp.qrId}
          requireGeofence={exp.location.requireGeofence}
          geofenceRadiusMeters={exp.location.geofenceRadiusMeters}
        />
      </CustomerReceipt>
      <Button asChild size="lg" variant="secondary" className="w-full">
        <Link href={`/card/${exp.membershipId}`}>Back to card</Link>
      </Button>
    </section>
  )
}

function RewardWaitingPanel({
  exp,
}: {
  exp: Extract<CustomerExperience, { kind: "reward_waiting" }>
}) {
  return (
    <CustomerReceipt
      venueName={exp.merchantName}
      eyebrow="Mystery reward"
      footerLeft={cardNumber(exp.reward.membershipId)}
    >
      <PintReward caption="Pouring soon" pour />
      <RewardTeaser
        locked={false}
        title={exp.reward.rewardName}
        description={rewardTermsNode(exp.reward)}
      />
      <CustomerActionNote title="Counter check" tone="sun">
        Rewards become redeemable from the next UK business day after the final
        stamp.
      </CustomerActionNote>
      <StatusBanner title="Give it a day to breathe" tone="warning">
        It&apos;s yours from opening time tomorrow.
      </StatusBanner>
      <Button asChild size="lg" variant="secondary" className="w-full">
        <Link href={`/card/${exp.reward.membershipId}`}>Return to card</Link>
      </Button>
    </CustomerReceipt>
  )
}

function RewardReadyPanel({
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
      <PintReward caption="Ready to pour" pour />
      <RewardTeaser
        locked={false}
        title={exp.reward.rewardName}
        description={rewardTermsNode(exp.reward)}
      />
      <CustomerActionNote title="Counter check" tone="leaf">
        Rewards become redeemable from the next UK business day after the final
        stamp.
      </CustomerActionNote>
      <StatusBanner title="Ready to redeem." tone="success">
        Tap redeem while you are at the venue, then show the redeemed card if
        asked.
      </StatusBanner>
      <SelfServiceRedeemForm
        rewardId={exp.reward.rewardId}
        requireGeofence={exp.location.requireGeofence}
        geofenceRadiusMeters={exp.location.geofenceRadiusMeters}
      />
    </CustomerReceipt>
  )
}

function RedeemedProofPanel({
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
        <PintReward caption="Cheers — redeemed" />
        <RewardTeaser
          locked={false}
          title={exp.reward.rewardName}
          description={rewardTermsNode(exp.reward)}
        />
        <StatusBanner title="Reward redeemed." tone="success">
          Show this screen at the counter. A new stamp cycle has started.
        </StatusBanner>
      </CustomerReceipt>
      <PrimaryLink action={vm.primaryAction} />
    </section>
  )
}

function UnavailablePanel({
  exp,
  vm,
}: {
  exp: Extract<CustomerExperience, { kind: "unavailable" }>
  vm: CustomerExperienceViewModel
}) {
  return (
    <section className="grid gap-5">
      <CustomerReceipt venueName="Nabaperks" eyebrow="Nabaperks loyalty">
        <StatusBanner title="Card unavailable" tone="neutral">
          {exp.reason}
        </StatusBanner>
        <CustomerActionNote title="Need a hand?" tone="plain">
          Ask a team member for the current loyalty QR, or open your cards to
          find them.
        </CustomerActionNote>
      </CustomerReceipt>
      <PrimaryLink action={vm.primaryAction} variant="secondary" />
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

function StatusNotice({
  title = "Stamps unavailable",
  message,
}: {
  title?: string
  message: string
}) {
  return (
    <StatusBanner title={title} tone="warning">
      {message}
    </StatusBanner>
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

function screenLabelFor(kind: CustomerExperienceKind): string {
  switch (kind) {
    case "stamp_confirm":
    case "card_stamped_today":
      return "Customer stamp"
    case "reward_waiting":
    case "reward_ready":
    case "redeemed_proof":
      return "Customer reward"
    case "card_collecting":
      return "Customer card"
    default:
      return "Customer flow"
  }
}
