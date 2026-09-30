import Link from "next/link"

import { CustomerFlowShell } from "@/components/customer/customer-flow-system"
import { JoinActionBar } from "@/components/customer/join-action-bar"
import { JoinOfferJourney } from "@/components/customer/join-offer-journey"
import { JoinOfferReminder } from "@/components/customer/join-offer-reminder"
import { CustomerVenueTermsSheet } from "@/components/customer/legal-sheet"
import { Button } from "@/components/ui/button"
import {
  JOIN_WELCOME_HOW_IT_WORKS,
  JOIN_WELCOME_HOW_IT_WORKS_LABEL,
  JOIN_WELCOME_PHONE_REASSURANCE,
  type CustomerExperienceViewModel,
} from "@/lib/customer/experience/copy"
import type { CustomerExperience } from "@/lib/customer/experience/types"
import type { PendingJoinOffer } from "@/lib/customer/pending-join-offer"
import { buildCustomerJoinHref } from "@/lib/navigation/customer-join-intent"

/**
 * Step 1 of the join wizard. One offer card, one action, and the supporting
 * detail folded away beneath it: the customer at the counter should read the
 * venue, see the stamp journey, and tap once — without scrolling on a 667px
 * phone. "How it works" and the venue terms stay one tap away. A pending
 * offer shows as a small reminder, never a second call to action.
 */
export function WelcomeStep({
  exp,
  vm,
  referralCode,
  pendingOffer,
}: {
  exp: Extract<CustomerExperience, { kind: "join_welcome" }>
  vm: CustomerExperienceViewModel
  referralCode?: string
  pendingOffer?: PendingJoinOffer | null
}) {
  return (
    <CustomerFlowShell
      eyebrow={vm.eyebrow}
      title={vm.headline}
      description={vm.supportLine}
      // No step count yet: it is not known how many steps this guest has.
      progress={{ label: "Your card" }}
      dense
      screenLabel="Customer join"
    >
      {pendingOffer ? (
        <JoinOfferReminder offer={pendingOffer} venueName={exp.merchant.name} />
      ) : null}
      <JoinOfferJourney merchant={exp.merchant} card={exp.card} />
      {vm.primaryAction ? (
        <JoinActionBar note={JOIN_WELCOME_PHONE_REASSURANCE}>
          {/* Always the phone step; only the code step offers a fallback. */}
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
          collectionWindows: exp.card.collectionWindows,
          tradingDayStartsAt: exp.card.tradingDayStartsAt,
          rewardExpiresAfterDays: exp.card.rewardExpiresAfterDays,
          minimumSpendPence: exp.card.minimumSpendPence,
          oneTransactionPerStamp: exp.card.oneTransactionPerStamp,
          rewardPool: exp.card.rewardPool,
        }}
        triggerLabel="View venue terms"
        triggerClassName="focus-ring inline-flex min-h-11 w-fit items-center text-xs font-bold underline underline-offset-4"
      />
    </CustomerFlowShell>
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
      <summary className="focus-ring eyebrow flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-md py-2 text-muted-foreground [&::-webkit-details-marker]:hidden">
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
