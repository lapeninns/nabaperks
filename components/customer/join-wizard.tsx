import type { ReactNode } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"

import { JoinOfferReminder } from "@/components/customer/join-offer-reminder"
import type { PendingJoinOffer } from "@/lib/customer/pending-join-offer"
import { VenueMark } from "@/components/brand"
import {
  CustomerFlowShell,
  CustomerStampCard,
  type FlowProgress,
} from "@/components/customer/customer-flow-system"
import type { CustomerEmailFormProps } from "@/components/customer/join-email-forms"
import type { CustomerEmailConfirmedProps } from "@/components/customer/join-email-confirmed"
import type { CustomerEmailOtpFormProps } from "@/components/customer/join-email-otp-form"
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
  JOIN_EMAIL_BACK_TO_PHONE_CODE_LABEL,
  JOIN_USE_MOBILE_NUMBER_LABEL,
  joinUnlockingRewardHook,
  type CustomerExperienceViewModel,
  JOIN_EMAIL_NEW_CARD_DISCLOSURE,
} from "@/lib/customer/experience/copy"
import type {
  CustomerExperience,
  JoinCard,
  JoinMerchant,
} from "@/lib/customer/experience/types"
import { buildCustomerJoinHref } from "@/lib/navigation/customer-join-intent"

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
const CustomerEmailForm = dynamic<CustomerEmailFormProps>(() =>
  import("@/components/customer/join-email-forms").then(
    (module) => module.CustomerEmailForm
  )
)
const CustomerEmailConfirmed = dynamic<CustomerEmailConfirmedProps>(() =>
  import("@/components/customer/join-email-confirmed").then(
    (module) => module.CustomerEmailConfirmed
  )
)
const CustomerEmailOtpForm = dynamic<CustomerEmailOtpFormProps>(() =>
  import("@/components/customer/join-email-otp-form").then(
    (module) => module.CustomerEmailOtpForm
  )
)

type PhoneExperience = Extract<CustomerExperience, { kind: "join_phone" }>
type EmailExperience = Extract<CustomerExperience, { kind: "join_email" }>

/**
 * Step wizard for the join flow — one job per screen (welcome → phone → code
 * → terms, with email as the phone code's fallback), plus the confirmed-email
 * (no card for this email), returning-member and unavailable states. The route page derives a join {@link CustomerExperience}; this maps
 * it to chrome + the step. Backend order: verify phone or email → terms →
 * membership + first stamp (via QR join).
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
        <WelcomeStep
          exp={experience}
          vm={vm}
          referralCode={referralCode}
          pendingOffer={pendingOffer}
        />
      )
    case "join_phone":
    case "join_email":
      return (
        <ContactStep
          exp={experience}
          referralCode={referralCode}
          pendingOffer={pendingOffer}
        />
      )
    case "join_email_choice":
      return (
        <EmailChoiceStep
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

/**
 * The contact step: the phone form, always. Email is never a first option; it
 * is the phone code step's fallback once the code has had time to arrive, and
 * that fallback opens the email form here (`step=email`). Phone stays one link
 * away: back to the pending code if there is one, since a late code is the
 * usual reason for coming back, else the number form.
 */
function ContactStep({
  exp,
  referralCode,
  pendingOffer,
}: {
  exp: PhoneExperience | EmailExperience
  referralCode?: string
  pendingOffer?: PendingJoinOffer | null
}) {
  const vm = getCustomerExperienceViewModel(exp)
  if (exp.kind === "join_phone") {
    return (
      <PhoneStep
        exp={exp}
        vm={vm}
        referralCode={referralCode}
        pendingOffer={pendingOffer}
      />
    )
  }
  return (
    <EmailStep
      exp={exp}
      vm={vm}
      referralCode={referralCode}
      pendingOffer={pendingOffer}
      alternate={
        <Button asChild variant="outline" size="lg" className="w-full">
          <Link
            href={buildCustomerJoinHref(exp.merchant.slug, {
              qrId: exp.qrId,
              referralCode,
              step: exp.phoneCodePending ? undefined : "phone",
            })}
          >
            {exp.phoneCodePending
              ? JOIN_EMAIL_BACK_TO_PHONE_CODE_LABEL
              : JOIN_USE_MOBILE_NUMBER_LABEL}
          </Link>
        </Button>
      }
    />
  )
}

function PhoneStep({
  exp,
  vm,
  referralCode,
  pendingOffer,
}: {
  exp: PhoneExperience
  vm: CustomerExperienceViewModel
  referralCode?: string
  pendingOffer?: PendingJoinOffer | null
}) {
  return (
    <JoinShell
      vm={vm}
      pendingOffer={pendingOffer}
      venueName={exp.merchant.name}
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
        notice={exp.notice}
        prefillPhone={exp.prefillPhone}
        emailStepHref={
          exp.emailSignIn
            ? buildCustomerJoinHref(exp.merchant.slug, {
                qrId: exp.qrId,
                referralCode,
                step: "email",
              })
            : undefined
        }
      />
    </JoinShell>
  )
}

