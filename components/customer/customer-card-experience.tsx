import type { ReactNode } from "react"
import Link from "next/link"
import {
  ArrowDown01Icon,
  ArrowLeft01Icon,
  GiftIcon,
} from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { CelebrationUrlCleanup } from "@/components/customer/celebration-url-cleanup"
import { GoogleReviewButton } from "@/components/customer/google-review-button"
import { JoinFirstStampRecoveryPanel } from "@/components/customer/join-first-stamp-recovery-panel"
import {
  CustomerActionNote,
  CustomerFlowShell,
  CustomerReceipt,
  CustomerStampCard,
  type FlowProgress,
} from "@/components/customer/customer-flow-system"
import { ReferralBonusBankNotice } from "@/components/customer/referral-bonus-bank-panels"
import { CustomerTabBar } from "@/components/layout"
import { ReferralSharePanel } from "@/components/customer/referral-share-panel"
import { StampScreen } from "@/components/customer/stamp-screen"
import { UnavailableRecoveryActions } from "@/components/customer/unavailable-recovery"
import {
  RedeemedProofPanel,
  RewardReadyPanel,
  RewardWaitingPanel,
} from "@/components/customer/reward-panels"
import {
  RewardCelebration,
  StatusBanner,
  type RewardTicketState,
} from "@/components/loyalty"
import { StampCelebration } from "@/components/motion"
import { Button } from "@/components/ui/button"
import {
  OPEN_MY_CARDS_LABEL,
  SEALED_REWARD_NAME,
  SEALED_REWARD_NOTE,
} from "@/lib/copy/product-copy"
import {
  collectionProgressVisible,
  collectionSetup,
} from "@/lib/customer/experience/collection-stage"
import {
  getCustomerExperienceViewModel,
  waitingRewardTiming,
  type CustomerExperienceViewModel,
} from "@/lib/customer/experience/copy"
import { cardRewardTicket } from "@/lib/customer/experience/card-reward"
import { nextStampLine } from "@/lib/customer/experience/next-stamp"
import {
  REWARD_NEEDS_SETUP_ACTION,
  REWARD_NEEDS_SETUP_LINE,
} from "@/lib/customer/home-dashboard"
import { rewardSourceBadge } from "@/lib/customer/issued-reward-display"
import { hasVisibleReferralBonusBank } from "@/lib/customer/referral-bonus-bank-copy"
import {
  collectionWindowCopy,
  formatCollectionAvailability,
  formatCollectionAvailableLabel,
  formatCollectionDeadline,
} from "@/lib/customer/reward-collection-state"
import { OfferPassRail } from "@/components/customer/offer-pass-rail"
import type { CustomerOfferPass } from "@/lib/customer/offer-pass"
import type { OfferClaimNotice } from "@/lib/customer/offer-pass-view"
import type {
  CustomerExperience,
  CustomerExperienceKind,
} from "@/lib/customer/experience/types"

/**
 * Single rendering surface for the card / stamp / reward routes. The route page
 * derives a {@link CustomerExperience}; this component maps it to the shell chrome
 * (one headline, from the view model) and the matching panel (one job, one CTA).
 * Join states are rendered by `JoinWizard`, not here.
 *
 * `offerPasses` arrives separately from the experience union on purpose. A
 * discount pass is not a reward: it has unlimited uses inside its window while
 * a reward is consumed once, so it is its own record and gets its own rail
 * rather than being folded into `RewardSource` or the reward panels.
 *
 * Both offer props are **required** with no default. An optional `= []` compiled
 * silently while no route fed it, which is how the rail shipped as unreachable
 * dead code; required props make forgetting them a type error instead. A route
 * that never renders the card-progress panel passes `[]` and `null` explicitly,
 * which states the decision rather than hiding it.
 */
