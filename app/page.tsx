import Link from "next/link"

import { MetricTile, PageTitle, SectionHeader } from "@/components/brand"
import { MarketingLayout } from "@/components/layout"
import { QrFrame, StampGrid } from "@/components/loyalty"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const qrCells = [
  1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 1, 1, 0,
  1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1,
  0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1,
  0, 1, 1, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 1, 1,
]

const actions = [
  {
    href: "/signup",
    title: "Start a merchant trial",
    description:
      "Create the account, add the business profile, and build the first mystery card.",
  },
  {
    href: "/login",
    title: "Open merchant setup",
    description:
      "Continue onboarding, QR downloads, staff PINs, and dashboard readback.",
  },
  {
    href: "/pricing",
    title: "Check pilot pricing",
    description: "30 days free for pilots, then GBP 29/month per location.",
  },
]

const heroStages = [
  {
    label: "Scan",
    copy: "Customer points their camera at your counter QR.",
  },
  {
    label: "Join",
    copy: "They verify in the browser — no app store detour.",
  },
  {
    label: "Stamp",
    copy: "Staff confirm visits with a private PIN.",
  },
  {
    label: "Reward",
    copy: "The mystery reward unlocks after the target visit.",
  },
]

const features = [
  {
    title: "No app, no plastic",
    copy: "Every loyalty card opens from a QR link and stays usable from the customer's browser.",
  },
  {
    title: "Counter-safe controls",
    copy: "Staff PIN stamping keeps visit approval fast without exposing merchant settings.",
  },
  {
    title: "Mystery rewards",
    copy: "Customers see progress first, then reveal the assigned reward when it is earned.",
  },
  {
    title: "Merchant setup path",
    copy: "Start with account creation, add your venue details, then download QR assets.",
  },
]

export default function Page() {
  return (
    <MarketingLayout>
      <section className="mx-auto grid min-h-[calc(100svh-73px)] w-full max-w-7xl content-center gap-10 px-6 py-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)] lg:items-center lg:py-16">
        <div className="grid gap-8">
          <PageTitle
            eyebrow="No-app loyalty for local venues"
            title="A warm QR loyalty card customers can use before their coffee cools."
            description="Stampiee gives pubs, cafes, salons, and local counters a browser-based loyalty card: scan a QR, join without an app, collect staff-approved stamps, and unlock a mystery reward."
            titleClassName="text-5xl leading-[1.02] sm:text-6xl"
            descriptionClassName="text-base leading-7"
          />

          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/signup">Start a merchant trial</Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/pricing">View pricing</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/login">Merchant login</Link>
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <MetricTile label="Setup target" value="<5 min" />
            <MetricTile label="Staff training" value="<3 min" />
            <MetricTile label="Pilot offer" value="30 days free" />
          </div>
        </div>

        <div className="grid gap-4">
          <Card className="surface-card gap-5 rounded-[2rem] p-1 shadow-xs">
            <div className="flex items-center justify-between gap-4">
              <SectionHeader
                eyebrow="Live flow"
                title="Scan, join, stamp, reward"
                description="The four-step flow is readable as a static guide and gently highlighted for motion-safe users."
                className="flex-1"
              />
              <Badge variant="secondary" className="hidden sm:inline-flex">
                Browser first
              </Badge>
            </div>

            <div className="grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
              <QrFrame label="Demo QR code for joining a no-app loyalty card">
                <div className="grid aspect-square grid-cols-10 gap-1 rounded-2xl bg-white p-2">
                  {qrCells.map((cell, index) => (
                    <span
                      key={index}
                      className={
                        cell
                          ? "rounded-[3px] bg-qr"
                          : "rounded-[3px] bg-transparent"
                      }
                    />
                  ))}
                </div>
              </QrFrame>

              <div className="grid content-between gap-4 rounded-3xl bg-secondary/60 p-4">
                <div>
                  <p className="text-sm font-bold text-muted-foreground">
                    Old Crown Mystery Card
                  </p>
                  <p className="mt-1 text-3xl leading-tight font-extrabold">
                    3 visits reveal a reward
                  </p>
                </div>
                <StampGrid current={2} total={3} />
                <div className="rounded-2xl bg-card p-3">
                  <p className="text-xs font-bold text-muted-foreground uppercase">
                    Next action
                  </p>
                  <p className="mt-1 text-sm font-bold">
                    Staff approves the visit and keeps the reward locked.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              {heroStages.map((stage, index) => (
                <div
                  key={stage.label}
                  className="rounded-2xl border bg-background p-3 text-sm shadow-xs"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        index === 2
                          ? "grid size-7 motion-safe:animate-pulse place-items-center rounded-full bg-primary text-xs font-extrabold text-primary-foreground motion-reduce:animate-none"
                          : "grid size-7 place-items-center rounded-full bg-accent text-xs font-extrabold text-accent-foreground"
                      }
                    >
                      {index + 1}
                    </span>
                    <span className="font-extrabold">{stage.label}</span>
                  </div>
                  <p className="mt-2 leading-5 text-muted-foreground">
                    {stage.copy}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid gap-3 sm:grid-cols-3">
            {actions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="pressable grid gap-2 rounded-2xl border bg-card p-4 shadow-xs transition hover:-translate-y-0.5 hover:border-primary/50"
              >
                <span className="text-sm font-extrabold">{action.title}</span>
                <span className="text-sm leading-6 text-muted-foreground">
                  {action.description}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-6 px-6 pb-16">
        <SectionHeader
          eyebrow="Built for the counter"
          title="Everything visitors need to understand the product without a demo call."
          description="The homepage keeps the no-app QR proposition, merchant setup path, pricing route, and login route available from semantic links."
        />
        <div className="grid gap-4 md:grid-cols-4">
          {features.map((feature) => (
            <Card key={feature.title} className="surface-card">
              <CardHeader>
                <CardTitle className="text-lg font-extrabold">
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-muted-foreground">
                  {feature.copy}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </MarketingLayout>
  )
}
