import type { ReactNode } from "react"
import Link from "next/link"

import { VenueMark } from "@/components/brand"
import {
  CustomerActionNote,
  CustomerFlowShell,
  CustomerReceipt,
  CustomerStampCard,
  type FlowProgress,
} from "@/components/customer/customer-flow-system"
import {
  CustomerIdentityForm,
  CustomerJoinForm,
  CustomerOtpForm,
} from "@/components/customer/join-forms"
import { CustomerVenueTermsSheet } from "@/components/customer/legal-sheet"
import {
  RewardTicket,
  StampGrid,
  StampJourneyPreview,
  StatusBanner,
} from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import {
  getCustomerExperienceViewModel,
  JOIN_WELCOME_HOW_IT_WORKS,
  joinUnlockingRewardHook,
  type CustomerExperienceViewModel,
} from "@/lib/customer/experience/copy"
import type {
  CustomerExperience,
  JoinCard,
  JoinMerchant,
} from "@/lib/customer/experience/types"

/**
 * Step wizard for the join flow — one job per screen (welcome → phone → code →
 * terms), plus the returning-member and unavailable states. The route page
 * derives a join {@link CustomerExperience}; this maps it to chrome + the step.
 * Backend order: verify phone → terms → membership + first stamp (via QR join).
 */
export function JoinWizard({
  experience,
}: {
  experience: CustomerExperience
}) {
  const vm = getCustomerExperienceViewModel(experience)

  switch (experience.kind) {
    case "join_welcome":
      return <WelcomeStep exp={experience} vm={vm} />
    case "join_phone":
      return <PhoneStep exp={experience} vm={vm} />
    case "join_otp":
      return <OtpStep exp={experience} vm={vm} />
    case "join_terms":
      return <TermsStep exp={experience} vm={vm} />
    case "join_returning":
      return <ReturningStep exp={experience} vm={vm} />
    default:
      return <UnavailableJoin />
  }
}

const ONBOARDING_STEPS = 3

function WelcomeStep({
  exp,
  vm,
}: {
  exp: Extract<CustomerExperience, { kind: "join_welcome" }>
  vm: CustomerExperienceViewModel
}) {
  return (
    <JoinShell vm={vm} progress={joinProgress("join_welcome")} dense centered>
      <JoinWelcomeCard merchant={exp.merchant} card={exp.card} />
      <HowItWorksList />
      <CustomerVenueTermsSheet
        venueTerms={{
          merchantName: exp.merchant.name,
          stampsRequired: exp.card.stampsRequired,
          rewardTerms: exp.card.rewardTerms,
        }}
        triggerLabel="View full venue terms"
        triggerClassName="inline-flex w-fit text-xs font-bold underline underline-offset-4"
      />
      {vm.primaryAction ? (
        <Button asChild size="lg" className="w-full">
          <Link href={vm.primaryAction.href}>{vm.primaryAction.label}</Link>
        </Button>
      ) : null}
    </JoinShell>
  )
}

/**
 * Compact identity card for the QR-scan landing. The stamp row animates through
 * an example journey (empty → slam 1, 2, 3 → gift reveal), then the mystery
 * reward copy sits beneath — live progress replaces this after join.
 */
function JoinWelcomeCard({
  merchant,
  card,
}: {
  merchant: JoinMerchant
  card: JoinCard
}) {
  return (
    <CustomerReceipt
      venueName={merchant.name}
      title={card.name}
      eyebrow={merchant.name}
      hideFooter
    >
      <StampJourneyPreview total={card.stampsRequired} className="py-1" />
      <RewardTicket
        state="sealed"
        name="Mystery reward, sealed"
        description={
          <>
            Collect {card.stampsRequired} stamps to unlock a surprise reward,
            yours from the next UK business day.
            {card.minSpendPence !== null ? (
              <> Minimum spend {formatPence(card.minSpendPence)}.</>
            ) : null}
          </>
        }
      />
    </CustomerReceipt>
  )
}

/**
 * "How it works" rendered flat — a borderless, numbered list that groups the
 * three steps by typography rather than another nested dashed container, so the
 * welcome card carries one fewer border level.
 */
