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
import { ContactMethodOrder } from "@/components/customer/contact-method-order"
import type {
  CustomerEmailChoiceFormProps,
  CustomerEmailFormProps,
} from "@/components/customer/join-email-forms"
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
  joinUnlockingRewardHook,
  type CustomerExperienceViewModel,
} from "@/lib/customer/experience/copy"
import type {
  CustomerExperience,
  JoinCard,
  JoinContactMethod,
  JoinMerchant,
} from "@/lib/customer/experience/types"
import {
  buildCustomerJoinHref,
  buildCustomerMerchantHref,
} from "@/lib/navigation/customer-join-intent"

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
const CustomerEmailChoiceForm = dynamic<CustomerEmailChoiceFormProps>(() =>
  import("@/components/customer/join-email-forms").then(
    (module) => module.CustomerEmailChoiceForm
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
 * Step wizard for the join flow — one job per screen (welcome → email or phone
 * → code → terms), plus the email choice, returning-member and unavailable
 * states. The route page derives a join {@link CustomerExperience}; this maps
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
        <WelcomeStep exp={experience} vm={vm} referralCode={referralCode} />
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
 * The contact step. While email sign-in is off it is the phone form alone, as
 * before. Otherwise both complete screens are built here and one leads (D12):
 * the method the address asked for, else phone while a phone-only offer is in
 * progress, else this device's last verified method, else the server default.
 * The other method is always one visible link away.
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
  if (exp.kind === "join_phone" && exp.emailMode === "off") {
    return (
      <PhoneStep
        exp={exp}
        vm={getCustomerExperienceViewModel(exp)}
        referralCode={referralCode}
        pendingOffer={pendingOffer}
      />
    )
  }

  const { phoneExp, emailExp } = contactExperiences(exp)
  const contactHref = (step: JoinContactMethod) =>
    buildCustomerJoinHref(exp.merchant.slug, {
      qrId: exp.qrId,
      referralCode,
      step,
    })
  const phone = (
    <PhoneStep
      exp={phoneExp}
      vm={getCustomerExperienceViewModel(phoneExp)}
      referralCode={referralCode}
      pendingOffer={pendingOffer}
      alternate={
        <AlternateContactLink href={contactHref("email")}>
          Use my email instead
        </AlternateContactLink>
      }
    />
  )
  const email = (
    <EmailStep
      exp={emailExp}
      vm={getCustomerExperienceViewModel(emailExp)}
      referralCode={referralCode}
      pendingOffer={pendingOffer}
      alternate={
        <AlternateContactLink href={contactHref("phone")}>
          Use my phone number instead
        </AlternateContactLink>
      }
    />
  )

  if (exp.methodRequested) return exp.kind === "join_email" ? email : phone
  // Public offer campaigns are claimed by a confirmed phone number only, so
  // an offer in progress leads with phone.
  if (pendingOffer) return phone
  return (
    <ContactMethodOrder
      defaultMethod={exp.defaultMethod}
      email={email}
      phone={phone}
    />
  )
}

/** Both contact screens for one contact step, the unrequested one unrequested. */
function contactExperiences(exp: PhoneExperience | EmailExperience): {
  phoneExp: PhoneExperience
  emailExp: EmailExperience
} {
  const shared = {
    merchant: exp.merchant,
    card: exp.card,
    qrId: exp.qrId,
    defaultMethod: exp.defaultMethod,
    methodRequested: false,
    channel: exp.channel,
  }
  if (exp.kind === "join_email") {
    return {
      emailExp: exp,
      phoneExp: { ...shared, kind: "join_phone", emailMode: exp.emailMode },
    }
  }
  return {
    phoneExp: exp,
    emailExp: {
      ...shared,
      kind: "join_email",
      emailMode: exp.emailMode === "full" ? "full" : "existing",
    },
  }
}

function AlternateContactLink({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  return (
    <Button asChild variant="outline" size="lg" className="w-full">
      <Link href={href}>{children}</Link>
    </Button>
  )
}

/** Where "What do I get?" goes: the QR welcome, or the venue page. */
function joinBackHref(
  merchantSlug: string,
  qrId: string | undefined,
  referralCode: string | undefined
): string {
  return qrId
    ? buildCustomerJoinHref(merchantSlug, {
        qrId,
        referralCode,
        step: "welcome",
      })
    : buildCustomerMerchantHref(merchantSlug, referralCode)
}

function PhoneStep({
  exp,
  vm,
  referralCode,
  pendingOffer,
  alternate,
}: {
  exp: PhoneExperience
  vm: CustomerExperienceViewModel
  referralCode?: string
  pendingOffer?: PendingJoinOffer | null
  alternate?: ReactNode
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
        alternate={alternate}
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
      method="email"
      dense
    >
      {pendingOffer ? (
        <StatusBanner tone="neutral" title="This offer needs a phone number">
          It is added to wallets with a confirmed phone number. Use your phone
          number to be sure of it.
        </StatusBanner>
      ) : (
        <UnlockingReminder merchant={exp.merchant} card={exp.card} />
      )}
      <CustomerEmailForm
        merchantSlug={exp.merchant.slug}
        qrId={exp.qrId}
        referralCode={referralCode}
        alternate={alternate}
        backHref={joinBackHref(exp.merchant.slug, exp.qrId, referralCode)}
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
      method="email"
      dense
    >
      <CustomerEmailChoiceForm
        merchantSlug={exp.merchant.slug}
        qrId={exp.qrId}
        referralCode={referralCode}
        maskedEmail={exp.maskedEmail}
        canCreate={exp.canCreate}
        differentEmailHref={buildCustomerJoinHref(exp.merchant.slug, {
          qrId: exp.qrId,
          referralCode,
          step: "email",
        })}
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
      method={exp.contact.method}
      dense
    >
      {exp.contact.method === "email" ? (
        <CustomerEmailOtpForm
          merchantSlug={exp.merchant.slug}
          qrId={exp.qrId}
          referralCode={referralCode}
          maskedEmail={exp.contact.maskedEmail}
          resendAvailableAt={exp.contact.resendAvailableAt}
          emailStepHref={buildCustomerJoinHref(exp.merchant.slug, {
            qrId: exp.qrId,
            referralCode,
            step: "email",
          })}
          phoneStepHref={buildCustomerJoinHref(exp.merchant.slug, {
            qrId: exp.qrId,
            referralCode,
            step: "phone",
          })}
        />
      ) : (
        <CustomerOtpForm
          merchantSlug={exp.merchant.slug}
          qrId={exp.qrId}
          contactLast4={exp.contact.last4}
          channel={exp.contact.channel}
          referralCode={referralCode}
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
  method = "phone",
}: {
  pendingOffer?: PendingJoinOffer | null
  venueName?: string
  /** The contact method this screen uses, for the offer-in-progress title. */
  method?: JoinContactMethod
  vm: CustomerExperienceViewModel
  progress?: FlowProgress
  centered?: boolean
  dense?: boolean
  children: ReactNode
}) {
  return (
    <CustomerFlowShell
      eyebrow={vm.eyebrow}
      title={
        pendingOffer && progress?.step === 1
          ? method === "email"
            ? "Save your card with your email"
            : "Save your card to your number"
          : vm.headline
      }
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
 * Step position for each onboarding screen on a 3-step scale that matches the
 * "three quick steps" promise: 1 Invite (welcome) → 2 Verification (phone or
 * email, the code and the email choice share this step) → 3 Consent (terms +
 * first stamp).
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
  const step = {
    join_welcome: 1,
    join_phone: hasQr ? 2 : 1,
    join_email: hasQr ? 2 : 1,
    join_email_choice: 2,
    join_otp: 2,
    join_terms: 3,
  }[kind]

  const label = {
    join_welcome: "Keep your card",
    join_phone: "Verify · Phone",
    join_email: "Verify · Email",
    join_email_choice: "Verify · Email",
    join_otp: "Verify · Code",
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