function EmailStep({
  exp,
  vm,
  referralCode,
  pendingOffer,
  alternate,
}: {
  exp: EmailExperience
  vm: CustomerExperienceViewModel
  referralCode?: string
  pendingOffer?: PendingJoinOffer | null
  alternate: ReactNode
}) {
  return (
    <JoinShell
      vm={vm}
      pendingOffer={pendingOffer}
      venueName={exp.merchant.name}
      progress={joinProgress("join_email", Boolean(exp.qrId))}
      dense
    >
      {/* The fallback's one job is the email. A pending offer shows only
          the shell's reminder chip, as on the other steps; the server says
          honestly at join if the offer cannot be added. */}
      {pendingOffer ? null : (
        <UnlockingReminder merchant={exp.merchant} card={exp.card} />
      )}
      <CustomerEmailForm
        merchantSlug={exp.merchant.slug}
        qrId={exp.qrId}
        referralCode={referralCode}
        alternate={alternate}
        creationDisclosure={
          exp.emailMode === "full" ? JOIN_EMAIL_NEW_CARD_DISCLOSURE : undefined
        }
      />
    </JoinShell>
  )
}

function EmailChoiceStep({
  exp,
  vm,
  referralCode,
  pendingOffer,
}: {
  exp: Extract<CustomerExperience, { kind: "join_email_choice" }>
  vm: CustomerExperienceViewModel
  referralCode?: string
  pendingOffer?: PendingJoinOffer | null
}) {
  return (
    <JoinShell
      vm={vm}
      pendingOffer={pendingOffer}
      venueName={exp.merchant.name}
      progress={joinProgress("join_email_choice", Boolean(exp.qrId))}
      dense
    >
      <CustomerEmailConfirmed
        merchantSlug={exp.merchant.slug}
        qrId={exp.qrId}
        referralCode={referralCode}
        canCreate={exp.canCreate}
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
      progress={joinProgress("join_otp", Boolean(exp.qrId))}
      dense
    >
      {exp.contact.method === "email" ? (
        <CustomerEmailOtpForm
          merchantSlug={exp.merchant.slug}
          qrId={exp.qrId}
          referralCode={referralCode}
          resendAvailableAt={exp.contact.resendAvailableAt}
          deliveryDelayed={exp.contact.deliveryDelayed}
          emailStepHref={buildCustomerJoinHref(exp.merchant.slug, {
            qrId: exp.qrId,
            referralCode,
            step: "email",
          })}
          // Back to a phone code still pending, else the number form.
          phoneStepHref={buildCustomerJoinHref(exp.merchant.slug, {
            qrId: exp.qrId,
            referralCode,
            step: exp.contact.phoneCodePending ? undefined : "phone",
          })}
          phoneCodePending={exp.contact.phoneCodePending}
        />
      ) : (
        <CustomerOtpForm
          merchantSlug={exp.merchant.slug}
          qrId={exp.qrId}
          channel={exp.contact.channel}
          referralCode={referralCode}
          emailFallbackInSeconds={exp.contact.emailFallbackInSeconds}
          phoneCodeSentAt={exp.contact.phoneCodeSentAt}
          emailStepHref={buildCustomerJoinHref(exp.merchant.slug, {
            qrId: exp.qrId,
            referralCode,
            step: "email",
          })}
        />
      )}
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
        contactChannels={exp.contactChannels}
        rewardMayNeedPhotoId={exp.rewardMayNeedPhotoId}
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

/** Contact steps: the reward hook beside the number or email field. */
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
 * Terms step, QR journey: the card with its first slot still empty. The full
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
      eyebrow="Stamp 1 of your card"
      hook={joinUnlockingRewardHook(card.stampsRequired)}
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
}: {
  pendingOffer?: PendingJoinOffer | null
  venueName?: string
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
      {pendingOffer && venueName ? (
        <JoinOfferReminder offer={pendingOffer} venueName={venueName} />
      ) : null}
      {children}
    </CustomerFlowShell>
  )
}

/**
 * Progress for each onboarding screen. "Step x of y" shows only when it is
 * true for this guest: a returning guest, or an email guest whose email
 * already has a card here, goes from the code straight to their stamp and
 * never reaches a third step. So the welcome, number, email and code screens
 * carry only their label, and the count appears from the terms step, the
 * last one for everyone who reaches it. Labels are the guest's words for the
 * step, never "verify".
 */
function joinProgress(
  kind:
    | "join_welcome"
    | "join_phone"
    | "join_email"
    | "join_email_choice"
    | "join_otp"
    | "join_terms",
  hasQr = true
): FlowProgress {
  const label = {
    join_welcome: "Your card",
    join_phone: "Your number",
    join_email: "Your email",
    join_email_choice: "Your email",
    join_otp: "Your code",
    join_terms: hasQr ? "First stamp" : "Your card",
  }[kind]

  return kind === "join_terms"
    ? { step: ONBOARDING_STEPS, total: ONBOARDING_STEPS, label }
    : { label }
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
