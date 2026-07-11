import type { ReactNode } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"

import { VenueMark } from "@/components/brand"
import {
  CustomerFlowShell,
  CustomerStampCard,
  type FlowProgress,
} from "@/components/customer/customer-flow-system"
import type {
  CustomerIdentityFormProps,
  CustomerJoinFormProps,
} from "@/components/customer/join-forms"
import type { CustomerOtpFormProps } from "@/components/customer/join-otp-form"
import { WelcomeStep } from "@/components/customer/join-welcome-step"
import { UnavailableRecoveryActions } from "@/components/customer/unavailable-recovery"
import {
  RewardSeal,
  RewardTicket,
  StampGrid,
  StatusBanner,
} from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import {
  ASK_TEAM_FOR_QR,
  CARD_UNAVAILABLE_TITLE,
  MYSTERY_REWARD_SEALED_LABEL,
} from "@/lib/copy/product-copy"
import {
  getCustomerExperienceViewModel,
  joinUnlockingRewardHook,
  type CustomerExperienceViewModel,
} from "@/lib/customer/experience/copy"
import { stampDisplayDates } from "@/lib/customer/uk-calendar"
import type {
  CustomerExperience,
  JoinCard,
  JoinMerchant,
} from "@/lib/customer/experience/types"

const CustomerIdentityForm = dynamic<CustomerIdentityFormProps>(() =>
  import("@/components/customer/join-forms").then(
    (module) => module.CustomerIdentityForm
  )
)
const CustomerJoinForm = dynamic<CustomerJoinFormProps>(() =>
  import("@/components/customer/join-forms").then(
    (module) => module.CustomerJoinForm
  )
)
const CustomerOtpForm = dynamic<CustomerOtpFormProps>(() =>
  import("@/components/customer/join-otp-form").then(
    (module) => module.CustomerOtpForm
  )
)

/**
 * Step wizard for the join flow — one job per screen (welcome → phone → code →
 * terms), plus the returning-member and unavailable states. The route page
 * derives a join {@link CustomerExperience}; this maps it to chrome + the step.
 * Backend order: verify phone → terms → membership + first stamp (via QR join).
 */
export function JoinWizard({
  experience,
  referralCode,
}: {
  experience: CustomerExperience
  referralCode?: string
}) {
  const vm = getCustomerExperienceViewModel(experience)

  switch (experience.kind) {
    case "join_welcome":
      return (
        <WelcomeStep exp={experience} vm={vm} referralCode={referralCode} />
      )
    case "join_phone":
      return <PhoneStep exp={experience} vm={vm} referralCode={referralCode} />
    case "join_otp":
      return <OtpStep exp={experience} vm={vm} referralCode={referralCode} />
    case "join_terms":
      return <TermsStep exp={experience} vm={vm} referralCode={referralCode} />
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
  referralCode,
}: {
  exp: Extract<CustomerExperience, { kind: "join_phone" }>
  vm: CustomerExperienceViewModel
  referralCode?: string
}) {
  return (
    <JoinShell
      vm={vm}
      progress={joinProgress("join_phone", Boolean(exp.qrId))}
      dense
    >
      <UnlockingReminder merchant={exp.merchant} card={exp.card} />
      <CustomerIdentityForm
        merchantSlug={exp.merchant.slug}
        qrId={exp.qrId}
        referralCode={referralCode}
      />
    </JoinShell>
  )
}

function OtpStep({
  exp,
  vm,
  referralCode,
}: {
  exp: Extract<CustomerExperience, { kind: "join_otp" }>
  vm: CustomerExperienceViewModel
  referralCode?: string
}) {
  return (
    <JoinShell
      vm={vm}
      progress={joinProgress("join_otp", Boolean(exp.qrId))}
      dense
    >
      <CustomerOtpForm
        merchantSlug={exp.merchant.slug}
        qrId={exp.qrId}
        contactLast4={exp.contactLast4}
        referralCode={referralCode}
      />
    </JoinShell>
  )
}

function TermsStep({
  exp,
  vm,
  referralCode,
}: {
  exp: Extract<CustomerExperience, { kind: "join_terms" }>
  vm: CustomerExperienceViewModel
  referralCode?: string
}) {
  return (
    <JoinShell
      vm={vm}
      progress={joinProgress("join_terms", Boolean(exp.qrId))}
      dense
    >
      {exp.qrId ? (
        <TermsFirstStampPreview merchant={exp.merchant} card={exp.card} />
      ) : (
        <TermsSavedCardPreview merchant={exp.merchant} card={exp.card} />
      )}
      <CustomerJoinForm
        merchantSlug={exp.merchant.slug}
        qrId={exp.qrId}
        merchantName={exp.merchant.name}
        card={exp.card}
        requireGeofence={exp.location.requireGeofence}
        referralCode={referralCode}
      />
    </JoinShell>
  )
}

