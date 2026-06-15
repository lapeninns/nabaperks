import type { ReactNode } from "react"
import Link from "next/link"

import { VenueMark } from "@/components/brand"
import {
  CustomerActionNote,
  CustomerFlowShell,
  CustomerStampCard,
  type FlowProgress,
} from "@/components/customer/customer-flow-system"
import {
  CustomerIdentityForm,
  CustomerJoinForm,
} from "@/components/customer/join-forms"
import { CustomerOtpForm } from "@/components/customer/join-otp-form"
import { WelcomeStep } from "@/components/customer/join-welcome-step"
import { StampJourneyPreview, StatusBanner } from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import {
  getCustomerExperienceViewModel,
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
export function JoinWizard({ experience }: { experience: CustomerExperience }) {
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
      <CustomerOtpForm
        merchantSlug={exp.merchant.slug}
        qrId={exp.qrId}
        contact={exp.contact}
        location={exp.location}
      />
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
 * card itself scrolls away. It restores *why* — the reward hook plus the same
 * looping stamp journey preview as the welcome card — without the full welcome
 * card, so the primary CTA still sits inside the keyboard-shrunk viewport.
 * Shared by production and the dev preview so step 2 stays one source of truth.
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
      <StampJourneyPreview
        total={card.stampsRequired}
        venueName={merchant.name}
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
