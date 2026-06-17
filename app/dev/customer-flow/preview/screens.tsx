import Link from "next/link"

import {
  CustomerActionNote,
  CustomerFlowShell,
  CustomerReceipt,
  CustomerStampCard,
} from "@/components/customer/customer-flow-system"
import { CustomerFlowPlaybook } from "@/app/dev/customer-flow/playbook"
import {
  PreviewIdentityForm,
  PreviewJoinHeroNote,
  PreviewJoinTermsForm,
  PreviewMinSpendNote,
  PreviewProfileAboutYouEdit,
  PreviewProfileAboutYouView,
  PreviewProfileEmailVerify,
  PreviewProfileGate,
  PreviewProfileMarketing,
  PreviewProfileMeta,
  PreviewRewardQrButton,
  PreviewStampButton,
} from "@/app/dev/customer-flow/preview/mock-forms"
import { UnlockingReminder } from "@/components/customer/join-wizard"
import {
  RewardCelebration,
  RewardTicket,
  StampJourneyPreview,
  StatusBanner,
} from "@/components/loyalty"
import { StampCelebration } from "@/components/motion"
import { Button } from "@/components/ui/button"
import {
  getCustomerExperienceViewModel,
  waitingRewardTiming,
} from "@/lib/customer/experience/copy"
import type { JoinCard, JoinMerchant } from "@/lib/customer/experience/types"
import {
  addUkCalendarDays,
  formatStampDisplayDateFromIso,
  stampDisplayDates,
  ukTodayIso,
} from "@/lib/customer/uk-calendar"
import {
  CUSTOMER_FLOW_DEMO,
  customerFlowStatusFromRow,
} from "@/lib/dev/customer-flow-demo"
import {
  CUSTOMER_FLOW_MOCK,
  customerFlowPreviewPath,
  formatMockPence,
  type CustomerFlowPreviewStepId,
} from "@/lib/dev/customer-flow-preview"

const PREVIEW_JOIN_MERCHANT: JoinMerchant = {
  name: CUSTOMER_FLOW_MOCK.merchantName,
  slug: CUSTOMER_FLOW_MOCK.merchantSlug,
  termsUrl: CUSTOMER_FLOW_MOCK.merchantTermsUrl,
}

const PREVIEW_JOIN_CARD: JoinCard = {
  name: CUSTOMER_FLOW_MOCK.cardName,
  stampsRequired: CUSTOMER_FLOW_MOCK.stampsRequired,
  minSpendPence: CUSTOMER_FLOW_MOCK.minSpendPence,
  rewardTerms: CUSTOMER_FLOW_MOCK.rewardTerms,
}

const PREVIEW_JOIN_WELCOME = getCustomerExperienceViewModel({
  kind: "join_welcome",
  merchant: PREVIEW_JOIN_MERCHANT,
  card: PREVIEW_JOIN_CARD,
  qrId: CUSTOMER_FLOW_MOCK.qrId,
})

export function CustomerFlowPreviewScreen({
  stepId,
}: {
  readonly stepId: CustomerFlowPreviewStepId
}) {
  switch (stepId) {
    case "playbook":
      return <PreviewPlaybookScreen />
    case "join-hero":
      return <PreviewJoinScreen variant="hero" />
    case "join-phone":
      return <PreviewJoinScreen variant="phone" />
    case "join-otp":
      return <PreviewJoinScreen variant="otp" />
    case "join-terms":
      return <PreviewJoinScreen variant="terms" />
    case "stamp-day-1-confirm":
    case "stamp-day-2-confirm":
    case "stamp-day-3-confirm":
      return <PreviewStampConfirmScreen />
    case "card-1-of-3":
      return <PreviewCardScreen current={1} stampIssued />
    case "card-2-of-3":
      return <PreviewCardScreen current={2} />
    case "card-3-of-3-unlocked":
      return <PreviewCardScreen current={3} rewardUnlocked />
    case "reward-waiting":
      return <PreviewRewardScreen redeemable={false} />
    case "reward-ready-profile":
      return <PreviewRewardScreen redeemable profileIncomplete />
    case "reward-ready":
      return <PreviewRewardScreen redeemable />
    case "card-redeemed":
      return <PreviewCardScreen current={0} rewardRedeemed />
    case "profile-complete":
      return <PreviewProfileScreen variant="complete" />
    case "profile-incomplete":
      return <PreviewProfileScreen variant="incomplete" />
    case "profile-email-verify":
      return <PreviewProfileScreen variant="verify" />
    default:
      return null
  }
}

