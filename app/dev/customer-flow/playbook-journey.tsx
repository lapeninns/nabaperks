import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  customerFlowJourneySteps,
  type JourneyStep,
} from "@/app/dev/customer-flow/steps"
import type { CustomerFlowPreviewLinks } from "@/app/dev/customer-flow/preview/screens"
import { cn } from "@/lib/utils"

const cardToneClass = {
  scan: "bg-card",
  join: "bg-primary/12",
  stamp: "bg-stamp/12",
  reward: "bg-reward/12",
  ready: "bg-accent text-accent-foreground",
} satisfies Record<JourneyStep["tone"], string>

export function JourneyPlaybook({
  links,
}: {
  readonly links: CustomerFlowPreviewLinks
}) {
  const steps = customerFlowJourneySteps(links)

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <p className="eyebrow">Customer lane</p>
          <h2 className="text-2xl leading-tight font-black">Journey cards</h2>
        </div>
        <p className="max-w-md text-sm leading-6 text-muted-foreground">
          Mock preview screens — no auth, database, or OTP required.
        </p>
      </div>
      <ol className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-3">
        {steps.map((step) => (
          <PlaybookCard key={`${step.number}-${step.screenLabel}`} step={step} />
        ))}
      </ol>
    </section>
  )
}

function PlaybookCard({ step }: { readonly step: JourneyStep }) {
  const isLocked = !step.href

  return (
    <li className="min-w-[17rem] snap-start sm:min-w-0">
      <article
        className={cn(
          "surface-card flex h-full min-h-[18rem] flex-col justify-between gap-4 p-4 transition-transform duration-[var(--w-dur-fast)] ease-[var(--w-ease)] motion-reduce:transition-none hover:-translate-y-0.5",
          cardToneClass[step.tone],
          isLocked && "border-dashed opacity-75 hover:translate-y-0"
        )}
      >
        <div className="grid gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="grid gap-1">
              <span className="font-mono text-xs font-bold text-muted-foreground uppercase">
                {step.lane} / {step.number}
              </span>
              <span className="w-fit rounded-full border-2 border-ink bg-card px-3 py-1 font-mono text-[0.65rem] font-bold text-card-foreground uppercase">
                {step.screenLabel}
              </span>
            </div>
            <span className="grid size-11 -rotate-6 place-items-center rounded-lg border-2 border-ink bg-background font-mono text-sm font-black text-foreground shadow-xs">
              {step.glyph}
            </span>
          </div>
          <div className="grid gap-2">
            <h3 className="text-xl leading-tight font-black">{step.label}</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              {step.detail}
            </p>
          </div>
          <p className="rounded-lg border-2 border-dashed border-ink/25 bg-background/70 p-3 text-sm leading-5 font-bold">
            {step.actionHint}
          </p>
        </div>
        <LaunchButton step={step} />
      </article>
    </li>
  )
}

function LaunchButton({ step }: { readonly step: JourneyStep }) {
  if (!step.href) {
    return (
      <Button disabled variant="secondary" className="w-full">
        Stage locked
      </Button>
    )
  }

  return (
    <Button asChild variant="secondary" className="w-full">
      <Link href={step.href}>Open mock screen</Link>
    </Button>
  )
}