/**
 * Step-specific motivation strip after the welcome card scrolls away. Phone keeps
 * a compact reward hook beside the number field; terms previews stamp one on the
 * card. The code step stays clean — one headline, one field, one CTA.
 */
export function UnlockingReminder({
  merchant,
  card,
}: {
  merchant: JoinMerchant
  card: JoinCard
}) {
  return <PhoneUnlockingReminder merchant={merchant} card={card} />
}

/** Compact reward hook — no journey animation (that lives on the welcome card). */
function PhoneUnlockingReminder({
  merchant,
  card,
}: {
  merchant: JoinMerchant
  card: JoinCard
}) {
  return (
    <div className="surface-card flex items-center gap-3 p-3 text-left">
      <VenueMark size={40} name={merchant.name} />
      <div className="grid min-w-0 flex-1 gap-0.5">
        <span className="eyebrow text-muted-foreground">
          You&apos;re unlocking
        </span>
        {/* Two lines before clipping — long venue · card compounds stay
            readable at 375 (VCU-P3-09). */}
        <span className="line-clamp-2 text-sm leading-tight font-extrabold break-words">
          {merchant.name} · {card.name}
        </span>
        <p className="text-xs leading-snug text-muted-foreground">
          {joinUnlockingRewardHook(card.stampsRequired)}
        </p>
      </div>
      <RewardSeal state="sealed" size="sm" wiggle className="shrink-0" />
    </div>
  )
}

/** Static preview of stamp one landing — the outcome of accepting terms. */
function TermsFirstStampPreview({
  merchant,
  card,
}: {
  merchant: JoinMerchant
  card: JoinCard
}) {
  const previewDates = stampDisplayDates(1)

  return (
    <div className="surface-card grid gap-3 p-3 text-left">
      <div className="flex items-center gap-3">
        <VenueMark size={40} name={merchant.name} />
        <div className="grid min-w-0 gap-0.5">
          <span className="eyebrow text-muted-foreground">
            Your first stamp
          </span>
          {/* Two lines before clipping (VCU-P3-09, shared with the phone
              chip). */}
          <span className="line-clamp-2 text-sm leading-tight font-extrabold break-words">
            {merchant.name} · {card.name}
          </span>
        </div>
      </div>
      <StampGrid
        current={1}
        total={card.stampsRequired}
        dates={previewDates}
        rewardSlot="locked"
        compact
        venueName={merchant.name}
      />
      <RewardTicket
        state="sealed"
        name={MYSTERY_REWARD_SEALED_LABEL}
        description={
          <>
            {joinUnlockingRewardHook(card.stampsRequired)}, yours from the next
            UK business day.
          </>
        }
      />
    </div>
  )
}

function TermsSavedCardPreview({
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
          <span className="eyebrow text-muted-foreground">Your saved card</span>
          <span className="line-clamp-2 text-sm leading-tight font-extrabold break-words">
            {merchant.name} · {card.name}
          </span>
        </div>
      </div>
      <StampGrid
        current={0}
        total={card.stampsRequired}
        dates={[]}
        rewardSlot="locked"
        compact
        venueName={merchant.name}
      />
      <RewardTicket
        state="sealed"
        name={MYSTERY_REWARD_SEALED_LABEL}
        description="Scan the printed venue QR when you're there to collect your first stamp."
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
        {/* One progress signal per screen (customer-flow-system rule): the
            hero card's grid + the support line already carry the count, so no
            extra "Current progress" note (CUS-P3-04). */}
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
        name: MYSTERY_REWARD_SEALED_LABEL,
        description: (
          <>
            Your assigned reward stays hidden until the final stamp and can be
            redeemed from the next UK business day.
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
  kind: "join_welcome" | "join_phone" | "join_otp" | "join_terms",
  hasQr = true
): FlowProgress {
  const step = {
    join_welcome: 1,
    join_phone: hasQr ? 2 : 1,
    join_otp: 2,
    join_terms: 3,
  }[kind]

  return { step, total: ONBOARDING_STEPS, label: "Keep your card" }
}

function UnavailableJoin() {
  return (
    <CustomerFlowShell
      screenLabel="Unavailable loyalty"
      className="content-center"
    >
      <StatusBanner
        title={CARD_UNAVAILABLE_TITLE}
        tone="neutral"
        className="text-center"
      >
        {ASK_TEAM_FOR_QR}
      </StatusBanner>
      {/* Same recovery block as /q (CUS-P2-04) — never a dead end. */}
      <UnavailableRecoveryActions />
    </CustomerFlowShell>
  )
}
