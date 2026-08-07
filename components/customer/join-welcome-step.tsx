import Link from "next/link"

import { IconRoundel } from "@/components/brand"
import {
  CustomerFlowShell,
  CustomerReceipt,
} from "@/components/customer/customer-flow-system"
import { CustomerVenueTermsSheet } from "@/components/customer/legal-sheet"
import { RewardTicket, StampJourneyPreview } from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import { MYSTERY_REWARD_SEALED_LABEL } from "@/lib/copy/product-copy"
import {
  JOIN_WELCOME_HOW_IT_WORKS,
  JOIN_WELCOME_HOW_IT_WORKS_LABEL,
  JOIN_WELCOME_PHONE_REASSURANCE,
  type CustomerExperienceViewModel,
} from "@/lib/customer/experience/copy"
import type {
  CustomerExperience,
  JoinCard,
  JoinMerchant,
} from "@/lib/customer/experience/types"
import { buildCustomerJoinHref } from "@/lib/navigation/customer-join-intent"

const ONBOARDING_STEPS = 3

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
      className="content-center gap-3"
      screenLabel="Customer join"
    >
      <JoinWelcomeCard merchant={exp.merchant} card={exp.card} />
      {vm.primaryAction ? (
        <div className="grid gap-2">
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
          <p className="text-center text-xs leading-5 font-semibold text-muted-foreground">
            {JOIN_WELCOME_PHONE_REASSURANCE}
          </p>
        </div>
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
        name={MYSTERY_REWARD_SEALED_LABEL}
        description={
          <>
            Collect {card.stampsRequired} stamps to unlock a surprise reward,
            yours from the next UK business day.
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
      {/* IconRoundel is the sanctioned framing circle (DESIGN.md · Shapes), and
          HomeEmptyState already numbers the identical how-it-works list with
          it. The hand-rolled 20px disc was a fourth circle dialect at a fifth
          unsanctioned micro size (text-[0.7rem]), and its -rotate-6 borrowed
          the stamp/reward tilt for a step number that cannot be earned
          (CUS 02#56). */}
      <ol className="grid gap-2">
        {JOIN_WELCOME_HOW_IT_WORKS.map((step, index) => (
          <li
            key={step}
            className="grid grid-cols-[2rem_1fr] items-start gap-3"
          >
            <IconRoundel
              size="sm"
              tone="primary"
              className="font-mono text-xs font-extrabold"
            >
              {index + 1}
            </IconRoundel>
            <span className="text-sm leading-snug font-medium">{step}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
