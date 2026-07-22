import {
  MailSend01Icon,
  SecurityCheckIcon,
  SmartPhone01Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"

import { Eyebrow, IconRoundel, type IconGlyph } from "@/components/brand"

const STEPS: { icon: IconGlyph; title: string; detail: string }[] = [
  {
    icon: UserMultiple02Icon,
    title: "We check your list",
    detail:
      "Duplicates, typos and people already on your card are set aside before anything sends.",
  },
  {
    icon: SecurityCheckIcon,
    title: "You confirm you can email them",
    detail:
      "Choose your lawful basis and attest the list is yours — never bought, scraped or third-party.",
  },
  {
    icon: MailSend01Icon,
    title: "We send gradually",
    detail:
      "One invitation each, paced through the day so your venue stays a trusted sender.",
  },
  {
    icon: SmartPhone01Icon,
    title: "They join with two stamps",
    detail:
      "A tap, a quick phone check, no app — and their card already holds two welcome stamps.",
  },
]

/**
 * The four-beat "what happens next" rail shown beside the compose form: sets
 * expectations (paced sending), foregrounds the compliance gate, and closes on
 * the customer payoff. Ordered list so it reads as a sequence to assistive tech.
 */
export function WhatHappensNext() {
  return (
    <section aria-labelledby="invite-steps-heading" className="grid gap-3">
      <Eyebrow>
        <span id="invite-steps-heading">How it works</span>
      </Eyebrow>
      <ol className="grid gap-4">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex min-w-0 gap-3">
            <IconRoundel
              icon={step.icon}
              size="md"
              tone="secondary"
              iconStrokeWidth={2.25}
            />
            <div className="grid min-w-0 gap-0.5">
              <p className="text-sm leading-snug font-bold text-foreground">
                <span className="mono-id mr-1.5 text-muted-foreground">
                  {index + 1}
                </span>
                {step.title}
              </p>
              <p className="text-xs leading-5 text-muted-foreground">
                {step.detail}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
