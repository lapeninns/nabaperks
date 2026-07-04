"use client"

import { useMemo } from "react"

import { Eyebrow, MonoTag } from "@/components/brand"
import { CustomerStampCard } from "@/components/customer/customer-flow-system"
import { Disclosure } from "@/components/merchant/launch/disclosure"
import {
  stampDisplayDatesEndingToday,
} from "@/lib/customer/uk-calendar"
import {
  clampStampsRequired,
} from "@/lib/merchant/loyalty-card-copy"
import { DEFAULT_STAMPS_REQUIRED } from "@/lib/merchant/customer-readback"
import { formatMerchantVenueLabel } from "@/lib/merchant/venue-label"
import { cn } from "@/lib/utils"
import { SEALED_REWARD_NAME, SEALED_REWARD_NOTE } from "@/lib/copy/product-copy"

type CustomerCardPreviewDraft = {
  cardName: string
  stampsRequired: string
  rewardTerms: string
  isActive: boolean
}

export function CustomerCardPreview({
  merchantName,
  locationName,
  draft,
  activeRewardCount,
  className,
}: {
  merchantName: string
  locationName: string
  draft: CustomerCardPreviewDraft
  activeRewardCount: number
  className?: string
}) {
  const stampsRequired = clampStampsRequired(
    Number.parseInt(draft.stampsRequired, 10) || DEFAULT_STAMPS_REQUIRED
  )
  const earnedCount = Math.min(Math.max(stampsRequired - 1, 0), stampsRequired)
  const stampDates = useMemo(
    () => stampDisplayDatesEndingToday(earnedCount),
    [earnedCount]
  )
  const venueLabel = formatMerchantVenueLabel(merchantName, locationName)
  const cardName = draft.cardName.trim() || "Mystery Visit Card"

  const previewBody = (
    <CustomerCardPreviewBody
      venueLabel={venueLabel}
      cardName={cardName}
      stampsRequired={stampsRequired}
      earnedCount={earnedCount}
      stampDates={stampDates}
      draft={draft}
      activeRewardCount={activeRewardCount}
    />
  )

  return (
    <>
      <div className={cn("min-w-0 lg:hidden", className)}>
        <Disclosure label={`Preview · ${stampsRequired} visits`}>
          {previewBody}
        </Disclosure>
      </div>

      <div
        className={cn(
          "hidden h-fit lg:sticky lg:top-4 lg:block",
          className
        )}
      >
        <div className="grid gap-3">
          <div className="grid gap-1 px-1">
            <Eyebrow>Member preview</Eyebrow>
            <p className="text-sm leading-6 text-pretty text-muted-foreground">
              The live card members see while collecting stamps — updates as
              you edit the form.
            </p>
          </div>
          {previewBody}
        </div>
      </div>
    </>
  )
}

function CustomerCardPreviewBody({
  venueLabel,
  cardName,
  stampsRequired,
  earnedCount,
  stampDates,
  draft,
  activeRewardCount,
}: {
  venueLabel: string
  cardName: string
  stampsRequired: number
  earnedCount: number
  stampDates: string[]
  draft: CustomerCardPreviewDraft
  activeRewardCount: number
}) {
  return (
    <div className="grid min-w-0 gap-3 overflow-x-clip">
      {!draft.isActive ? (
        <p className="rounded-lg border border-dashed border-border bg-secondary/60 px-3 py-2 text-sm leading-6 text-pretty text-muted-foreground">
          Your card is inactive. Members cannot collect new stamps until you
          turn it back on.
        </p>
      ) : null}

      <CustomerStampCard
        venueName={venueLabel}
        cardName={cardName}
        current={earnedCount}
        total={stampsRequired}
        stampDates={stampDates}
        wrapStamps
        compact
        reward={{
          state: "sealed",
          name: SEALED_REWARD_NAME,
          description: SEALED_REWARD_NOTE,
        }}
        hideFooter
      />

      <aside
        aria-label="Merchant launch status"
        className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border bg-secondary/40 px-3 py-2.5 sm:grid sm:gap-2 sm:py-3"
      >
        <Eyebrow className="w-full sm:w-auto">For you only</Eyebrow>
        <MonoTag tone={draft.isActive ? "leaf" : "plain"}>
          {draft.isActive
            ? "Active — accepting stamps"
            : "Inactive — no new stamps"}
        </MonoTag>
        <p className="w-full text-xs leading-5 text-pretty text-muted-foreground">
          {activeRewardCount} active pool reward
          {activeRewardCount === 1 ? "" : "s"}. Need 3 before launch.
        </p>
      </aside>
    </div>
  )
}