export function CustomerCardExperience({
  experience,
  offerPasses,
  offerClaimNotice,
  qrSrc,
  notice,
}: {
  experience: CustomerExperience
  offerPasses: readonly CustomerOfferPass[]
  offerClaimNotice: OfferClaimNotice | null
  /** Harness-only reward QR source override; production never passes it. */
  qrSrc?: string
  /**
   * A confirmation carried back by a redirect (the reward gate's `?contact=`
   * after a mobile number is confirmed), shown above the panel.
   */
  notice?: ReactNode
}) {
  const vm = getCustomerExperienceViewModel(experience)

  if (
    experience.kind === "stamp_confirm" ||
    experience.kind === "card_stamped_today"
  ) {
    // The stamp screen's headline follows the stamp result once it lands, so
    // it owns its shell (components/customer/stamp-screen.tsx).
    return (
      <>
        <StampScreen exp={experience} vm={vm} />
        <CustomerTabBar />
      </>
    )
  }

  return (
    <>
      <CustomerFlowShell
        eyebrow={vm.eyebrow}
        title={vm.headline}
        description={vm.supportLine}
        progress={collectionProgress(experience)}
        className="pb-28"
        // Screens whose panel states what to do in its own words opt into the
        // landscape floor: the stamp band, and the collection code, whose
        // instruction sits beside it. Everywhere else the support line *is* the
        // instruction, so it stays at full size.
        landscapeCompact={landscapeCompact(experience)}
        screenLabel={screenLabelFor(experience.kind)}
      >
        {notice}
        <ExperiencePanel
          experience={experience}
          vm={vm}
          offerPasses={offerPasses}
          offerClaimNotice={offerClaimNotice}
          qrSrc={qrSrc}
        />
      </CustomerFlowShell>
      <CustomerTabBar />
    </>
  )
}

function ExperiencePanel({
  experience,
  vm,
  offerPasses,
  offerClaimNotice,
  qrSrc,
}: {
  experience: CustomerExperience
  vm: CustomerExperienceViewModel
  offerPasses: readonly CustomerOfferPass[]
  offerClaimNotice: OfferClaimNotice | null
  qrSrc?: string
}) {
  switch (experience.kind) {
    case "card_collecting":
      return (
        <CardProgressPanel
          exp={experience}
          offerPasses={offerPasses}
          offerClaimNotice={offerClaimNotice}
        />
      )
    case "stamp_unmatched":
      return <StampUnmatchedPanel exp={experience} />
    case "reward_waiting":
      return <RewardWaitingPanel exp={experience} />
    case "reward_ready":
      return <RewardReadyPanel exp={experience} qrSrc={qrSrc} />
    case "redeemed_proof":
      return <RedeemedProofPanel exp={experience} vm={vm} />
    case "unavailable":
      return <UnavailablePanel vm={vm} />
    default:
      // Join states never reach this surface; render the calm fallback.
      return <UnavailablePanel vm={vm} />
  }
}