function HowItWorksList() {
  return (
    <section className="grid gap-2 text-left">
      <p className="eyebrow text-muted-foreground">How it works</p>
      <ol className="grid gap-2">
        {JOIN_WELCOME_HOW_IT_WORKS.map((step, index) => (
          <li key={index} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 grid size-5 shrink-0 -rotate-6 place-items-center rounded-full border-2 border-ink bg-primary text-[0.7rem] leading-none font-extrabold text-primary-foreground"
            >
              {index + 1}
            </span>
            <span className="text-sm leading-snug font-medium">{step}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function PhoneStep({
  exp,
  vm,
}: {
  exp: Extract<CustomerExperience, { kind: "join_phone" }>
  vm: CustomerExperienceViewModel
}) {
  return (
    <JoinShell vm={vm} progress={joinProgress("join_phone")} dense>
      <UnlockingReminder merchant={exp.merchant} card={exp.card} />
      <CustomerIdentityForm merchantSlug={exp.merchant.slug} qrId={exp.qrId} />
    </JoinShell>
  )
}

function OtpStep({
  exp,
  vm,
}: {
  exp: Extract<CustomerExperience, { kind: "join_otp" }>
  vm: CustomerExperienceViewModel
}) {
  return (
    <JoinShell vm={vm} progress={joinProgress("join_otp")} dense>
      <UnlockingReminder merchant={exp.merchant} card={exp.card} />
      <CustomerOtpForm merchantSlug={exp.merchant.slug} qrId={exp.qrId} />
    </JoinShell>
  )
}

function TermsStep({
  exp,
  vm,
}: {
  exp: Extract<CustomerExperience, { kind: "join_terms" }>
  vm: CustomerExperienceViewModel
}) {
  return (
    <JoinShell vm={vm} progress={joinProgress("join_terms")} dense>
      <UnlockingReminder merchant={exp.merchant} card={exp.card} />
      <CustomerJoinForm
        merchantSlug={exp.merchant.slug}
        qrId={exp.qrId}
        merchantName={exp.merchant.name}
        card={exp.card}
        requireGeofence={exp.location.requireGeofence}
        geofenceRadiusMeters={exp.location.geofenceRadiusMeters}
      />
    </JoinShell>
  )
}

/**
 * Compact "you're unlocking" strip that keeps the reward in view through the
 * phone → code → terms steps, so the value exchange stays clear once the stamp
 * card itself scrolls away. It restores *why* — the reward hook plus a static,
 * un-animated mini stamp row (no progress yet) — without the full welcome card,
 * so the primary CTA still sits inside the keyboard-shrunk viewport. Shared by
 * production and the dev preview so step 2 stays one source of truth.
 */
export function UnlockingReminder({
  merchant,
  card,
}: {
  merchant: JoinMerchant
  card: JoinCard
}) {
  return (
    <div className="surface-card grid gap-3 p-3 text-left">
      <div className="flex items-center gap-3">
        <VenueMark size={40} name={merchant.name} />
        <div className="grid min-w-0 gap-0.5">
          <span className="eyebrow text-muted-foreground">
            You&apos;re unlocking
          </span>
          <span className="truncate text-sm leading-tight font-extrabold">
            {merchant.name} · {card.name}
          </span>
        </div>
      </div>
      <p className="text-xs leading-snug text-muted-foreground">
        {joinUnlockingRewardHook(card.stampsRequired)}
      </p>
      <StampGrid
        current={0}
        total={card.stampsRequired}
        showEmptySlotNumbers
        rewardSlot="locked"
        compact
      />
    </div>
  )
}

function ReturningStep({
  exp,
  vm,
}: {
  exp: Extract<CustomerExperience, { kind: "join_returning" }>
  vm: CustomerExperienceViewModel
}) {
  return (
    <JoinShell vm={vm} centered>
      <JoinHeroCard
        merchant={exp.merchant}
        card={exp.card}
        current={exp.current}
      />
      <div className="grid gap-4">
        <StatusBanner title="You're already joined" tone="success">
          Your stamp card is ready. Continue from your current progress.
        </StatusBanner>
        <CustomerActionNote title="Current progress" tone="leaf">
          {exp.current} of {exp.total} stamps collected.
        </CustomerActionNote>
        {vm.primaryAction ? (
          <Button asChild size="lg" className="w-full">
            <Link href={vm.primaryAction.href}>{vm.primaryAction.label}</Link>
          </Button>
        ) : null}
      </div>
    </JoinShell>
  )
}

function JoinHeroCard({
  merchant,
  card,
  current,
  children,
}: {
  merchant: JoinMerchant
  card: JoinCard
  current: number
  children?: ReactNode
}) {
  return (
    <CustomerStampCard
      venueName={merchant.name}
      cardName={card.name}
      current={current}
      total={card.stampsRequired}
      hideFooter
      reward={{
        state: "sealed",
        name: "Mystery reward, sealed",
        description: (
          <>
            Your assigned reward stays hidden until the final stamp and can be
            redeemed from the next UK business day.
            {card.minSpendPence !== null ? (
              <> Minimum spend {formatPence(card.minSpendPence)}.</>
            ) : null}
          </>
        ),
      }}
    >
      {children}
    </CustomerStampCard>
  )
}

function JoinShell({
  vm,
  progress,
  centered = false,
  dense = false,
  children,
}: {
  vm: CustomerExperienceViewModel
  progress?: FlowProgress
  centered?: boolean
  dense?: boolean
  children: ReactNode
}) {
  return (
    <CustomerFlowShell
      eyebrow={vm.eyebrow}
      title={vm.headline}
      description={vm.supportLine}
      progress={progress}
      dense={dense}
      className={centered ? "content-center" : undefined}
      screenLabel="Customer join"
    >
      {children}
    </CustomerFlowShell>
  )
}

/**
 * Step position for each onboarding screen on a 3-step scale that matches the
 * "three quick steps" promise: 1 Invite (welcome) → 2 Verification (phone and
 * code share this step) → 3 Consent (terms + first stamp).
 */
function joinProgress(
  kind: "join_welcome" | "join_phone" | "join_otp" | "join_terms"
): FlowProgress {
  const step = {
    join_welcome: 1,
    join_phone: 2,
    join_otp: 2,
    join_terms: 3,
  }[kind]

  return { step, total: ONBOARDING_STEPS, label: "Join the card" }
}

function UnavailableJoin() {
  return (
    <CustomerFlowShell
      screenLabel="Unavailable loyalty"
      className="content-center"
    >
      <StatusBanner
        title="This loyalty card is unavailable"
        tone="neutral"
        className="text-center"
      >
        Ask a team member for the current loyalty QR.
      </StatusBanner>
    </CustomerFlowShell>
  )
}

function formatPence(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100)
}
