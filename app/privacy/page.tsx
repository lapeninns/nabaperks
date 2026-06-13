import Link from "next/link"

import { Eyebrow, PageTitle, ReceiptCard } from "@/components/brand"
import { MarketingLayout } from "@/components/layout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

const sections = [
  {
    id: "data-collected",
    title: "Data collected",
    body: "Nabaperks stores the email address or phone number used to verify a customer, merchant loyalty membership records, stamp events, reward events, consent records, QR and billing status signals, and support audit logs.",
  },
  {
    id: "purposes",
    title: "Purposes",
    body: "Data is used to provide the loyalty card, show progress, unlock and redeem rewards, prevent misuse, support merchants and customers, keep audit evidence, and measure whether the MVP works.",
  },
  {
    id: "marketing-consent",
    title: "Marketing consent separation",
    body: "Loyalty participation is separate from marketing. Customers can collect stamps without opting in to marketing, and marketing opt-in or opt-out evidence is kept in consent records.",
  },
  {
    id: "sharing-and-scoping",
    title: "Sharing, scoping, and support access",
    body: "Customer loyalty data is scoped to the relevant merchant and Nabaperks support administrators. Admin access is used for support, fraud review, privacy requests, and audited operational tasks. PostHog analytics receives minimized event properties where configured.",
  },
  {
    id: "data-requests",
    title: "Data requests",
    body: "Customers can ask for privacy, access, deletion, export, or consent support. Internal admins use audited lookup tools to identify the relevant customer and merchant records and record the request channel.",
  },
  {
    id: "audit-records",
    title: "Audit and support records",
    body: "Support notes, consent records, fraud signals, manual adjustments, and admin actions may be retained as audit evidence so reward history and support decisions remain accountable.",
  },
]

export default function PrivacyPage() {
  return (
    <MarketingLayout>
      <section className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
        <aside className="surface-card p-4 lg:sticky lg:top-24">
          <Eyebrow className="mb-3">On this page</Eyebrow>
          <nav aria-label="Privacy sections" className="grid gap-1">
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
            title="What happens to the data."
            description="MVP privacy wording for pilot support, consent separation, admin support scoping, and audit records. The full notice travels with your merchant agreement and needs legal review before launch."
            titleClassName="text-[clamp(2.1rem,4.5vw,3.2rem)]"
            className="md:grid-cols-1"
          />

          <ReceiptCard edge className="grid gap-0">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-xl font-extrabold">Privacy, condensed</p>
              <span className="font-mono text-[0.625rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                Nº P-2026
              </span>
            </div>
            {sections.map((section) => (
              <PolicyBlock
                key={section.id}
                id={section.id}
                title={section.title}
                body={section.body}
              />
            ))}
          </ReceiptCard>

          <Alert className="border-destructive/30 bg-destructive/10">
            <AlertTitle className="text-destructive">Review required</AlertTitle>
            <AlertDescription>
              This page is not final legal wording. UK GDPR, PECR, promotional
              marketing, and consumer protection terms must be reviewed before
              launch.
            </AlertDescription>
          </Alert>

          <Button asChild variant="secondary" className="w-fit">
            <Link href="/terms">Platform terms</Link>
          </Button>
        </article>
      </section>
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
    <section
      id={id}
      tabIndex={-1}
      className="w-rule scroll-mt-28 grid gap-2 pt-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/35"
    >
      <p className="font-mono text-[0.7rem] font-bold tracking-[0.08em] text-foreground uppercase">
        {title}
      </p>
      <p className="text-sm leading-6 text-muted-foreground">{body}</p>
    </section>
  )
}