function CardProgressPanel({
  exp,
  offerPasses,
  offerClaimNotice,
}: {
  exp: Extract<CustomerExperience, { kind: "card_collecting" }>
  offerPasses: readonly CustomerOfferPass[]
  offerClaimNotice: OfferClaimNotice | null
}) {
  const cardComplete = exp.total > 0 && exp.current >= exp.total
  // A reward held only by setup is unlocked, never shown as ready.
  const rewardState: RewardTicketState = cardRewardTicket(exp)
  const rewardName =
    rewardState === "sealed"
      ? SEALED_REWARD_NAME
      : (exp.rewardName ?? "Your reward")
  const walletReward = exp.walletReward
  const rewardReadyDate =
    exp.reward === "waiting" && walletReward?.availableFrom
      ? formatCollectionAvailableLabel(walletReward.availableFrom)
      : null
  // The bottom band is purely informational only in the "stamp secured" case;
  // every other branch (redeem, waiting, blocked, scan prompt) is an instruction
  // the customer should act on, so the reward copy steps back to let it win.
  const stampSecuredOnly =
    exp.justStamped &&
    !(exp.reward === "ready" && exp.rewardId) &&
    exp.reward !== "waiting"
  const hasPrimaryAction = !stampSecuredOnly

  const rewardDescription = cardRewardDescription({
    state: rewardState,
    needsSetup: exp.reward === "ready" && exp.rewardNeedsSetup === true,
    hasPrimaryAction,
    terms: exp.rewardTerms,
    availableFrom: walletReward?.availableFrom ?? null,
  })

  return (
    <div className="grid gap-4">
      {/* Strip the one-shot celebration params after the first render so a
          refresh does not replay the welcome/stamp moment (CUS-P3-07). */}
      {exp.justStamped || exp.justJoined || exp.justRedeemed ? (
        <CelebrationUrlCleanup />
      ) : null}
      <Link
        href="/home"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-bold text-ink-soft underline-offset-4 transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] hover:text-foreground hover:underline motion-reduce:transition-none"
      >
        <Icon icon={ArrowLeft01Icon} size={16} />
        {OPEN_MY_CARDS_LABEL}
      </Link>

      {offerClaimNotice ? (
        <OfferClaimBanner
          notice={offerClaimNotice}
          hasDiscountPass={offerPasses.length > 0}
        />
      ) : null}

      <CustomerStampCard
        venueName={exp.merchantName}
        cardName={exp.cardName}
        current={exp.current}
        total={exp.total}
        slamIndex={exp.slamIndex}
        stampDates={exp.stampDates}
        reward={{
          state: rewardState,
          name: rewardName,
          description: rewardDescription,
          readyDate: rewardReadyDate,
          requiresAgeCheck: walletReward?.requiresAgeCheck,
          earningTerms: walletReward?.earningTerms,
          expiryText: formatCollectionDeadline(walletReward?.expiresAt ?? null),
          collectionWindowText: walletReward
            ? collectionWindowCopy(walletReward)
            : null,
        }}
        hideFooter
        hideHeaderText
        afterGrid={
          // Celebrations sit below the grid, inside the receipt, so the stamp
          // progress stays the first focal point rather than being pushed down.
          <>
            {exp.justStamped && cardComplete ? (
              // All stamps collected: the seal lifts, and the ticket below
              // shows the now-revealed reward.
              <RewardCelebration
                title="Your card is full."
                message={completedCardMessage(exp, walletReward?.availableFrom)}
              />
            ) : exp.justJoined &&
              !exp.firstStampRecovery &&
              !offerClaimNotice ? (
              // The welcome stands alone: nothing is asked of the guest here.
              // The shell headline already says "Welcome to {Venue}", so the
              // banner names the outcome instead of repeating it.
              exp.justStamped ? (
                <StampCelebration>
                  <StatusBanner
                    title="Your first stamp is on your card."
                    tone="success"
                    className="text-center"
                  />
                </StampCelebration>
              ) : (
                <StampCelebration>
                  <StatusBanner
                    title="Your card is saved."
                    tone="success"
                    className="text-center"
                  >
                    Scan the QR at the counter on your next visit to get your
                    first stamp.
                  </StatusBanner>
                </StampCelebration>
              )
            ) : exp.justStamped ? (
              <StampCelebration>
                <StatusBanner
                  title="Stamp added."
                  tone="success"
                  className="text-center"
                >
                  Today&apos;s stamp is on your card.
                </StatusBanner>
              </StampCelebration>
            ) : null}

            {exp.justRedeemed ? (
              <StatusBanner
                title="Reward collected."
                tone="success"
                className="text-center"
              >
                Your next card has started.
              </StatusBanner>
            ) : null}
          </>
        }
      >
        <CardPrimaryAction exp={exp} />
      </CustomerStampCard>

      {exp.gift ? (
        <CardGiftChip gift={exp.gift} merchantName={exp.merchantName} />
      ) : null}

      {offerPasses.map((pass) => (
        <OfferPassRail key={pass.entitlementId} pass={pass} />
      ))}

      {hasVisibleReferralBonusBank(exp.referralBonusBank) ? (
        <ReferralBonusBankNotice bank={exp.referralBonusBank} />
      ) : null}

      {/* Invite a friend: below the card progress, and only once the guest
          has a stamp of their own. Never on the welcome moment itself. */}
      {exp.referralShareUrl && exp.current > 0 && !exp.justJoined ? (
        <ReferralSharePanel
          url={exp.referralShareUrl}
          membershipId={exp.membershipId}
          venueName={exp.merchantName}
          compact
        />
      ) : null}

      {exp.googleReviewUrl && !exp.justJoined ? (
        <GoogleReviewButton
          url={exp.googleReviewUrl}
          venueName={exp.merchantName}
        />
      ) : null}

      <CardDetailsDisclosure cardNumber={cardNumber(exp.membershipId)} />
    </div>
  )
}

