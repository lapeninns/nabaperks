import Link from "next/link"

import {
  CustomerFlowShell,
  CustomerReceipt,
} from "@/components/customer/customer-flow-system"
import { CustomerVenueTermsSheet } from "@/components/customer/legal-sheet"
import { RewardTicket, StampJourneyPreview } from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import {
  JOIN_WELCOME_ALREADY_HAVE_CARD_LABEL,
  JOIN_WELCOME_HOW_IT_WORKS,
  JOIN_WELCOME_HOW_IT_WORKS_LABEL,
  joinWelcomeHref,
  type CustomerExperienceViewModel,
} from "@/lib/customer/experience/copy"
import type {
  CustomerExperience,
  JoinCard,
  JoinMerchant,
} from "@/lib/customer/experience/types"

const ONBOARDING_STEPS = 3

export function WelcomeStep({
  exp,
  vm,
}: {
  exp: Extract<CustomerExperience, { kind: "join_welcome" }>
  vm: CustomerExperienceViewModel
}) {
  return (
    <CustomerFlowShell
      eyebrow={vm.eyebrow}
      title={vm.headline}
      description={vm.supportLine}
      progress={{ step: 1, total: ONBOARDING_STEPS, label: "Join the card" }}
      dense
      className="content-center"
      screenLabel="Customer join"
    >
      <JoinWelcomeCard merchant={exp.merchant} card={exp.card} />
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
      {vm.primaryAction ? (
        <div className="grid gap-2">
          <Button asChild size="lg" className="w-full">
            <Link href={vm.primaryAction.href}>{vm.primaryAction.label}</Link>
          </Button>
          <Link
            href={joinWelcomeHref(exp.merchant.slug, exp.qrId, "phone")}
            className="text-center text-xs font-bold underline underline-offset-4"
          >
            {JOIN_WELCOME_ALREADY_HAVE_CARD_LABEL}
          </Link>
        </div>
      ) : null}
    </CustomerFlowShell>
  )
}

function JoinWelcomeCard({
  merchant,
  card,
}: {
  merchant: JoinMerchant
  card: JoinCard
}) {
  return (
    <CustomerReceipt
      venueName={merchant.name}
      title={card.name}
      eyebrow={merchant.name}
      hideFooter
    >
      <StampJourneyPreview
        total={card.stampsRequired}
        venueName={merchant.name}
        className="py-1"
      />
      <RewardTicket
        state="sealed"
        name="Mystery reward, sealed"
        description={
          <>
            Collect {card.stampsRequired} stamps to unlock a surprise reward,
            yours from the next UK business day.
            {card.minSpendPence !== null ? (
              <> Minimum spend {formatPence(card.minSpendPence)}.</>
            ) : null}
          </>
        }
      />
    </CustomerReceipt>
  )
}

function HowItWorksList() {
  return (
    <section className="grid gap-2 text-left">
      <p className="eyebrow text-muted-foreground">
        {JOIN_WELCOME_HOW_IT_WORKS_LABEL}
      </p>
      <ol className="grid gap-2">
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
    </section>
  )
}

function formatPence(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100)
}
