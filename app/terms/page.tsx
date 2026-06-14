import Link from "next/link"

import { Eyebrow, PageTitle, ReceiptCard } from "@/components/brand"
import { MarketingLayout } from "@/components/layout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

const sections = [
  {
    id: "participation",
    title: "Participation",
    body: "Customers may join a merchant loyalty card after verifying their phone number and accepting the loyalty terms. The card is browser-based and does not require a downloaded app or physical plastic card.",
  },
  {
    id: "merchant-reward-terms",
    title: "Merchant-controlled reward terms",
    body: "Each merchant controls its reward description, earning rules, minimum spend, exclusions, and venue-specific participation terms. Merchant reward terms are shown before joining and on the merchant terms page.",
  },
  {
    id: "marketing",
    title: "Optional marketing opt-in",
    body: "Marketing opt-in is optional and separate from loyalty participation. Declining marketing does not stop a customer collecting stamps, seeing progress, or redeeming earned rewards.",
  },
  {
    id: "abuse",
    title: "Abuse and fraud prevention",
    body: "Nabaperks and merchants may investigate suspicious activity, duplicate claims, QR misuse, manual adjustments, soft geofence anomalies, or fraud signals. One stamp can be issued per customer per UK business day, and audited support actions preserve event history rather than deleting earned history silently.",
  },
  {
    id: "availability",
    title: "Availability restrictions",
    body: "The MVP may restrict new joins, stamps, QR scans, or redemptions when a merchant loyalty card is inactive, QR access is disabled, a reward is not yet redeemable, or billing is suspended.",
  },
]

export default function TermsPage() {
  return (
    <MarketingLayout>
      <section className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
        <aside className="surface-card p-4 lg:sticky lg:top-24">
          <Eyebrow className="mb-3">On this page</Eyebrow>
          <nav aria-label="Terms sections" className="grid gap-1">
            {sections.map((section) => (
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
            eyebrow="Plain English summary · not the full legal text"
            title="The small print, kept legible."
            description="Pilot terms for no-app QR loyalty participation, structured for readability. The full text travels with your merchant agreement and requires legal review before launch."
            titleClassName="text-[clamp(2.1rem,4.5vw,3.2rem)]"
            className="md:grid-cols-1"
          />

          <ReceiptCard edge className="grid gap-0">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-xl font-extrabold">Terms, condensed</p>
              <span className="font-mono text-[0.625rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                Nº T-2026
              </span>
            </div>
            {sections.map((section) => (
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
