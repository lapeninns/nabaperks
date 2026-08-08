import type { Metadata } from "next"

import { Eyebrow, PageTitle, ReceiptCard } from "@/components/brand"
import { MarketingLayout, Section } from "@/components/layout"
import { LegalRelatedLinks } from "@/components/legal/legal-related-links"
import {
  PLATFORM_TERMS_META,
  PLATFORM_TERMS_SECTIONS,
} from "@/lib/legal/content"
import { OG_IMAGE } from "@/lib/seo/structured-data"

const title = "Terms"
const description = PLATFORM_TERMS_META.description

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/terms" },
  openGraph: {
    title: `${title} | Nabaperks`,
    description,
    type: "website",
    siteName: "Nabaperks",
    url: "/terms",
    locale: "en_GB",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: `${title} | Nabaperks`,
    description,
    images: [OG_IMAGE],
  },
}

export default function TermsPage() {
  return (
    <MarketingLayout>
      <Section
        as="div"
        data-legal-document
        className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start"
      >
        <aside className="surface-card order-last p-4 lg:sticky lg:top-20 lg:order-none">
          <Eyebrow className="mb-3">On this page</Eyebrow>
          <nav aria-label="Terms sections" className="grid gap-1">
            {PLATFORM_TERMS_SECTIONS.map((section) => (
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
            eyebrow={PLATFORM_TERMS_META.eyebrow}
            title={PLATFORM_TERMS_META.title}
            description={PLATFORM_TERMS_META.description}
            className="md:grid-cols-1"
          />

          <ReceiptCard edge className="grid gap-0">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-xl font-extrabold">
                {PLATFORM_TERMS_META.cardTitle}
              </p>
              <span className="mono-id tracking-tag text-muted-foreground">
                Nº {PLATFORM_TERMS_META.docNumber}
              </span>
            </div>
            {PLATFORM_TERMS_SECTIONS.map((section) => (
              <TermsBlock
                key={section.id}
                id={section.id}
                title={section.title}
                body={section.body}
              />
            ))}
          </ReceiptCard>

          <div data-legal-related>
            <LegalRelatedLinks
              links={[
                { href: "/privacy", label: "Privacy notice" },
                { href: "/cookies", label: "Cookie notice" },
              ]}
            />
          </div>
        </article>
      </Section>
    </MarketingLayout>
  )
}

function TermsBlock({
  id,
  title,
  body,
}: {
  id: string
  title: string
  body: string
}) {
  return (
    // Same readability contract as LegalDocumentPage (01#64/65/66): a clause
    // heading that outranks its clause, body at 16px capped to a 68ch measure
    // on the foreground colour, and an explicit dashed rule instead of
    // .w-rule's injected margins. No clause wording is changed.
    <section
      id={id}
      tabIndex={-1}
      className="focus-target grid scroll-mt-28 gap-2 border-t-2 border-dashed border-border pt-5 first:border-t-0 first:pt-0"
    >
      <h2 className="mono-meta tracking-tag text-foreground">{title}</h2>
      <p className="max-w-[68ch] text-base leading-7 text-foreground">{body}</p>
    </section>
  )
}