function cardRewardDescription({
  state,
  needsSetup,
  hasPrimaryAction,
  terms,
  availableFrom,
}: {
  state: RewardTicketState
  needsSetup: boolean
  hasPrimaryAction: boolean
  terms: string
  availableFrom: string | null
}): ReactNode {
  // Unlocked but held by a setup step: never "show it at the counter".
  if (needsSetup) {
    return hasPrimaryAction
      ? REWARD_NEEDS_SETUP_LINE
      : `${terms} ${REWARD_NEEDS_SETUP_LINE}`
  }
  if (state === "sealed") {
    return hasPrimaryAction
      ? SEALED_REWARD_NOTE
      : `${SEALED_REWARD_NOTE} ${terms}`
  }
  if (state === "waiting") {
    return hasPrimaryAction
      ? undefined
      : `${terms} ${waitingRewardTiming(availableFrom)}`
  }
  return hasPrimaryAction ? terms : `${terms} Show your reward at the counter.`
}

function completedCardMessage(
  exp: Extract<CustomerExperience, { kind: "card_collecting" }>,
  availableFrom: string | null | undefined
): string {
  if (exp.reward === "ready") {
    // Unlocked but held by a setup step: never read as a code to show.
    return exp.rewardNeedsSetup
      ? REWARD_NEEDS_SETUP_LINE
      : "Your reward is ready to collect."
  }
  return (
    formatCollectionAvailability(availableFrom ?? null) ??
    "Open your reward for collection timing."
  )
}

/**
 * A birthday / merchant-sent reward shown as a distinct gift beside the card —
 * on its own rail, never implying the stamp card is complete. Redeemable gifts
 * offer their own QR; a not-yet-open gift shows a calm "ready from" note.
 */
function CardPrimaryAction({
  exp,
}: {
  exp: Extract<CustomerExperience, { kind: "card_collecting" }>
}) {
  return exp.firstStampRecovery ? (
    <JoinFirstStampRecoveryPanel
      membershipId={exp.membershipId}
      recovery={exp.firstStampRecovery}
    />
  ) : exp.rewardId && (exp.reward === "ready" || exp.reward === "waiting") ? (
    // The one thing to do on this card: see the unlocked reward. Its own
    // screen says when it can be collected and what it still needs.
    <div className="grid gap-1.5">
      <Button asChild size="lg" variant="reward" className="w-full">
        <Link href={`/reward/${exp.rewardId}`}>See my reward</Link>
      </Button>
      {exp.reward === "waiting" ? (
        <p className="text-center text-xs leading-5 text-muted-foreground">
          {waitingRewardTiming(exp.walletReward?.availableFrom ?? null)}
        </p>
      ) : null}
    </div>
  ) : exp.justStamped ? (
    // Today's stamp is already on the card: say when the next one opens,
    // instead of prompting another scan, which would read as a failure.
    <p className="text-center text-sm leading-5 text-ink-soft">
      {nextStampLine(exp.nextStampFrom)}
    </p>
  ) : (
    // Nothing to do on the card itself, so no primary action: one quiet
    // line saying how today's stamp is added.
    <p className="text-center text-sm leading-5 text-ink-soft">
      Scan the QR at the counter to get today&apos;s stamp.
    </p>
  )
}

