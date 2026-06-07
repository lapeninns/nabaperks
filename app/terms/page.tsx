import Link from "next/link"

import { PageTitle } from "@/components/brand"
import { MarketingLayout } from "@/components/layout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

const sections = [
  {
    id: "participation",
    title: "Participation",
    body: "Customers may join a merchant loyalty card after verifying their email address or phone number and accepting the loyalty terms. The card is browser-based and does not require a downloaded app or physical plastic card.",
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
    body: "Stampiee and merchants may investigate suspicious activity, incorrect staff PIN use, duplicate claims, QR misuse, manual adjustments, or fraud signals. Audited support actions preserve event history rather than deleting earned history silently.",
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
        <aside className="rounded-3xl border bg-card p-4 shadow-xs lg:sticky lg:top-24">
          <p className="mb-3 text-sm font-extrabold">On this page</p>
          <nav aria-label="Terms sections" className="grid gap-2">
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="rounded-full px-3 py-2 text-sm text-muted-foreground underline-offset-4 hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:outline-none"
              >
                {section.title}
              </a>
            ))}
          </nav>
        </aside>

        <article className="grid gap-6">
          <PageTitle
            eyebrow="Platform terms"
            title="Stampiee MVP terms"
            description="Basic pilot terms for no-app QR loyalty participation. They are structured for readability and require legal review before launch."
            titleClassName="text-4xl sm:text-5xl"
          />

          <section className="grid gap-4 rounded-[2rem] border bg-card p-6 shadow-xs">
            {sections.map((section) => (
              <TermsBlock
                key={section.id}
                id={section.id}
                title={section.title}
                body={section.body}
              />
            ))}
          </section>

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
      className="scroll-mt-28 grid gap-2 border-b pb-4 outline-none last:border-b-0 last:pb-0 focus-visible:ring-3 focus-visible:ring-ring/35"
    >
      <h2 className="text-lg font-extrabold">{title}</h2>
      <p className="text-sm leading-6 text-muted-foreground">{body}</p>
    </section>
  )
}
