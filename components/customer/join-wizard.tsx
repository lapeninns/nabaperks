import type { ReactNode } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"

import { OfferFlowShell } from "@/components/customer/offer-flow-shell"
import { JoinOfferReminder } from "@/components/customer/join-offer-reminder"
import type { PendingJoinOffer } from "@/lib/customer/pending-join-offer"
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
import { RewardSeal, StatusBanner } from "@/components/loyalty"
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
  pendingOffer,
}: {
  experience: CustomerExperience
  referralCode?: string
  pendingOffer?: PendingJoinOffer | null
}) {
  const vm = getCustomerExperienceViewModel(experience)

  switch (experience.kind) {
    case "join_welcome":
      return (
        <WelcomeStep exp={experience} vm={vm} referralCode={referralCode} />
      )
    case "join_phone":
      return (
        <PhoneStep
          exp={experience}
          vm={vm}
          referralCode={referralCode}
          pendingOffer={pendingOffer}
        />
      )
    case "join_otp":
      return (
        <OtpStep
          exp={experience}
          vm={vm}
          referralCode={referralCode}
          pendingOffer={pendingOffer}
        />
      )
    case "join_terms":
      return (
        <TermsStep
          exp={experience}
          vm={vm}
          referralCode={referralCode}
          pendingOffer={pendingOffer}
        />
      )
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
  pendingOffer,
}: {
  exp: Extract<CustomerExperience, { kind: "join_phone" }>
  vm: CustomerExperienceViewModel
  referralCode?: string
  pendingOffer?: PendingJoinOffer | null
}) {
  return (
    <JoinShell
      vm={vm}
      pendingOffer={pendingOffer}
      venueName={exp.merchant.name}
      venueSlug={exp.merchant.slug}
      progress={joinProgress("join_phone", Boolean(exp.qrId))}
      dense
    >
      {pendingOffer ? null : (
        <UnlockingReminder merchant={exp.merchant} card={exp.card} />
      )}
      <CustomerIdentityForm
        merchantSlug={exp.merchant.slug}
        qrId={exp.qrId}
        channel={exp.channel}
        referralCode={referralCode}
      />
    </JoinShell>
  )
}

function OtpStep({
  exp,
  vm,
  referralCode,
  pendingOffer,
}: {
  exp: Extract<CustomerExperience, { kind: "join_otp" }>
  vm: CustomerExperienceViewModel
  referralCode?: string
  pendingOffer?: PendingJoinOffer | null
}) {
  return (
    <JoinShell
      vm={vm}
      pendingOffer={pendingOffer}
      venueName={exp.merchant.name}
      venueSlug={exp.merchant.slug}
      progress={joinProgress("join_otp", Boolean(exp.qrId))}
      dense
    >
      <CustomerOtpForm
        merchantSlug={exp.merchant.slug}
        qrId={exp.qrId}
        contactLast4={exp.contactLast4}
        channel={exp.channel}
        referralCode={referralCode}
      />
    </JoinShell>
  )
}

function TermsStep({
  exp,
  vm,
  referralCode,
  pendingOffer,
}: {
  exp: Extract<CustomerExperience, { kind: "join_terms" }>
  vm: CustomerExperienceViewModel
  referralCode?: string
  pendingOffer?: PendingJoinOffer | null
}) {
  return (
    <JoinShell
      vm={vm}
      pendingOffer={pendingOffer}
      venueName={exp.merchant.name}
      venueSlug={exp.merchant.slug}
      progress={joinProgress("join_terms", Boolean(exp.qrId))}
      dense
    >
      {pendingOffer ? null : exp.qrId ? (
        <TermsFirstStampPreview merchant={exp.merchant} card={exp.card} />
      ) : (
        <TermsSavedCardPreview merchant={exp.merchant} card={exp.card} />
      )}
      <CustomerJoinForm
        merchantSlug={exp.merchant.slug}
        qrId={exp.qrId}
        merchantName={exp.merchant.name}
        card={exp.card}
        referralCode={referralCode}
      />
    </JoinShell>
  )
}

/**
 * The offer in one line beside a form: venue mark, venue · card, one hook and
 * the sealed reward. Every form step carries the same 80px strip so the
 * customer never loses sight of what they are unlocking, and never scrolls
 * past a second stamp card to reach the field or the button.
 */
