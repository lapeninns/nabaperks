import type { Metadata } from "next"
import Link from "next/link"

import { Eyebrow, PageTitle, ReceiptCard } from "@/components/brand"
import { MarketingLayout, Section } from "@/components/layout"
import { LegalRelatedLinks } from "@/components/legal/legal-related-links"
import { LEGAL_CONTACT } from "@/lib/marketing/facts"
import { PRIVACY_META, PRIVACY_SECTIONS } from "@/lib/legal/content"
import { OG_IMAGE } from "@/lib/seo/structured-data"

const title = "Privacy"
const description = PRIVACY_META.description

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: `${title} | Nabaperks`,
    description,
    type: "website",
    siteName: "Nabaperks",
    url: "/privacy",
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

const externalLinkClass =
  "focus-ring font-bold underline underline-offset-4 hover:text-primary"

export default function PrivacyPage() {
  return (
    <MarketingLayout>
      <Section
        as="div"
        data-legal-document
        className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start"
      >
        <aside className="surface-card order-last p-4 lg:sticky lg:top-20 lg:order-none">
          <Eyebrow className="mb-3">On this page</Eyebrow>
          <nav aria-label="Privacy sections" className="grid gap-1">
            {PRIVACY_SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="focus-ring inline-flex min-h-11 items-center rounded-(--radius-md) px-3 py-2 text-sm text-muted-foreground underline-offset-4 hover:bg-accent hover:text-accent-foreground"
              >
                {section.title}
              </a>
            ))}
          </nav>
        </aside>

        <article className="grid gap-6">
          <PageTitle
            eyebrow={PRIVACY_META.eyebrow}
            title={PRIVACY_META.title}
            description={PRIVACY_META.description}
            className="md:grid-cols-1"
          />

          <div className="surface-card grid gap-2 p-5">
            <Eyebrow>If you&apos;re a customer</Eyebrow>
            <p className="text-sm leading-6 text-muted-foreground">
              Joining a venue&apos;s loyalty card stores your verified phone
              identity, membership, stamps, rewards, accepted venue terms, and
              consent choices. Marketing is optional and separate from
              collecting stamps. You can ask for privacy, access, export,
              deletion, or consent support using the contact details below.
            </p>
          </div>

          <ReceiptCard edge className="grid gap-0">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-xl font-extrabold">{PRIVACY_META.cardTitle}</p>
              <span className="mono-id tracking-tag text-muted-foreground">
                Nº {PRIVACY_META.docNumber}
              </span>
            </div>
            {PRIVACY_SECTIONS.map((section) => (
              <PolicyBlock
                key={section.id}
                id={section.id}
                title={section.title}
                body={section.body}
              />
            ))}
          </ReceiptCard>

          <div className="surface-card grid gap-2 p-5">
            <Eyebrow>Legal and privacy contact</Eyebrow>
            <p className="text-sm leading-6 text-muted-foreground">
              The current legal and privacy contact for Nabaperks is{" "}
              <strong className="font-bold text-foreground">
                {LEGAL_CONTACT.name}
              </strong>
              . For privacy, access, export, deletion, or consent requests,
              contact{" "}
              <a
                href={`mailto:${LEGAL_CONTACT.privacyEmail}`}
                className={externalLinkClass}
              >
                {LEGAL_CONTACT.privacyEmail}
              </a>
              .
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              See the{" "}
              <Link href="/cookies" className={externalLinkClass}>
                cookie and browser-storage notice
              </Link>{" "}
              for the current browser data used by the service, or the{" "}
              <Link href="/data-processing" className={externalLinkClass}>
                merchant data-processing schedule
              </Link>{" "}
              for the technical processing map.
            </p>
          </div>

          <div data-legal-related>
            <LegalRelatedLinks
              links={[{ href: "/terms", label: "Platform terms" }]}
            />
          </div>
        </article>
      </Section>
    </MarketingLayout>
  )
}

function PolicyBlock({
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
