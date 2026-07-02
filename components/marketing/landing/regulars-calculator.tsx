"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"

import { Eyebrow, MonoTag } from "@/components/brand"
import { Section } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { CTA, OPERATOR, PRODUCT, ROUTES } from "@/lib/marketing/facts"

/**
 * Regulars calculator — an ungated, value-first utility (PDF interactive-tool
 * flywheel). The result renders from conservative defaults on first paint (so it
 * is crawler-visible and needs no form submit), then recalculates as inputs
 * change. Soft lead capture comes AFTER the value; there is no gate and no
 * public embed feature, and the framing never promises guaranteed ROI.
 */

const WEEKS_PER_MONTH = 4.33

const DEFAULTS = {
  spend: 15, // average spend per order/cover (£)
  ordersPerDay: 25, // covers / orders per open day
  openDays: 6, // open days per week
  liftPct: 1, // +1 percentage-point repeat-rate lift (conservative)
}

const gbp = (value: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(value)))

type FieldProps = {
  id: string
  label: string
  suffix?: string
  prefix?: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}

function Field({
  id,
  label,
  suffix,
  prefix,
  value,
  min,
  max,
  step,
  onChange,
}: FieldProps) {
  // Local text state so typing is never clamped mid-edit (clearing the field
  // no longer snaps to `min`); in-range values recalculate live and the clamp
  // is applied on blur. Fractional steps get the decimal keypad on iOS.
  const [text, setText] = useState(() => String(value))

  return (
    <div className="grid gap-1.5">
      <label
        htmlFor={id}
        className="mono-meta text-muted-foreground"
      >
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-[var(--radius)] border-2 border-ink bg-card px-3 py-2 focus-within:ring-3 focus-within:ring-ring/35">
        {prefix ? (
          <span className="font-mono text-sm font-bold text-muted-foreground">
            {prefix}
          </span>
        ) : null}
        <input
          id={id}
          type="number"
          inputMode={Number.isInteger(step) ? "numeric" : "decimal"}
          min={min}
          max={max}
          step={step}
          value={text}
          onChange={(event) => {
            const nextText = event.target.value
            setText(nextText)
            const next = Number(nextText)
            if (
              nextText !== "" &&
              Number.isFinite(next) &&
              next >= min &&
              next <= max
            ) {
              onChange(next)
            }
          }}
          onBlur={() => {
            const next = Number(text)
            const committed =
              text === "" || !Number.isFinite(next)
                ? value
                : Math.min(max, Math.max(min, next))
            onChange(committed)
            setText(String(committed))
          }}
          className="w-full bg-transparent text-base font-extrabold tabular-nums outline-none"
        />
        {suffix ? (
          <span className="mono-meta shrink-0 text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  )
}

export function RegularsCalculator() {
  const [spend, setSpend] = useState(DEFAULTS.spend)
  const [ordersPerDay, setOrdersPerDay] = useState(DEFAULTS.ordersPerDay)
  const [openDays, setOpenDays] = useState(DEFAULTS.openDays)
  const [liftPct, setLiftPct] = useState(DEFAULTS.liftPct)

  const { extraVisitsPerWeek, extraRevenuePerMonth } = useMemo(() => {
    const visits = ordersPerDay * openDays * (liftPct / 100)
    return {
      extraVisitsPerWeek: visits,
      extraRevenuePerMonth: visits * spend * WEEKS_PER_MONTH,
    }
  }, [spend, ordersPerDay, openDays, liftPct])

  const visitsLabel = extraVisitsPerWeek.toFixed(1)
  const summary = `A +${liftPct}pp repeat-rate lift ≈ ${visitsLabel} extra repeat visits a week and about ${gbp(
    extraRevenuePerMonth
  )} extra revenue a month (before costs), at ${gbp(spend)} average spend, ${ordersPerDay} orders a day, ${openDays} days a week. Estimate only — profit depends on your margin.`

  const mailto = `mailto:${OPERATOR.supportEmail}?subject=${encodeURIComponent(
    "My Nabaperks regulars estimate"
  )}&body=${encodeURIComponent(summary)}`

  return (
    <Section id="regulars-calculator">
      <div className="surface-card grid gap-8 px-6 py-8 sm:px-10 sm:py-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <MonoTag tone="accent">Regulars calculator</MonoTag>
          <h2 className="mt-4 max-w-[20ch] text-[clamp(1.6rem,3.4vw,2.4rem)] leading-[1.05] font-extrabold tracking-[-0.02em] text-balance">
            What could one small repeat-visit lift be worth?
          </h2>
          <p className="mt-3 max-w-[44ch] text-sm leading-relaxed text-pretty text-muted-foreground">
            A couple more repeat visits a week can cover the {PRODUCT.price} plan.
            Profit depends on your margin.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Field
              id="calc-spend"
              label="Average spend"
              prefix="£"
              value={spend}
              min={1}
              max={200}
              step={1}
              onChange={setSpend}
            />
            <Field
              id="calc-orders"
              label="Orders a day"
              value={ordersPerDay}
              min={1}
              max={2000}
              step={1}
              onChange={setOrdersPerDay}
            />
            <Field
              id="calc-days"
              label="Open days a week"
              value={openDays}
              min={1}
              max={7}
              step={1}
              onChange={setOpenDays}
            />
            <Field
              id="calc-lift"
              label="Repeat-rate lift"
              suffix="pp"
              value={liftPct}
              min={0.5}
              max={5}
              step={0.5}
              onChange={setLiftPct}
            />
          </div>
        </div>

        <div className="rounded-[var(--radius)] border-2 border-ink bg-secondary p-6 shadow-sm">
          <Eyebrow>Your estimate</Eyebrow>
          <p
            aria-live="polite"
            className="mt-3 text-[clamp(2.5rem,7vw,3.75rem)] leading-none font-extrabold tracking-[-0.02em] tabular-nums"
          >
            {gbp(extraRevenuePerMonth)}
          </p>
          <p className="mono-meta mt-2 text-muted-foreground">
            extra revenue a month, before costs
          </p>
          <p className="mt-4 text-sm leading-relaxed text-pretty">
            About{" "}
            <strong className="font-bold text-foreground">
              {visitsLabel} extra repeat visits a week
            </strong>{" "}
            from a +{liftPct}pp lift in how many regulars come back. An estimate to
            sense-check, not a promise — your margin decides the profit.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href={ROUTES.signup}>{CTA.startPilot}</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={mailto}>Email me this estimate</a>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="underline underline-offset-4"
              onClick={() => {
                navigator.clipboard
                  ?.writeText(summary)
                  .then(() => toast.success("Estimate copied — show it to the team"))
                  .catch(() => toast.error("Could not copy — try again"))
              }}
            >
              Show this to the team
            </Button>
          </div>
        </div>
      </div>
    </Section>
  )
}
