import type { ReactNode } from "react"

import { ArrowRight01Icon, Tick02Icon } from "@hugeicons/core-free-icons"

import { MarketingSignupLink } from "@/components/analytics/marketing-signup-link"
import { Icon, IconRoundel, MonoTag } from "@/components/brand"
import { PriceLockup } from "@/components/marketing/pricing/price-lockup"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type CadenceTone = "paper" | "ink"

/**
 * CadenceOption — one payment rhythm as its own printed card.
 *
 * Two of these sit as peers: 28-day and annual. They are not plan tiers.
 * The highlighted ink card is a stamp on the same offer, not a second
 * product. Cadence is still chosen later, at billing activation; both CTAs
 * lead to the same signup route.
 */
export function CadenceOption({
  option,
  tone = "paper",
  tag,
  subtitle,
  title,
  amount,
  cadence,
  cadenceNote,
  description,
  steps = [],
  framed = true,
  size = "display",
  cta,
  secondary,
}: {
  option: "28-day" | "annual"
  tone?: CadenceTone
  tag: string
  subtitle: string
  title: string
  amount: string
  cadence: string
  cadenceNote?: string
  description: ReactNode
  steps?: readonly { label: string; body: ReactNode }[]
  framed?: boolean
  size?: "display" | "hero"
  cta?: string
  secondary?: ReactNode
}) {
  const ink = tone === "ink"
  const display = size === "display"

  return (
    <article
      id={`pricing-${option}`}
      data-payment-option={option}
      role="group"
      aria-label={option === "annual" ? "Prepay a year" : "Pay as you go"}
      className={cn(
        "flex h-full min-w-0 flex-col gap-6",
        display ? "p-6 sm:p-8 lg:p-10" : "p-5 sm:p-6",
        framed &&
          "rounded-(--radius-sheet) border-2 border-ink shadow-md transition-transform duration-[var(--w-dur-move)] ease-[var(--w-ease)] hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        !framed && ink && "border-t-2 border-ink md:border-t-0 md:border-l-2",
        ink ? "bg-ink text-paper" : "bg-card text-card-foreground"
      )}
    >
      <div className="grid min-w-0 gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <MonoTag tone={ink ? "sun" : "ink"} className="-rotate-1">
            {tag}
          </MonoTag>
          <p
            className={cn(
              "text-sm leading-6 font-medium",
              ink ? "text-paper/70" : "text-muted-foreground"
            )}
          >
            {subtitle}
          </p>
        </div>
        <p
          className={cn(
            "leading-tight font-extrabold tracking-tight",
            display ? "text-2xl sm:text-3xl lg:text-4xl" : "text-xl sm:text-2xl"
          )}
        >
          {title}
        </p>
      </div>

      <div className="grid gap-4">
        <PriceLockup
          size={size}
          tone={tone}
          amount={amount}
          cadence={cadence}
          note={cadenceNote}
        />
        <p
          className={cn(
            "max-w-2xl text-base leading-7",
            ink ? "text-paper/80" : "text-muted-foreground"
          )}
        >
          {description}
        </p>
      </div>

      {steps.length > 0 ? (
        <ul aria-label="How this cadence works" className="grid gap-3">
          {steps.map((step) => (
            <li
              key={step.label}
              className={cn(
                "flex items-start gap-3",
                ink ? "text-paper/90" : "text-foreground"
              )}
            >
              <IconRoundel
                icon={Tick02Icon}
                size="sm"
                tone={ink ? "seal" : "ink"}
                className="mt-0.5 size-5 border-0"
                iconSize={12}
                iconStrokeWidth={2.5}
              />
              <span className="min-w-0">
                <span className="block text-sm leading-6 font-extrabold">
                  {step.label}
                </span>
                <span
                  className={cn(
                    "block text-sm leading-6",
                    ink ? "text-paper/70" : "text-muted-foreground"
                  )}
                >
                  {step.body}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {cta ? (
        <div className="mt-auto flex flex-col gap-3 pt-2">
          <Button
            asChild
            size="lg"
            variant={ink ? "secondary" : "default"}
            className={cn(
              "w-full",
              !ink && "bg-ink text-paper hover:bg-ink/90"
            )}
          >
            <MarketingSignupLink>
              {cta}
              <Icon icon={ArrowRight01Icon} size={16} />
            </MarketingSignupLink>
          </Button>
          {secondary ? (
            <p
              className={cn(
                "text-sm leading-6 font-medium",
                ink ? "text-paper/80" : "text-muted-foreground"
              )}
            >
              {secondary}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
