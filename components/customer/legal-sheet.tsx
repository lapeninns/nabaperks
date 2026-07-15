"use client"

import type { MouseEvent, ReactNode } from "react"

import { ReceiptCard } from "@/components/brand"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  buildVenueTermsSections,
  PRIVACY_META,
  PRIVACY_SECTIONS,
  PLATFORM_TERMS_META,
  PLATFORM_TERMS_SECTIONS,
  venueTermsMeta,
  type LegalSection,
  type VenueTermsInput,
} from "@/lib/legal/content"
import { cn } from "@/lib/utils"

type CustomerLegalSheetProps = {
  triggerLabel: ReactNode
  title: string
  description?: string
  sections: LegalSection[]
  cardTitle?: string
  docNumber?: string
  triggerClassName?: string
  onTriggerClick?: (event: MouseEvent<HTMLButtonElement>) => void
}

export function CustomerLegalSheet({
  triggerLabel,
  title,
  description,
  sections,
  cardTitle,
  docNumber,
  triggerClassName,
  onTriggerClick,
}: CustomerLegalSheetProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className={cn("underline underline-offset-4", triggerClassName)}
          onClick={onTriggerClick}
        >
          {triggerLabel}
        </button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[min(85vh,640px)] gap-0 rounded-t-[18px] border-t-2 border-ink p-0"
      >
        <SheetHeader className="shrink-0 border-b border-ink/10 px-6 pt-6 pb-4 text-left">
          <SheetTitle className="font-heading text-xl leading-tight">
            {title}
          </SheetTitle>
          {description ? (
            <SheetDescription className="text-sm leading-6">
              {description}
            </SheetDescription>
          ) : null}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="grid gap-4">
            <ReceiptCard edge className="grid gap-0">
              {cardTitle ? (
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-xl font-extrabold">{cardTitle}</p>
                  {docNumber ? (
                    <span className="mono-id tracking-[0.08em] text-muted-foreground">
                      Nº {docNumber}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {sections.map((section) => (
                <LegalSectionBlock key={section.id} section={section} />
              ))}
            </ReceiptCard>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function LegalSectionBlock({ section }: { section: LegalSection }) {
  return (
    <section className="w-rule grid scroll-mt-28 gap-2 pt-4 outline-none">
      <p className="mono-meta tracking-[0.08em] text-foreground">
        {section.title}
      </p>
      <p className="text-sm leading-6 text-muted-foreground">{section.body}</p>
    </section>
  )
}

function stopCheckboxToggle(event: MouseEvent<HTMLButtonElement>) {
  event.stopPropagation()
}

export function CustomerVenueTermsSheet({
  venueTerms,
  triggerLabel,
  triggerClassName,
}: {
  venueTerms: VenueTermsInput
  triggerLabel: ReactNode
  triggerClassName?: string
}) {
  const meta = venueTermsMeta(venueTerms.merchantName)

  return (
    <CustomerLegalSheet
      triggerLabel={triggerLabel}
      triggerClassName={triggerClassName}
      onTriggerClick={stopCheckboxToggle}
      title={meta.title}
      description={meta.description}
      sections={buildVenueTermsSections(venueTerms)}
      cardTitle={meta.cardTitle}
    />
  )
}

export function CustomerPlatformTermsSheet({
  triggerLabel = "Nabaperks customer terms",
  triggerClassName,
}: {
  triggerLabel?: ReactNode
  triggerClassName?: string
}) {
  return (
    <CustomerLegalSheet
      triggerLabel={triggerLabel}
      triggerClassName={triggerClassName}
      onTriggerClick={stopCheckboxToggle}
      title={PLATFORM_TERMS_META.title}
      description={PLATFORM_TERMS_META.description}
      sections={PLATFORM_TERMS_SECTIONS}
      cardTitle={PLATFORM_TERMS_META.cardTitle}
      docNumber={PLATFORM_TERMS_META.docNumber}
    />
  )
}

export function CustomerPrivacySheet({
  triggerLabel = "privacy notice",
  triggerClassName,
}: {
  triggerLabel?: ReactNode
  triggerClassName?: string
}) {
  return (
    <CustomerLegalSheet
      triggerLabel={triggerLabel}
      triggerClassName={triggerClassName}
      onTriggerClick={stopCheckboxToggle}
      title={PRIVACY_META.title}
      description={PRIVACY_META.description}
      sections={PRIVACY_SECTIONS}
      cardTitle={PRIVACY_META.cardTitle}
      docNumber={PRIVACY_META.docNumber}
    />
  )
}

export function CustomerLegalConsentLinks({
  venueTerms,
}: {
  venueTerms: VenueTermsInput
}) {
  return (
    <>
      I agree to the{" "}
      <CustomerVenueTermsSheet
        venueTerms={venueTerms}
        triggerLabel="venue terms"
      />{" "}
      and <CustomerPlatformTermsSheet />
      . I have read the <CustomerPrivacySheet />.
    </>
  )
}
