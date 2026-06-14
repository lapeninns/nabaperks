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
  PreviewRedeemButton,
  PreviewStampButton,
} from "@/app/dev/customer-flow/preview/mock-forms"
import {
  PintReward,
  PintRewardCelebration,
  RewardTeaser,
  StatusBanner,
} from "@/components/loyalty"
import { StampCelebration } from "@/components/motion"
import { Button } from "@/components/ui/button"
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
    case "reward-ready":
      return <PreviewRewardScreen redeemable />
    case "card-redeemed":
      return <PreviewCardScreen current={0} rewardRedeemed />
    default:
      return null
  }
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
  return (
    <CustomerFlowShell
      eyebrow="Scanned at the counter"
      title="Save your stamp card"
      description={`Save ${CUSTOMER_FLOW_MOCK.merchantName}'s card to your number — new or returning, your stamps stay put. No app, no plastic.`}
      className="content-center"
      screenLabel="Customer join"
    >
      {/* Compact identity card — no presumptuous "0 of N" grid (mirrors the
          shipped QR-scan welcome shown to logged-out returning members). */}
      <CustomerReceipt
        venueName={CUSTOMER_FLOW_MOCK.merchantName}
        title={CUSTOMER_FLOW_MOCK.cardName}
        eyebrow={CUSTOMER_FLOW_MOCK.merchantName}
        hideFooter
      >
        <RewardTeaser
          locked
          title="Mystery reward, sealed"
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

      {variant === "hero" ? (
        <PreviewIdentityForm variant="empty" />
      ) : null}
      {variant === "phone" ? (
        <PreviewIdentityForm variant="phone-filled" />
      ) : null}
      {variant === "otp" ? (
        <PreviewIdentityForm variant="otp-sent" />
      ) : null}
      {variant === "terms" ? <PreviewJoinTermsForm /> : null}
    </CustomerFlowShell>
  )
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
            Tap once while you are at the venue. Stamps are limited to one per UK
            business day.
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
          <Link href={customerFlowPreviewPath("card-1-of-3")}>Back to card</Link>
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
  const rewardTitle = rewardUnlocked
    ? CUSTOMER_FLOW_MOCK.assignedRewardName
    : "Something's under there."
  const rewardDescription = rewardUnlocked ? (
    <>
      {CUSTOMER_FLOW_MOCK.assignedRewardTerms}
      {CUSTOMER_FLOW_MOCK.assignedRewardMinSpendPence !== null ? (
        <>
          {" "}
          Minimum spend{" "}
          {formatMockPence(CUSTOMER_FLOW_MOCK.assignedRewardMinSpendPence)}.
        </>
      ) : null}
      Give it a day to breathe - it&apos;s yours from opening time tomorrow.
    </>
  ) : (
    <>Mystery reward stays sealed until the final stamp. {CUSTOMER_FLOW_MOCK.rewardTerms}</>
  )

  return (
    <CustomerFlowShell
      eyebrow="Nabaperks loyalty"
      title="Your card"
      description={`${CUSTOMER_FLOW_MOCK.merchantName} - ${CUSTOMER_FLOW_MOCK.cardName}`}
      screenLabel="Customer card"
    >
      <div className="grid gap-4">
        <Link
          href={customerFlowPreviewPath("playbook")}
          className="inline-flex w-fit items-center gap-1 text-sm font-bold text-ink-soft underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          <span aria-hidden="true">←</span> Dev playbook
        </Link>

        {current >= target && rewardUnlocked ? (
          // All stamps collected — the headline moment. Pour the pint.
          <PintRewardCelebration
            title="Pint unlocked!"
            message="That's the full card. Your pint is yours from opening time on the next UK business day."
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

        <CustomerStampCard
          venueName={CUSTOMER_FLOW_MOCK.merchantName}
          cardName={CUSTOMER_FLOW_MOCK.cardName}
          current={current}
          total={target}
          slamIndex={stampIssued ? current - 1 : -1}
          rewardLocked={!rewardUnlocked}
          rewardTitle={rewardTitle}
          rewardDescription={rewardDescription}
          hideFooter
        >
          {rewardUnlocked ? (
            <StatusBanner title="Give it a day to breathe" tone="warning">
              It&apos;s yours from opening time tomorrow.
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

function PreviewRewardScreen({
  redeemable,
}: {
  readonly redeemable: boolean
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
        <PintReward
          pour
          caption={redeemable ? "Ready to pour" : "Pouring soon"}
        />
        <RewardTeaser
          locked={false}
          title={CUSTOMER_FLOW_MOCK.assignedRewardName}
          description={
            <>
              {CUSTOMER_FLOW_MOCK.assignedRewardTerms}
              {CUSTOMER_FLOW_MOCK.assignedRewardMinSpendPence !== null ? (
                <>
                  {" "}
                  Minimum spend{" "}
                  {formatMockPence(CUSTOMER_FLOW_MOCK.assignedRewardMinSpendPence)}.
                </>
              ) : null}
            </>
          }
        />
        <CustomerActionNote
          title="Counter check"
          tone={redeemable ? "leaf" : "sun"}
        >
          Rewards become redeemable from the next UK business day after the final
          stamp.
        </CustomerActionNote>

        {redeemable ? (
          <>
            <StatusBanner title="Ready to redeem." tone="success">
              Tap redeem while you are at the venue, then show the redeemed card if
              asked.
            </StatusBanner>
            <PreviewRedeemButton />
          </>
        ) : (
          <>
            <StatusBanner title="Give it a day to breathe" tone="warning">
              It&apos;s yours from opening time tomorrow.
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
