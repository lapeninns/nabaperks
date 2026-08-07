import type { ReactNode } from "react"
import Link from "next/link"
import {
  ArrowLeft01Icon,
  DiscountTag01Icon,
  GiftIcon,
} from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { PromiseChip } from "@/components/customer/promise-chip"
import { CelebrationUrlCleanup } from "@/components/customer/celebration-url-cleanup"
import { GoogleReviewButton } from "@/components/customer/google-review-button"
import { JoinFirstStampRecoveryPanel } from "@/components/customer/join-first-stamp-recovery-panel"
import {
  CustomerActionNote,
  CustomerFlowShell,
  CustomerReceipt,
  CustomerStampCard,
} from "@/components/customer/customer-flow-system"
import { ReferralBonusBankNotice } from "@/components/customer/referral-bonus-bank-panels"
import { CustomerTabBar, TAB_BAR_CLEARANCE } from "@/components/layout"
import { ReferralSharePanel } from "@/components/customer/referral-share-panel"
import { StampCollector } from "@/components/customer/stamp-collector"
import {
  RedeemedProofPanel,
  RewardReadyPanel,
  RewardWaitingPanel,
} from "@/components/customer/reward-panels"
import {
  RewardCelebration,
  StatusBanner,
  formatOfferPassDate,
  type RewardTicketState,
} from "@/components/loyalty"
import { StampCelebration } from "@/components/motion"
import { Button } from "@/components/ui/button"
import { SEALED_REWARD_NAME, SEALED_REWARD_NOTE } from "@/lib/copy/product-copy"
import {
  getCustomerExperienceViewModel,
  waitingRewardTiming,
  type CustomerExperienceViewModel,
} from "@/lib/customer/experience/copy"
import { rewardSourceBadge } from "@/lib/customer/issued-reward-display"
import { hasVisibleReferralBonusBank } from "@/lib/customer/referral-bonus-bank-copy"
import { formatStampDisplayDateFromIso } from "@/lib/customer/uk-calendar"
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
}: {
  experience: CustomerExperience
  offerPasses: readonly CustomerOfferPass[]
  offerClaimNotice: OfferClaimNotice | null
}) {
  const vm = getCustomerExperienceViewModel(experience)

  return (
    <>
      <CustomerFlowShell
        eyebrow={vm.eyebrow}
        title={vm.headline}
        description={vm.supportLine}
        className={TAB_BAR_CLEARANCE}
        screenLabel={screenLabelFor(experience.kind)}
      >
        <ExperiencePanel
          experience={experience}
          vm={vm}
          offerPasses={offerPasses}
          offerClaimNotice={offerClaimNotice}
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
}: {
  experience: CustomerExperience
  vm: CustomerExperienceViewModel
  offerPasses: readonly CustomerOfferPass[]
  offerClaimNotice: OfferClaimNotice | null
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
    case "card_stamped_today":
    case "stamp_confirm":
      return <StampScreenPanel exp={experience} />
    case "reward_waiting":
      return <RewardWaitingPanel exp={experience} />
    case "reward_ready":
      return <RewardReadyPanel exp={experience} />
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
  const rewardState: RewardTicketState =
    exp.reward === "ready"
      ? "ready"
      : exp.reward === "waiting"
        ? "waiting"
        : "sealed"
  const rewardName =
    rewardState === "sealed"
      ? SEALED_REWARD_NAME
      : (exp.rewardName ?? "Your reward")
  const rewardReadyDate =
    rewardState === "waiting" && exp.rewardRedeemableFrom
      ? formatStampDisplayDateFromIso(exp.rewardRedeemableFrom)
      : null
  // The bottom band is purely informational only in the "stamp secured" case;
  // every other branch (redeem, waiting, blocked, scan prompt) is an instruction
  // the customer should act on, so the reward copy steps back to let it win.
  const stampSecuredOnly =
    exp.justStamped &&
    !(exp.reward === "ready" && exp.rewardId) &&
    exp.reward !== "waiting"
  const hasPrimaryAction = !stampSecuredOnly

  const rewardDetails = <>{exp.rewardTerms}</>
  let rewardDescription: ReactNode
  if (rewardState === "sealed") {
    // Show the longer mystery terms only when the action band is informational
    // (stamp secured), not while it is instructing the customer to act.
    rewardDescription = hasPrimaryAction ? (
      SEALED_REWARD_NOTE
    ) : (
      <>
        {SEALED_REWARD_NOTE} {exp.rewardTerms}
      </>
    )
  } else if (rewardState === "waiting") {
    // The waiting notice in the action band already explains the wait.
    rewardDescription = hasPrimaryAction ? undefined : (
      <>
        {rewardDetails}
        {` Give it a day to breathe. ${waitingRewardTiming(exp.rewardRedeemableFrom)}`}
      </>
    )
  } else {
    rewardDescription = hasPrimaryAction ? (
      rewardDetails
    ) : (
      <>
        {rewardDetails}
        {" Reward ready for merchant scan."}
      </>
    )
  }

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
        Your cards
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
        }}
        hideFooter
        hideHeaderText
        afterGrid={
          // Celebrations sit below the grid, inside the receipt, so the stamp
          // progress stays the first focal point rather than being pushed down.
          <>
            {exp.justStamped && cardComplete ? (
              // All stamps collected — the headline beat: the seal lifts, and
              // the ticket below shows the now-revealed reward.
              <RewardCelebration
                title="That's the full card."
                message={
                  exp.reward === "ready"
                    ? "Your reward is ready, claim it at the counter while you're here."
                    : "Your reward is yours from opening time on the next UK business day."
                }
              />
            ) : exp.justJoined && !exp.firstStampRecovery ? (
              <StampCelebration>
                {/* The banner says the NEW thing only. "Welcome to {venue}"
                    is already the h1 above it, and the venue name is in the
                    eyebrow above that — so this title used to be the second
                    verbatim print of the headline and the third print of the
                    venue name on one screen. (02#21) */}
                <StatusBanner
                  title="You're in."
                  tone="success"
                  className="text-center"
                >
                  {exp.justStamped
                    ? "Your first stamp is on the card."
                    : "Scan the venue QR in store to collect your first stamp."}
                </StatusBanner>
              </StampCelebration>
            ) : exp.justStamped ? (
              <StampCelebration>
                <StatusBanner
                  title="Stamp added."
                  tone="success"
                  className="text-center"
                >
                  That&apos;s one. Your progress is saved.
                </StatusBanner>
              </StampCelebration>
            ) : null}

            {exp.justRedeemed ? (
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
        {exp.firstStampRecovery ? (
          <JoinFirstStampRecoveryPanel
            membershipId={exp.membershipId}
            recovery={exp.firstStampRecovery}
          />
        ) : exp.reward === "ready" && exp.rewardId ? (
          <Button asChild size="lg" variant="reward" className="w-full">
            <Link href={`/reward/${exp.rewardId}`}>Open reward QR</Link>
          </Button>
        ) : exp.reward === "waiting" ? (
          <StatusNotice
            title="Give it a day to breathe"
            message={waitingRewardTiming(exp.rewardRedeemableFrom)}
          />
        ) : exp.justStamped ? (
          // Today's stamp is already on the card — confirm it instead of
          // prompting another scan, which would read as a failure.
          <StatusBanner title="Stamp secured." tone="success">
            Your next scan window opens on the next UK business day.
          </StatusBanner>
        ) : (
          <div className="grid gap-3">
            <StatusBanner
              title="Scan the venue code to add your stamp."
              tone="neutral"
            >
              Use the printed QR in the venue. One stamp is available per UK
              business day.
            </StatusBanner>
            <Button asChild size="lg" variant="secondary" className="w-full">
              <Link href="/scan">Scan to stamp</Link>
            </Button>
          </div>
        )}
      </CustomerStampCard>

      {exp.gift ? (
        <CardGiftChip gift={exp.gift} merchantName={exp.merchantName} />
      ) : null}

      {offerPasses.map((pass) => (
        <CardOfferPassChip key={pass.entitlementId} pass={pass} />
      ))}

      {hasVisibleReferralBonusBank(exp.referralBonusBank) ? (
        <ReferralBonusBankNotice bank={exp.referralBonusBank} />
      ) : null}

      {exp.referralShareUrl ? (
        <ReferralSharePanel
          url={exp.referralShareUrl}
          membershipId={exp.membershipId}
          venueName={exp.merchantName}
        />
      ) : null}

      {exp.googleReviewUrl ? (
        <GoogleReviewButton
          url={exp.googleReviewUrl}
          venueName={exp.merchantName}
        />
      ) : null}

      <CardDetailsRow cardNumber={cardNumber(exp.membershipId)} />
    </div>
  )
}

/**
 * A birthday / merchant-sent reward shown as a distinct gift beside the card —
 * on its own rail, never implying the stamp card is complete. Redeemable gifts
 * offer their own QR; a not-yet-open gift shows a calm "ready from" note.
 */
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
    <PromiseChip kind="gift" className="gap-2">
      <div className="flex items-center gap-1.5">
        <Icon icon={GiftIcon} size={16} />
        <span className="mono-id tracking-tag text-ink">{badge}</span>
      </div>
      <p className="text-sm leading-tight font-extrabold break-words">
        {gift.rewardName}
      </p>
      {gift.redeemable ? (
        <Button asChild size="sm" variant="reward" className="w-full">
          <Link href={`/reward/${gift.rewardId}`}>Open gift QR</Link>
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          {gift.redeemableFrom
            ? `Ready ${formatStampDisplayDateFromIso(gift.redeemableFrom)}.`
            : "Ready from the next opening day."}
        </p>
      )}
    </PromiseChip>
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
 * A discount pass shown on its own rail beside the card, never inside the
 * reward panels. The stamp card and the pass are separate promises: a pass can
 * be used again and again while it is in date, so folding it into the reward
 * rail would either imply it is spent after one use or imply the card is
 * further along than it is. The full face and the scannable code live on
 * `/pass/<id>`; this chip is the way in.
 */
function CardOfferPassChip({ pass }: { pass: CustomerOfferPass }) {
  const closes = formatOfferPassDate(pass.validTo)
  const opens = formatOfferPassDate(pass.validFrom)

  return (
    <PromiseChip kind="pass" className="gap-2">
      <div className="flex items-center gap-1.5">
        <Icon icon={DiscountTag01Icon} size={16} />
        <span className="mono-id tracking-tag text-ink">Discount pass</span>
      </div>
      <p className="text-sm leading-tight font-extrabold break-words">
        {pass.discountPercent}% off at {pass.venueName}
      </p>
      {pass.presentable ? (
        <Button asChild size="sm" variant="reward" className="w-full">
          <Link href={`/pass/${pass.entitlementId}`}>Show pass QR</Link>
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          {offerPassChipNote(pass, opens, closes)}
        </p>
      )}
    </PromiseChip>
  )
}

function offerPassChipNote(
  pass: CustomerOfferPass,
  opens: string | null,
  closes: string | null
): string {
  if (pass.state === "not_started") {
    return opens ? `Opens ${opens}.` : "Opens on its start date."
  }
  if (pass.state === "revoked") return "No longer active."
  if (pass.state === "expired") {
    return closes ? `Ran until ${closes}.` : "This pass has finished."
  }
  return pass.unavailableReason ?? "Not available just now."
}

/**
 * Secondary technical details (card number, stamp rule) tucked behind a quiet
 * disclosure so the dashboard reads as a reward, not a contract. Collapsed by
 * default — one calm line until the customer asks for the specifics.
 */
/**
 * Card number and the stamping rule, printed rather than hidden.
 *
 * This was a `<details>` whose entire payload was ONE 20px row, behind an
 * unlabelled 12px trigger at the bottom of a ~1,500px page. A disclosure that
 * conceals 20px is pure interaction cost — and the fact it concealed ("one
 * stamp per UK business day") is the rule members ask about most, so it was
 * exactly the wrong thing to bury. (02#23)
 */
function CardDetailsRow({ cardNumber }: { cardNumber: string }) {
  return (
    <dl className="mono-id flex justify-between gap-3 tracking-tag text-muted-foreground">
      <dt>{cardNumber}</dt>
      <dd>One stamp per UK business day</dd>
    </dl>
  )
}

/**
 * The stamp screen — the live card with the interactive stamp disc. Both
 * `stamp_confirm` (ready to stamp) and `card_stamped_today` (already stamped)
 * render through this one component, so the {@link StampCollector} instance is
 * preserved when the server refreshes from one state to the other after a stamp
 * lands — no panel swap, no flash, the celebration stays put.
 */
function StampScreenPanel({
  exp,
}: {
  exp: Extract<
    CustomerExperience,
    { kind: "stamp_confirm" | "card_stamped_today" }
  >
}) {
  // Once the final stamp has unlocked a (not-yet-redeemable) reward, the screen
  // holds on the completed card and offers a calm tap-through to the reward,
  // rather than swapping straight to the waiting voucher.
  const unlockedReward =
    exp.kind === "card_stamped_today" ? exp.reward : undefined

  return (
    <section className="grid gap-5">
      <StampCollector
        membershipId={exp.membershipId}
        qrId={exp.qrId}
        canStamp={exp.kind === "stamp_confirm"}
        venueName={exp.merchantName}
        cardName={exp.cardName}
        current={exp.current}
        total={exp.total}
        stampDates={exp.stampDates}
        todayLabel={exp.todayLabel}
        rewardName={SEALED_REWARD_NAME}
        rewardUnlocked={Boolean(unlockedReward)}
        location={exp.location}
      />
      {unlockedReward ? (
        <Button asChild size="lg" variant="reward" className="w-full">
          <Link href={`/reward/${unlockedReward.rewardId}`}>
            See your reward
          </Link>
        </Button>
      ) : (
        <Button asChild size="lg" variant="secondary" className="w-full">
          <Link href={`/card/${exp.membershipId}`}>Back to card</Link>
        </Button>
      )}
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

function cardNumber(membershipId: string): string {
  return `CARD Nº ${membershipId.slice(0, 8).toUpperCase()}`
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
