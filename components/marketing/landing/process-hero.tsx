import Link from "next/link"

import { MarketingSignupLink } from "@/components/analytics/marketing-signup-link"
import { Eyebrow, IconRoundel, ReceiptCard } from "@/components/brand"
import { Section } from "@/components/layout"
import { MARKETING_TEXT_LINK } from "@/components/marketing/text-link"
import { Button } from "@/components/ui/button"
import { DFY_LAUNCH, MARKET, PRODUCT, ROUTES } from "@/lib/marketing/facts"
import { cn } from "@/lib/utils"

import { LAUNCH_STEP_GLYPHS } from "./launch-steps"

/**
 * Receipt-voice ticket lines, zipped with DFY_LAUNCH.steps in order. The hero
 * ticket is the summary register (mono facts); the timeline band below carries
 * the same steps in spoken voice, so the two never repeat a sentence.
 */
const STEP_TICKET_LINES = [
  "Venue + card setup",
  "Rewards configured",
  "Automations on",
  "Posters printed + posted",
  "You go live",
] as const

/**
 * The how-it-works hero — one headline, one decision, beside the launch
 * ticket: the five done-for-you steps printed as a tilted mono receipt. The
 * ticket is the page's signature object; every band below expands one line of
 * it.
 */
export function ProcessHero() {
  return (
    <Section
      size="default"
      className="grid items-center gap-8 pt-6 sm:pt-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-14"
    >
      <div className="grid gap-5">
        <Eyebrow>The process</Eyebrow>
        <h1 className="max-w-[18ch] text-4xl leading-[1.03] font-extrabold tracking-tight text-balance text-foreground sm:max-w-xl sm:text-5xl lg:text-6xl">
          We do the launch. You go live.
        </h1>
        <p className="max-w-md text-base leading-7 text-muted-foreground sm:text-lg">
          {MARKET.promise}
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <Button asChild size="lg">
            <MarketingSignupLink>Start your launch</MarketingSignupLink>
          </Button>
          <Link
            className={cn(MARKETING_TEXT_LINK, "text-foreground")}
            href={ROUTES.pricing}
          >
            See pricing
          </Link>
        </div>
        <p className="mono-id text-muted-foreground uppercase">
          {PRODUCT.cancelLine}
        </p>
      </div>
      <LaunchTicket />
    </Section>
  )
}

function LaunchTicket() {
  const lastIndex = DFY_LAUNCH.steps.length - 1

  return (
    <ReceiptCard
      edge
      rotated
      padding="md"
      wrapperClassName="mx-auto w-full max-w-md"
      className="gap-3"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="mono-meta text-muted-foreground">Launch ticket</p>
        <p className="mono-id text-muted-foreground uppercase">
          {DFY_LAUNCH.steps.length} steps
        </p>
      </div>
      <p className="text-lg leading-tight font-extrabold text-foreground">
        Everything before your first stamp
      </p>
      <hr className="w-rule" />
      <ol className="grid gap-2.5">
        {DFY_LAUNCH.steps.map((step, index) => (
          <li key={step.title} className="flex items-center gap-3">
            <span className="mono-id w-6 shrink-0 text-muted-foreground">
              {String(index + 1).padStart(2, "0")}
            </span>
            <IconRoundel
              size="sm"
              tone={index === lastIndex ? "primary" : "secondary"}
              icon={LAUNCH_STEP_GLYPHS[index]}
            />
            <span className="mono-meta min-w-0 flex-1 truncate text-foreground">
              {STEP_TICKET_LINES[index] ?? step.title}
            </span>
          </li>
        ))}
      </ol>
      <hr className="w-rule" />
      <div className="mono-id flex items-center justify-between gap-3 text-muted-foreground uppercase">
        <span>No app · No POS</span>
        <span>One venue QR</span>
      </div>
    </ReceiptCard>
  )
}
