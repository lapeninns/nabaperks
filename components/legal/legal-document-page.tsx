import Link from "next/link"

import { Eyebrow, PageTitle, ReceiptCard } from "@/components/brand"
import { MarketingLayout, Section } from "@/components/layout"
import { Button } from "@/components/ui/button"
import type { LegalSection } from "@/lib/legal/content"

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
        className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start"
      >
        <aside className="surface-card order-last p-4 lg:sticky lg:top-20 lg:order-none">
          <Eyebrow className="mb-3">On this page</Eyebrow>
          <nav aria-label={`${meta.cardTitle} sections`} className="grid gap-1">
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
        </aside>

        <article className="grid gap-6">
          <PageTitle
            eyebrow={meta.eyebrow}
            title={meta.title}
            description={meta.description}
            titleClassName="text-[clamp(2.1rem,4.5vw,3.2rem)]"
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
                className="w-rule focus-ring grid scroll-mt-28 gap-2 pt-4"
              >
                <h2 className="mono-meta tracking-tag text-foreground">
                  {section.title}
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  {section.body}
                </p>
              </section>
            ))}
          </ReceiptCard>

          <div className="flex flex-wrap gap-3">
            {relatedLinks.map((link) => (
              <Button key={link.href} asChild variant="secondary">
                <Link href={link.href}>{link.label}</Link>
              </Button>
            ))}
          </div>
        </article>
      </Section>
    </MarketingLayout>
  )
}