function CardGiftChip({
  gift,
  merchantName,
}: {
  gift: NonNullable<
    Extract<CustomerExperience, { kind: "card_collecting" }>["gift"]
  >
  merchantName: string
}) {
  const badge = rewardSourceBadge(gift.source, merchantName) ?? "Gift"

  return (
    <div className="grid gap-2 rounded-lg border-2 border-ink bg-seal/15 p-3">
      <div className="flex items-center gap-1.5">
        <Icon icon={GiftIcon} size={16} />
        <span className="mono-id tracking-[0.08em] text-ink">{badge}</span>
      </div>
      <p className="text-sm leading-tight font-extrabold break-words">
        {gift.rewardName}
      </p>
      {gift.redeemable ? (
        <Button asChild size="sm" variant="reward" className="w-full">
          <Link href={`/reward/${gift.rewardId}`}>
            {gift.needsSetup ? REWARD_NEEDS_SETUP_ACTION : "Open gift QR"}
          </Link>
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          {formatCollectionAvailability(gift.availableFrom) ??
            "Collection timing will appear here."}
        </p>
      )}
    </div>
  )
}

/**
 * What the join flow just decided, answered on the card the customer lands on.
 * `app/m/[merchantSlug]/join/actions.ts` redirects here with `?offer=1`,
 * `?offer=claimed` or `?membership=existing`; without this the customer arrives
 * on an ordinary card with no word on whether the poster they scanned did
 * anything.
 *
 * The copy states standing rather than narrating a moment, so it stays true if
 * the customer refreshes with the parameter still on the URL.
 *
 * `already_member` deliberately names no mechanism: `?membership=existing` is
 * emitted by the loyalty-invite claim as well as the offer claim, so calling it
 * an offer would be wrong half the time.
 *
 * `hasDiscountPass` is what stops the copy promising something that was never
 * issued. A campaign may award bonus stamps only, in which case
 * `claim_offer_campaign` creates no entitlement and there is no pass to open —
 * so the pass sentence appears only when this card actually carries one, and the
 * bonus-only case gets benefit-neutral wording instead. It is read from the
 * pass rail rendered on this very screen, so the banner can never point at a
 * pass the customer cannot see.
 */
function OfferClaimBanner({
  notice,
  hasDiscountPass,
}: {
  notice: OfferClaimNotice
  hasDiscountPass: boolean
}) {
  if (notice === "claimed") {
    return (
      <StatusBanner title="Offer added to your card." tone="success">
        {hasDiscountPass
          ? "Your discount pass is saved here. Open it when you are at the venue and the team will scan it."
          : "Everything the offer gives you is on this card already, so there is nothing else to collect."}
      </StatusBanner>
    )
  }

  if (notice === "already_claimed") {
    return (
      <StatusBanner title="You already have this offer." tone="neutral">
        {hasDiscountPass
          ? "Nothing was added a second time. Your discount pass is saved on this card."
          : "Nothing was added a second time. What you claimed is already on this card."}
      </StatusBanner>
    )
  }

  return (
    <StatusBanner title="You are already a member here." tone="neutral">
      The welcome is for new members, so nothing extra was added. Your stamps
      and rewards are unchanged.
    </StatusBanner>
  )
}

/**
 * Secondary technical details (card number, stamp rule) tucked behind a quiet
 * disclosure so the dashboard reads as a reward, not a contract. Collapsed by
 * default: one calm line until the customer asks for the specifics.
 */
function CardDetailsDisclosure({ cardNumber }: { cardNumber: string }) {
  return (
    <details className="group text-left">
      <summary className="focus-ring flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 rounded-sm text-xs font-bold text-ink-soft underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">
        Card details
        <Icon
          icon={ArrowDown01Icon}
          size={14}
          className="text-ink-soft transition-transform duration-[var(--w-dur-fast)] ease-[var(--w-ease)] group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <dl className="mono-id mt-2 grid gap-1.5 tracking-[0.08em] text-muted-foreground">
        <div className="flex justify-between gap-3">
          <dt>{cardNumber}</dt>
          <dd>One stamp a day</dd>
        </div>
      </dl>
    </details>
  )
}

/**
 * The stamp screen reached without a usable QR. The card stays — it is the
 * member's own and the reassuring thing on screen — and the band that would
 * hold today's stamp status names the problem and what fixes it, with the
 * shared recovery pair beneath. Never a bare sentence with no way forward.
 */
