import Link from "next/link"

import { CustomerFlowShell } from "@/components/customer/customer-flow-system"
import {
  StampCollector,
  type StampCollectorProps,
} from "@/components/customer/stamp-collector"
import {
  StampOutcomeProvider,
  StampScreenCardLink,
  StampScreenHeadline,
  StampScreenSupport,
} from "@/components/customer/stamp-screen-outcome"
import { Button } from "@/components/ui/button"
import { SEALED_REWARD_NAME } from "@/lib/copy/product-copy"
import type { CustomerExperienceViewModel } from "@/lib/customer/experience/copy"
import type { CustomerExperience } from "@/lib/customer/experience/types"

export type StampScreenExperience = Extract<
  CustomerExperience,
  { kind: "stamp_confirm" | "card_stamped_today" }
>

/**
 * The DB-free harness swaps the server actions and links; production passes
 * none of these and gets the real actions and routes.
 */
export type StampScreenOverrides = Pick<
  StampCollectorProps,
  "submitStamp" | "submitVenueCode" | "refreshCard"
> & {
  cardHref?: string
  rewardHref?: string
}

/**
 * The stamp screen (brief S1 to S5): the shell's headline and support line,
 * the live card with the stamp press, and one way back to the card. When a
 * stamp lands on this visit the result owns the screen: the headline becomes
 * "Stamp added." with what is left to the reward, "View my card" becomes the
 * primary action, and nothing else (no contact or profile prompt) is shown.
 */
export function StampScreen({
  exp,
  vm,
  overrides = {},
}: {
  exp: StampScreenExperience
  vm: CustomerExperienceViewModel
  overrides?: StampScreenOverrides
}) {
  return (
    <StampOutcomeProvider>
      <CustomerFlowShell
        eyebrow={vm.eyebrow}
        title={<StampScreenHeadline initial={vm.headline} />}
        description={<StampScreenSupport initial={vm.supportLine} />}
        className="pb-28"
        // The band beneath the card states what to do in its own words, so
        // the screen opts into the landscape floor.
        landscapeCompact
        screenLabel="Customer stamp"
      >
        <StampScreenPanel exp={exp} overrides={overrides} />
      </CustomerFlowShell>
    </StampOutcomeProvider>
  )
}

/**
 * Both `stamp_confirm` (ready to stamp) and `card_stamped_today` (already
 * stamped) render through this one component, so the {@link StampCollector}
 * instance is preserved when the server refreshes from one state to the
 * other after a stamp lands: no panel swap, no flash, the result stays put.
 */
function StampScreenPanel({
  exp,
  overrides,
}: {
  exp: StampScreenExperience
  overrides: StampScreenOverrides
}) {
  // Once the final stamp has unlocked a (not-yet-redeemable) reward, the screen
  // holds on the completed card and offers the reward, rather than swapping
  // straight to the waiting voucher.
  const unlockedReward =
    exp.kind === "card_stamped_today" ? exp.reward : undefined

  return (
    <section className="grid gap-5 short:gap-4">
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
        nextStampFrom={exp.nextStampFrom ?? null}
        submitStamp={overrides.submitStamp}
        submitVenueCode={overrides.submitVenueCode}
        refreshCard={overrides.refreshCard}
      />
      {unlockedReward ? (
        <Button asChild size="lg" variant="reward" className="w-full">
          <Link
            href={overrides.rewardHref ?? `/reward/${unlockedReward.rewardId}`}
          >
            See my reward
          </Link>
        </Button>
      ) : (
        <StampScreenCardLink
          href={overrides.cardHref ?? `/card/${exp.membershipId}`}
          primary={exp.kind === "card_stamped_today"}
        />
      )}
    </section>
  )
}
