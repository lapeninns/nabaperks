import { Eyebrow, PageTitle, ReceiptCard } from "@/components/brand"
import {
  MARKETING_ANCHOR_OFFSET,
  MarketingLayout,
  Section,
} from "@/components/layout"
import { LegalRelatedLinks } from "./legal-related-links"
import type { LegalSection } from "@/lib/legal/content"
import { cn } from "@/lib/utils"

type LegalDocumentMeta = {
  readonly eyebrow: string
  readonly title: string
  readonly description: string
  readonly cardTitle: string
  readonly docNumber: string
}

type RelatedLink = {
  readonly href: string
  readonly label: string
}

export function LegalDocumentPage({
  meta,
  sections,
  relatedLinks,
}: {
  readonly meta: LegalDocumentMeta
  readonly sections: readonly LegalSection[]
  readonly relatedLinks: readonly RelatedLink[]
}) {
  return (
    <MarketingLayout>
      <Section
        as="div"
        data-legal-document
        className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start"
      >
        {/* 01#63 asks for the TOC above the prose on mobile. NOT applied:
            tests/contracts/legal-p3-polish:28 requires the /terms and /privacy
            TOC to sit AFTER the article below lg so the h1 stays above the
            fold, and shipping two different orders across five interlinked
            legal pages is worse than one debatable order. The assertion's goal
            is met — measured at 390x844 on a production build, the h1 sits at
            top 171-186px on all five legal routes.

            CORRECTION: this comment used to claim the disclosure below "costs
            a row instead of a block wherever it sits". It does not. It ships
            `open`, so the aside measures 568px (/data-processing), 580px
            (/cookies) and 664px (/merchant-terms) at 390px — the same block as
            /terms (539px) and /privacy (647px), which carry no disclosure at
            all. On /privacy that block begins at top 6,880px of an 8,087px
            page. Collapsing it below lg while keeping the desktop rail open
            needs either JS or the reorder this contract forbids, so it is
            recorded in NEEDS-SIGNOFF 22 rather than guessed at here. */}
        <aside className="surface-card order-last p-4 lg:sticky lg:top-[calc(var(--marketing-header-h)+0.75rem)] lg:order-none">
          <details open className="group">
            <summary className="focus-ring mb-3 flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-full lg:pointer-events-none">
              <Eyebrow>On this page</Eyebrow>
              <span
                aria-hidden="true"
                className="text-muted-foreground group-open:rotate-180 lg:hidden"
              >
                ▾
              </span>
            </summary>
            <nav
              aria-label={`${meta.cardTitle} sections`}
              className="grid gap-1"
            >
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="focus-ring inline-flex min-h-11 items-center rounded-full px-3 py-2 text-sm text-muted-foreground underline-offset-4 hover:bg-accent hover:text-accent-foreground"
                >
                  {section.title}
                </a>
              ))}
            </nav>
          </details>
        </aside>

        <article className="grid gap-6">
          <PageTitle
            eyebrow={meta.eyebrow}
            title={meta.title}
            description={meta.description}
            className="md:grid-cols-1"
          />

          <ReceiptCard edge className="grid gap-0">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-xl font-extrabold">{meta.cardTitle}</p>
              <span className="mono-id tracking-tag text-muted-foreground">
                Nº {meta.docNumber}
              </span>
            </div>
            {sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                tabIndex={-1}
                // 01#66: `.w-rule` injects its own margins, which fought the
                // parent's spacing. An explicit dashed top border on all but the
                // first clause is the same rule with predictable rhythm.
                className={cn(
                  MARKETING_ANCHOR_OFFSET,
                  "focus-target grid gap-2 border-t-2 border-dashed border-border pt-5 first:border-t-0 first:pt-0"
                )}
              >
                {/* 01#65 asks for a larger clause heading. NOT applied:
                    tests/contracts/legal-heading-structure pins
                    `<h2 className="mono-meta` on /terms and /privacy as a
                    deliberate decision, and shipping two different legal
                    heading treatments would be worse than one wrong one.
                    Recorded for renegotiation instead. */}
                <h2 className="mono-meta tracking-tag text-foreground">
                  {section.title}
                </h2>
                {/* 01#64 (Critical): 14px muted text in an ~840px column runs at
                    ~125 characters per line. Capped at 68ch and raised to 16px
                    on the foreground colour — legal body text is not secondary
                    content. No clause wording changed. */}
                <p className="max-w-[68ch] text-base leading-7 text-foreground">
                  {section.body}
                </p>
              </section>
            ))}
          </ReceiptCard>

          <div data-legal-related>
            <LegalRelatedLinks links={relatedLinks} />
          </div>
        </article>
      </Section>
    </MarketingLayout>
  )
}