function JoinOfferStrip({
  merchant,
  card,
  eyebrow,
  hook,
}: {
  merchant: JoinMerchant
  card: JoinCard
  eyebrow: string
  hook: string
}) {
  return (
    <div className="surface-card flex items-center gap-3 p-3 text-left">
      <VenueMark size={40} name={merchant.name} className="shrink-0" />
      <div className="grid min-w-0 flex-1 gap-0.5">
        <span className="eyebrow text-muted-foreground">{eyebrow}</span>
        {/* Two lines before clipping — long venue · card compounds stay
            readable at 375 (VCU-P3-09). */}
        <span className="line-clamp-2 text-sm leading-tight font-extrabold break-words">
          {merchant.name} · {card.name}
        </span>
        <p className="text-xs leading-snug text-muted-foreground">{hook}</p>
      </div>
      <RewardSeal state="sealed" size="sm" wiggle className="shrink-0" />
    </div>
  )
}

/** Phone step: the reward hook beside the number field. */
function UnlockingReminder({
  merchant,
  card,
}: {
  merchant: JoinMerchant
  card: JoinCard
}) {
  return (
    <JoinOfferStrip
      merchant={merchant}
      card={card}
      eyebrow="You're unlocking"
      hook={joinUnlockingRewardHook(card.stampsRequired)}
    />
  )
}

/**
 * Terms step, QR journey: the outcome of accepting in one line. The full
 * stamp card with stamp one printed is what the card page shows next, so the
 * pitch here stays a strip and the consent form stays above the fold.
 */
function TermsFirstStampPreview({
  merchant,
  card,
}: {
  merchant: JoinMerchant
  card: JoinCard
}) {
  return (
    <JoinOfferStrip
      merchant={merchant}
      card={card}
      eyebrow="Your first stamp"
      hook="Lands on your card the moment you accept."
    />
  )
}

/** Terms step, direct join: the card is saved; stamp one waits at the venue. */
function TermsSavedCardPreview({
  merchant,
  card,
}: {
  merchant: JoinMerchant
  card: JoinCard
}) {
  return (
    <JoinOfferStrip
      merchant={merchant}
      card={card}
      eyebrow="Your saved card"
      hook="Scan the venue QR on your next visit for stamp 1."
    />
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
        description: <>Your reward stays a surprise until the final stamp.</>,
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
  pendingOffer,
  venueName,
  venueSlug,
}: {
  pendingOffer?: PendingJoinOffer | null
  venueName?: string
  venueSlug?: string
  vm: CustomerExperienceViewModel
  progress?: FlowProgress
  centered?: boolean
  dense?: boolean
  children: ReactNode
}) {
  if (pendingOffer && venueName && venueSlug) {
    return (
      <OfferFlowShell backHref={`/m/${venueSlug}`} label={venueName}>
        {progress ? (
          <div
            className="grid grid-cols-3 gap-2"
            aria-label={`Step ${progress.step} of 3`}
          >
            {["Your number", "Your code", "Your card"].map((label, index) => (
              <span
                key={label}
                aria-current={index + 1 === progress.step ? "step" : undefined}
                className={`mono-id border-t-4 pt-2 tracking-normal ${index + 1 === progress.step ? "border-cobalt text-cobalt" : "border-line-strong text-muted-foreground"}`}
              >
                {index + 1} {label}
              </span>
            ))}
          </div>
        ) : null}
        <div className="grid gap-2">
          <p className="eyebrow text-cobalt">
            {progress?.step === 1
              ? "One text, no password"
              : progress?.step === 2
                ? "Check your messages"
                : "Last step"}
          </p>
          <h1 className="text-3xl leading-tight font-extrabold tracking-tight">
            {progress?.step === 1
              ? "Save your card to your number"
              : vm.headline}
          </h1>
        </div>
        <JoinOfferReminder offer={pendingOffer} venueName={venueName} />
        {children}
      </OfferFlowShell>
    )
  }
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

  const label = {
    join_welcome: "Keep your card",
    join_phone: "Verify number · Phone",
    join_otp: "Verify number · Code",
    join_terms: hasQr ? "Collect your stamp" : "Keep your card",
  }[kind]

  return { step, total: ONBOARDING_STEPS, label }
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