function PreviewProfileScreen({
  variant,
}: {
  readonly variant: "complete" | "incomplete" | "verify"
}) {
  return (
    <CustomerFlowShell
      eyebrow="My Nabaperks"
      title="Your details"
      description="How venues can reach you — phone, name, and optional email."
      screenLabel="Customer profile"
    >
      <div className="grid gap-6">
        {variant === "incomplete" ? (
          <StatusBanner title="Finish your details" tone="warning">
            Add your name and date of birth so rewards are ready for collection.
          </StatusBanner>
        ) : null}

        {variant === "complete" ? <PreviewProfileAboutYouView /> : null}
        {variant === "incomplete" ? <PreviewProfileAboutYouEdit /> : null}
        {variant === "verify" ? <PreviewProfileEmailVerify /> : null}

        <PreviewProfileMarketing />
        <PreviewProfileMeta />
      </div>
    </CustomerFlowShell>
  )
}

function PreviewPlaybookScreen() {
  const status = customerFlowStatusFromRow({
    phone: CUSTOMER_FLOW_DEMO.phone,
    row: {
      customer_id: "preview-customer",
      membership_id: CUSTOMER_FLOW_MOCK.membershipId,
      current_stamp_count: 3,
      total_stamps_earned: 3,
      latest_business_date: "2026-06-12",
    },
    latestReward: {
      id: CUSTOMER_FLOW_MOCK.rewardId,
      status: "unlocked",
      reward_name: CUSTOMER_FLOW_MOCK.assignedRewardName,
      redeemable_from: "2026-06-13",
    },
  })
  const links = buildCustomerFlowPreviewLinks()

  return (
    <CustomerFlowPlaybook
      status={status}
      links={links}
      otpCode="424242"
      message="Mock preview mode — every screen uses fixture data, no auth or database."
    />
  )
}

function PreviewJoinScreen({
  variant,
}: {
  readonly variant: "hero" | "phone" | "otp" | "terms"
}) {
  // Welcome — the full animated card + how-it-works.
  if (variant === "hero") {
    return (
      <CustomerFlowShell
        eyebrow={PREVIEW_JOIN_WELCOME.eyebrow}
        title={PREVIEW_JOIN_WELCOME.headline}
        description={PREVIEW_JOIN_WELCOME.supportLine}
        className="content-center"
        screenLabel="Customer join"
      >
        <CustomerReceipt
          venueName={CUSTOMER_FLOW_MOCK.merchantName}
          title={CUSTOMER_FLOW_MOCK.cardName}
          eyebrow={CUSTOMER_FLOW_MOCK.merchantName}
          hideFooter
        >
          <StampJourneyPreview
            total={CUSTOMER_FLOW_MOCK.stampsRequired}
            className="py-1"
          />
          <RewardTicket
            state="sealed"
            name="Mystery reward, sealed"
            description={
              <>
                Collect {CUSTOMER_FLOW_MOCK.stampsRequired} stamps to unlock a
                surprise reward, yours from the next UK business day.
                <PreviewMinSpendNote />
              </>
            }
          />
        </CustomerReceipt>
        <PreviewJoinHeroNote />
        <PreviewIdentityForm variant="empty" />
      </CustomerFlowShell>
    )
  }

  // Phone / code / terms — UnlockingReminder only on phone and terms so the
  // code step keeps one headline, one field, and one primary CTA.
  const stepVm = previewJoinStepVm(variant)
  return (
    <CustomerFlowShell
      eyebrow={stepVm.eyebrow}
      title={stepVm.headline}
      description={stepVm.supportLine}
      dense
      screenLabel="Customer join"
    >
      {variant === "phone" ? (
        <UnlockingReminder
          merchant={PREVIEW_JOIN_MERCHANT}
          card={PREVIEW_JOIN_CARD}
          variant="phone"
        />
      ) : null}
      {variant === "terms" ? (
        <UnlockingReminder
          merchant={PREVIEW_JOIN_MERCHANT}
          card={PREVIEW_JOIN_CARD}
          variant="terms"
        />
      ) : null}
      {variant === "phone" ? (
        <PreviewIdentityForm variant="phone-filled" />
      ) : null}
      {variant === "otp" ? <PreviewIdentityForm variant="otp-sent" /> : null}
      {variant === "terms" ? <PreviewJoinTermsForm /> : null}
    </CustomerFlowShell>
  )
}

/** Step-specific view model for the preview, mirroring production copy. */
function previewJoinStepVm(variant: "phone" | "otp" | "terms") {
  if (variant === "otp") {
    return getCustomerExperienceViewModel({
      kind: "join_otp",
      merchant: PREVIEW_JOIN_MERCHANT,
      card: PREVIEW_JOIN_CARD,
      qrId: CUSTOMER_FLOW_MOCK.qrId,
      contact: CUSTOMER_FLOW_MOCK.phone,
      location: { requireGeofence: false, geofenceRadiusMeters: 150 },
    })
  }
  if (variant === "terms") {
    return getCustomerExperienceViewModel({
      kind: "join_terms",
      merchant: PREVIEW_JOIN_MERCHANT,
      card: PREVIEW_JOIN_CARD,
      qrId: CUSTOMER_FLOW_MOCK.qrId,
      location: { requireGeofence: false, geofenceRadiusMeters: 150 },
    })
  }
  return getCustomerExperienceViewModel({
    kind: "join_phone",
    merchant: PREVIEW_JOIN_MERCHANT,
    card: PREVIEW_JOIN_CARD,
    qrId: CUSTOMER_FLOW_MOCK.qrId,
  })
}