function StampUnmatchedPanel({
  exp,
}: {
  exp: Extract<CustomerExperience, { kind: "stamp_unmatched" }>
}) {
  const band =
    exp.problem === "missing"
      ? {
          title: "Scan the QR at the counter.",
          body: "Today's stamp button appears here once you scan it.",
        }
      : {
          title: "Stamp not added.",
          body: "This QR is for another venue or has been replaced. Scan the QR at the counter again, or ask a team member.",
        }

  return (
    <section className="grid gap-5 short:gap-4">
      <CustomerStampCard
        venueName={exp.merchantName}
        cardName={exp.cardName}
        current={exp.current}
        total={exp.total}
        stampDates={exp.stampDates}
        reward={{
          state: "sealed",
          name: SEALED_REWARD_NAME,
          description: SEALED_REWARD_NOTE,
        }}
        rewardSlot="locked"
        hideFooter
        hideHeaderText
        afterGrid={
          <section
            data-stamp-unmatched={exp.problem}
            className="grid min-h-28 grid-rows-[auto_1fr] content-start gap-1 rounded-lg border-2 border-dashed border-line-strong bg-secondary/45 px-4 py-3 text-center short:min-h-24"
          >
            <p className="font-extrabold text-balance">{band.title}</p>
            <p className="text-sm leading-5 font-medium text-ink-soft">
              {band.body}
            </p>
          </section>
        }
      />
      <UnavailableRecoveryActions scanLabel="Scan the QR" />
    </section>
  )
}

function UnavailablePanel({ vm }: { vm: CustomerExperienceViewModel }) {
  return (
    <section className="grid gap-5">
      {/* The shell already carries the headline and reason, so the receipt
          keeps only the recovery guidance — no duplicated banner, no mono
          footer inventing a card number — and the sole CTA clears the tab bar
          on first paint (VCU-P2-05, CUS-P2-01). */}
      <CustomerReceipt
        venueName="Nabaperks"
        eyebrow="Nabaperks loyalty"
        hideFooter
      >
        <CustomerActionNote title="Need a hand?" tone="plain">
          Ask a team member for the current loyalty QR, or open your cards to
          find them.
        </CustomerActionNote>
      </CustomerReceipt>
      {/* An error page's only action reads as the primary (VCU-P2-06). */}
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

function cardNumber(membershipId: string): string {
  return `CARD Nº ${membershipId.slice(0, 8).toUpperCase()}`
}

function landscapeCompact(experience: CustomerExperience): boolean {
  if (
    experience.kind === "stamp_confirm" ||
    experience.kind === "card_stamped_today" ||
    experience.kind === "stamp_unmatched"
  ) {
    return true
  }

  // Only the collection stage: while a setup step is outstanding the headline
  // is the instruction and must not shrink.
  return (
    experience.kind === "reward_ready" &&
    !collectionSetup(experience.profileGate, experience.reward.requiresAgeCheck)
      .outstanding
  )
}

/**
 * The collection setup readout, and only where it is true. It appears when this
 * customer genuinely has more than one step left, counts the steps their own
 * profile still needs, and never renders once the requirements are met.
 */
function collectionProgress(
  experience: CustomerExperience
): FlowProgress | undefined {
  const gate =
    experience.kind === "reward_ready"
      ? experience.profileGate
      : experience.kind === "reward_waiting" && experience.preparing
        ? experience.profileGate
        : undefined
  const reward =
    experience.kind === "reward_ready" || experience.kind === "reward_waiting"
      ? experience.reward
      : undefined
  if (!gate || !reward) return undefined

  const setup = collectionSetup(gate, reward.requiresAgeCheck)
  if (!collectionProgressVisible(setup)) return undefined

  return { step: setup.step, total: setup.total, label: "Collection setup" }
}

function screenLabelFor(kind: CustomerExperienceKind): string {
  switch (kind) {
    case "stamp_confirm":
    case "card_stamped_today":
    case "stamp_unmatched":
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
