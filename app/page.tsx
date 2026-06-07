import Link from "next/link"

import { Eyebrow, MetricTile } from "@/components/brand"
import { MarketingLayout } from "@/components/layout"
import { QrFrame, StampGrid } from "@/components/loyalty"
import { Button } from "@/components/ui/button"

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

export default function Page() {
  return (
    <MarketingLayout>
      <section className="mx-auto grid min-h-[calc(100svh-73px)] w-full max-w-7xl content-center gap-10 px-6 py-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)] lg:items-center">
        <div className="grid gap-8">
          <div className="grid gap-5">
            <Eyebrow>No-app loyalty for local venues</Eyebrow>
            <h1 className="max-w-3xl text-5xl leading-[1.05] font-extrabold sm:text-6xl">
              Scan, join, stamp, reward.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              Stampiee gives pubs, cafes, and local counters a QR loyalty card
              that customers can use in the browser without downloading an app.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/signup">Create merchant account</Link>
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
          <div className="grid gap-5 rounded-[2rem] border bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-muted-foreground uppercase">
                  Live flow
                </p>
                <h2 className="mt-1 text-2xl font-extrabold">
                  Counter-ready QR card
                </h2>
              </div>
              <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">
                Browser first
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
              <QrFrame>
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
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {actions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="grid gap-2 rounded-2xl border bg-card p-4 shadow-xs transition hover:-translate-y-0.5 hover:border-primary/50"
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
    </MarketingLayout>
  )
}
