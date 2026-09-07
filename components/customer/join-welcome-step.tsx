import Link from "next/link"

import { VenueMark } from "@/components/brand"
import { CustomerFlowShell } from "@/components/customer/customer-flow-system"
import { JoinActionBar } from "@/components/customer/join-action-bar"
import { CustomerVenueTermsSheet } from "@/components/customer/legal-sheet"
import { RewardSeal, StampGrid } from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import {
  JOIN_WELCOME_HOW_IT_WORKS,
  JOIN_WELCOME_HOW_IT_WORKS_LABEL,
  JOIN_WELCOME_PHONE_REASSURANCE,
  joinUnlockingRewardHook,
  type CustomerExperienceViewModel,
} from "@/lib/customer/experience/copy"
import type {
  CustomerExperience,
  JoinCard,
  JoinMerchant,
} from "@/lib/customer/experience/types"
import { buildCustomerJoinHref } from "@/lib/navigation/customer-join-intent"

const ONBOARDING_STEPS = 3

/**
 * Step 1 of the join wizard. One offer card, one action, and the supporting
 * detail folded away beneath it: the customer at the counter should read the
 * venue, see the stamp journey, and tap once — without scrolling on a 667px
 * phone. "How it works" and the venue terms stay one tap away.
 */
export function WelcomeStep({
  exp,
  vm,
  referralCode,
}: {
  exp: Extract<CustomerExperience, { kind: "join_welcome" }>
  vm: CustomerExperienceViewModel
  referralCode?: string
}) {
  return (
    <CustomerFlowShell
      eyebrow={vm.eyebrow}
      title={vm.headline}
      description={vm.supportLine}
      progress={{ step: 1, total: ONBOARDING_STEPS, label: "Keep your card" }}
      dense
      screenLabel="Customer join"
    >
      <JoinOfferCard merchant={exp.merchant} card={exp.card} />
      {vm.primaryAction ? (
        <JoinActionBar note={JOIN_WELCOME_PHONE_REASSURANCE}>
          <Button asChild size="lg" className="w-full">
            <Link
              href={buildCustomerJoinHref(exp.merchant.slug, {
                qrId: exp.qrId,
                referralCode,
                step: "phone",
              })}
            >
              {vm.primaryAction.label}
            </Link>
          </Button>
        </JoinActionBar>
      ) : null}
      <HowItWorksList />
      <CustomerVenueTermsSheet
        venueTerms={{
          merchantName: exp.merchant.name,
          stampsRequired: exp.card.stampsRequired,
          rewardTerms: exp.card.rewardTerms,
        }}
        triggerLabel="View full venue terms"
        triggerClassName="inline-flex w-fit text-xs font-bold underline underline-offset-4"
      />
    </CustomerFlowShell>
  )
}

/**
 * The offer in one compact card: venue mark, card name, the stamp journey as
 * a single row with the sealed reward at its end, and the reward hook as one
 * line. The full receipt (headline, ticket, footer) belongs to the card the
 * customer owns after joining, not to the pitch.
 */
function JoinOfferCard({
  merchant,
  card,
}: {
  merchant: JoinMerchant
  card: JoinCard
}) {
  return (
    <div className="surface-card grid gap-3 p-3 text-left sm:p-4">
      <div className="flex items-center gap-3">
        <VenueMark size={44} name={merchant.name} className="shrink-0" />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <span className="eyebrow text-muted-foreground">{merchant.name}</span>
          <span className="line-clamp-2 text-base leading-tight font-extrabold break-words">
            {card.name}
          </span>
        </div>
        <RewardSeal state="sealed" size="sm" wiggle className="shrink-0" />
      </div>
      <StampGrid
        current={0}
        total={card.stampsRequired}
        showEmptySlotNumbers
        rewardSlot="locked"
        venueName={merchant.name}
        compact
      />
      <p className="text-sm leading-snug text-muted-foreground">
        {joinUnlockingRewardHook(card.stampsRequired)}, yours from the next UK
        business day.
      </p>
    </div>
  )
}

/**
 * Folded by default: the three steps are reassurance, not a decision, so they
 * sit one tap away instead of pushing the action down. Native disclosure — no
 * script, no hydration, open state survives a reload.
 */
function HowItWorksList() {
  return (
    <details className="group grid gap-2 text-left">
      <summary className="focus-ring eyebrow flex cursor-pointer list-none items-center justify-between gap-3 rounded-md py-1 text-muted-foreground [&::-webkit-details-marker]:hidden">
        <span>{JOIN_WELCOME_HOW_IT_WORKS_LABEL}</span>
        <span
          aria-hidden="true"
          className="text-base leading-none transition-transform duration-[var(--w-dur-fast)] ease-[var(--w-ease)] group-open:rotate-45 motion-reduce:transition-none"
        >
          +
        </span>
      </summary>
      <ol className="grid gap-2 pb-1">
        {JOIN_WELCOME_HOW_IT_WORKS.map((step, index) => (
          <li key={step} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 grid size-5 shrink-0 -rotate-6 place-items-center rounded-full border-2 border-ink bg-primary text-[0.7rem] leading-none font-extrabold text-primary-foreground"
            >
              {index + 1}
            </span>
            <span className="text-sm leading-snug font-medium">{step}</span>
          </li>
        ))}
      </ol>
    </details>
  )
}
