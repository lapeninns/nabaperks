import Link from "next/link"

import { Eyebrow, PageTitle, ReceiptCard } from "@/components/brand"
import { MarketingLayout } from "@/components/layout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  PLATFORM_TERMS_META,
  PLATFORM_TERMS_SECTIONS,
} from "@/lib/legal/content"

export default function TermsPage() {
  return (
    <MarketingLayout>
      <section className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
        <aside className="surface-card p-4 lg:sticky lg:top-24">
          <Eyebrow className="mb-3">On this page</Eyebrow>
          <nav aria-label="Terms sections" className="grid gap-1">
            {PLATFORM_TERMS_SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="inline-flex min-h-11 items-center rounded-full px-3 py-2 text-sm text-muted-foreground underline-offset-4 hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:outline-none"
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
            titleClassName="text-[clamp(2.1rem,4.5vw,3.2rem)]"
            className="md:grid-cols-1"
          />

          <ReceiptCard edge className="grid gap-0">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-xl font-extrabold">
                {PLATFORM_TERMS_META.cardTitle}
              </p>
              <span className="font-mono text-[0.625rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
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

          <Alert className="border-destructive/30 bg-destructive/10">
            <AlertTitle className="text-destructive">
              Review required
            </AlertTitle>
            <AlertDescription>
              These terms are not final legal wording. UK GDPR, PECR,
              promotional marketing, and consumer protection obligations need
              human review before launch.
            </AlertDescription>
          </Alert>

          <Button asChild variant="secondary" className="w-fit">
            <Link href="/privacy">Privacy notice</Link>
          </Button>
        </article>
      </section>
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
    <section
      id={id}
      tabIndex={-1}
      className="w-rule grid scroll-mt-28 gap-2 pt-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/35"
    >
      <p className="font-mono text-[0.7rem] font-bold tracking-[0.08em] text-foreground uppercase">
        {title}
      </p>
      <p className="text-sm leading-6 text-muted-foreground">{body}</p>
    </section>
  )
}