function PreviewStampConfirmScreen() {
  return (
    <CustomerFlowShell
      eyebrow="Today's stamp"
      title="Stamp it here"
      description={CUSTOMER_FLOW_MOCK.merchantName}
      screenLabel="Customer stamp"
    >
      <section className="grid gap-5">
        <CustomerReceipt
          venueName={CUSTOMER_FLOW_MOCK.merchantName}
          eyebrow="Today's visit"
        >
          <StatusBanner title="Ready to add today's stamp." tone="success">
            Tap once while you are at the venue. Stamps are limited to one per
            UK business day.
          </StatusBanner>
          <CustomerActionNote
            title="The printed QR ties this to the venue"
            tone="leaf"
          >
            Location can be checked when available, but the action still
            continues if your browser cannot share it.
          </CustomerActionNote>
          <PreviewStampButton />
        </CustomerReceipt>
        <Button asChild size="lg" variant="secondary" className="w-full">
          <Link href={customerFlowPreviewPath("card-1-of-3")}>
            Back to card
          </Link>
        </Button>
      </section>
    </CustomerFlowShell>
  )
}

function PreviewCardScreen({
  current,
  stampIssued = false,
  rewardUnlocked = false,
  rewardRedeemed = false,
}: {
  readonly current: number
  readonly stampIssued?: boolean
  readonly rewardUnlocked?: boolean
  readonly rewardRedeemed?: boolean
}) {
  const target = CUSTOMER_FLOW_MOCK.stampsRequired
  const rewardName = rewardUnlocked
    ? CUSTOMER_FLOW_MOCK.assignedRewardName
    : "Something's under there."
  const rewardReadyDate = rewardUnlocked
    ? formatStampDisplayDateFromIso(addUkCalendarDays(ukTodayIso(), 1))
    : null
  // Mirror the shipped panel: the action band wins, so the reward copy condenses
  // unless the band is purely informational (a freshly issued stamp).
  const hasPrimaryAction = rewardUnlocked || !stampIssued
  const rewardDescription = rewardUnlocked ? undefined : hasPrimaryAction ? (
    "Mystery reward stays sealed until the final stamp."
  ) : (
    <>
      Mystery reward stays sealed until the final stamp.{" "}
      {CUSTOMER_FLOW_MOCK.rewardTerms}
    </>
  )

  return (
    <CustomerFlowShell
      eyebrow={CUSTOMER_FLOW_MOCK.merchantName}
      title={CUSTOMER_FLOW_MOCK.cardName}
      screenLabel="Customer card"
    >
      <div className="grid gap-4">
        <Link
          href={customerFlowPreviewPath("playbook")}
          className="inline-flex w-fit items-center gap-1 text-sm font-bold text-ink-soft underline-offset-4 transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] motion-reduce:transition-none hover:text-foreground hover:underline"
        >
          <span aria-hidden="true">←</span> Dev playbook
        </Link>

        <CustomerStampCard
          venueName={CUSTOMER_FLOW_MOCK.merchantName}
          cardName={CUSTOMER_FLOW_MOCK.cardName}
          current={current}
          total={target}
          slamIndex={stampIssued ? current - 1 : -1}
          stampDates={stampDisplayDates(current).slice(0, current)}
          reward={{
            state: rewardUnlocked ? "waiting" : "sealed",
            name: rewardName,
            description: rewardDescription,
            readyDate: rewardReadyDate,
          }}
          hideFooter
          hideHeaderText
          afterGrid={
            // Celebrations sit below the grid, inside the receipt (mirrors the
            // shipped card panel).
            <>
              {current >= target && rewardUnlocked ? (
                // All stamps collected — the headline beat: the seal lifts.
                <RewardCelebration
                  title="That's the full card."
                  message="Your reward is yours from opening time on the next UK business day."
                />
              ) : stampIssued ? (
                <StampCelebration>
                  <StatusBanner
                    title="Stamp added."
                    tone="success"
                    className="text-center"
                  >
                    That&apos;s one. Your progress has been updated.
                  </StatusBanner>
                </StampCelebration>
              ) : null}

              {rewardRedeemed ? (
                <StatusBanner
                  title="Reward redeemed."
                  tone="success"
                  className="text-center"
                >
                  New stamp cycle started.
                </StatusBanner>
              ) : null}
            </>
          }
        >
          {rewardUnlocked ? (
            <StatusBanner title="Give it a day to breathe" tone="warning">
              {waitingRewardTiming(addUkCalendarDays(ukTodayIso(), 1))}
            </StatusBanner>
          ) : rewardRedeemed ? null : stampIssued ? (
            // Today's stamp is already on the card — confirm it instead of
            // prompting another scan (mirrors the shipped card panel).
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

        <PreviewCardDetails />
      </div>
    </CustomerFlowShell>
  )
}

/** Mirror of the shipped dashboard's collapsed "card details" disclosure. */
function PreviewCardDetails() {
  const cardNumber = `CARD Nº ${CUSTOMER_FLOW_MOCK.membershipId
    .slice(0, 8)
    .toUpperCase()}`

  return (
    <details className="group text-left">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 text-xs font-bold text-ink-soft underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">
        Card details
        <span
          aria-hidden="true"
          className="transition-transform duration-[var(--w-dur-fast)] ease-[var(--w-ease)] motion-reduce:transition-none group-open:rotate-180"
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

function PreviewRewardScreen({
  redeemable,
  profileIncomplete = false,
}: {
  readonly redeemable: boolean
  readonly profileIncomplete?: boolean
}) {
  return (
    <CustomerFlowShell
      eyebrow="Reward"
      title={CUSTOMER_FLOW_MOCK.assignedRewardName}
      description={`${CUSTOMER_FLOW_MOCK.merchantName} - show this at the counter when ready.`}
      screenLabel="Customer reward"
    >
      <CustomerReceipt
        venueName={CUSTOMER_FLOW_MOCK.merchantName}
        eyebrow="Mystery reward"
        footerLeft={`CARD Nº ${CUSTOMER_FLOW_MOCK.membershipId.slice(0, 8).toUpperCase()}`}
      >
        <RewardTicket
          state={redeemable ? "ready" : "waiting"}
          name={CUSTOMER_FLOW_MOCK.assignedRewardName}
          readyDate={
            redeemable
              ? null
              : formatStampDisplayDateFromIso(
                  addUkCalendarDays(ukTodayIso(), 1)
                )
          }
          description={
            <>
              {CUSTOMER_FLOW_MOCK.assignedRewardTerms}
              {CUSTOMER_FLOW_MOCK.assignedRewardMinSpendPence !== null ? (
                <>
                  {" "}
                  Minimum spend{" "}
                  {formatMockPence(
                    CUSTOMER_FLOW_MOCK.assignedRewardMinSpendPence
                  )}
                  .
                </>
              ) : null}
            </>
          }
        />

        {redeemable && profileIncomplete ? (
          <>
            <StatusBanner
              title="A few details before this one's yours"
              tone="neutral"
            >
              Add your name and date of birth before collection. Email is
              optional - add one to get reward updates.
            </StatusBanner>
            <PreviewProfileGate />
          </>
        ) : redeemable ? (
          <>
            <StatusBanner title="Ready for merchant scan." tone="success">
              Show this QR while you are at the venue. The merchant scans it
              from their device.
            </StatusBanner>
            <PreviewRewardQrButton />
          </>
        ) : (
          <>
            <StatusBanner title="Give it a day to breathe" tone="warning">
              {waitingRewardTiming(addUkCalendarDays(ukTodayIso(), 1))}
            </StatusBanner>
            <Button asChild size="lg" variant="secondary" className="w-full">
              <Link href={customerFlowPreviewPath("card-3-of-3-unlocked")}>
                Return to card
              </Link>
            </Button>
          </>
        )}
      </CustomerReceipt>
    </CustomerFlowShell>
  )
}

export type CustomerFlowPreviewLinks = ReturnType<
  typeof buildCustomerFlowPreviewLinks
>

export function buildCustomerFlowPreviewLinks() {
  return {
    joinHero: customerFlowPreviewPath("join-hero"),
    join: customerFlowPreviewPath("join-phone"),
    qrStampConfirm: customerFlowPreviewPath("stamp-day-2-confirm"),
    qrStampConfirmDay3: customerFlowPreviewPath("stamp-day-3-confirm"),
    stampConfirm: customerFlowPreviewPath("stamp-day-1-confirm"),
    card: customerFlowPreviewPath("card-1-of-3"),
    cardTwo: customerFlowPreviewPath("card-2-of-3"),
    cardThree: customerFlowPreviewPath("card-3-of-3-unlocked"),
    reward: customerFlowPreviewPath("reward-waiting"),
    rewardReady: customerFlowPreviewPath("reward-ready"),
    redeemedCard: customerFlowPreviewPath("card-redeemed"),
  }
}
