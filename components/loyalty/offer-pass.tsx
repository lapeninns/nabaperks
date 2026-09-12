import type { ReactNode } from "react"
import {
  ArrowRight01Icon,
  DiscountTag01Icon,
  IdentityCardIcon,
} from "@hugeicons/core-free-icons"

import { Eyebrow, Icon, MonoTag } from "@/components/brand"
import { OFFER_NO_STACKING_TERM } from "@/lib/merchant/offer-campaign-fields"
import { cn } from "@/lib/utils"
import { offerTermExcerpts } from "./offer-pass-copy"

/**
 * `OfferPass` — the customer's discount pass, as one printed face.
 *
 * This is the loyalty-vocabulary sibling of `RewardTicket`, and deliberately
 * NOT a reward. A reward is single consumption: `reward_events` flips
 * `unlocked -> redeemed` once and is gone. A discount pass has unlimited uses
 * inside its window — only the short-lived scan code behind it is single use —
 * so it is its own record (`offer_discount_entitlements`) and its own face,
 * shown separately from rewards on the card and the home screen.
 *
 * Four facts are always on the face because they are the four things staff are
 * asked to enforce at the counter, and a customer must not be surprised by any
 * of them: the percentage, the window it is valid for, whether photo ID will be
 * asked for, and that it cannot be combined with another reward or offer. The
 * no-stacking line is rendered from the one shared constant the merchant
 * creator, the merchant review readback and this face all print, so the promise
 * cannot drift between the three.
 *
 * The terms are a SNAPSHOT taken when the pass was claimed. Editing, pausing or
 * ending the campaign afterwards never rewrites what a customer was promised,
 * so this component renders only what it is given.
 */

/**
 * The four states a held pass can be in. `not_started` is separate from
 * `expired` on purpose: a pass whose window has not opened yet is good news
 * with a date on it, and must never be reported as finished.
 */
export type OfferPassState = "active" | "not_started" | "expired" | "revoked"

type StateBadge = {
  readonly label: string
  readonly tone: "leaf" | "sun" | "plain"
}

const STATE_BADGE: Record<OfferPassState, StateBadge> = {
  active: { label: "Ready to use", tone: "leaf" },
  not_started: { label: "Opens soon", tone: "sun" },
  expired: { label: "Finished", tone: "plain" },
  revoked: { label: "Withdrawn", tone: "plain" },
}

const PASS_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

/**
 * A pass window is a plain calendar date, never an instant, so it is read in
 * UTC — parsing `2026-08-03` in a local zone can slip it to the 2nd. Returns
 * null for anything that is not a real date so the surface omits the line
 * instead of printing "Invalid Date".
 */
export function formatOfferPassDate(iso: string | null): string | null {
  if (!iso) return null

  const parsed = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(parsed) ? null : PASS_DATE_FORMATTER.format(parsed)
}

export type OfferPassProps = {
  /** The venue that issued the pass. */
  readonly venueName: string
  readonly discountPercent: number
  /** First calendar day the pass may be used, as `YYYY-MM-DD`. */
  readonly validFrom: string
  /** Last calendar day the pass may be used, as `YYYY-MM-DD`. */
  readonly validTo: string
  readonly requiresIdCheck: boolean
  /** The venue's own additional terms, frozen at claim time. */
  readonly extraTerms?: string | null
  readonly state?: OfferPassState
  /**
   * Slot above the terms — the live QR on the pass screen, or a link through to
   * it from a rail. Omitted for a pass that cannot be presented.
   */
  readonly children?: ReactNode
  readonly className?: string
  /**
   * Outline level for the discount lockup. `h1` is for the pass screen, where
   * the pass is the page; `h3` is the default for a rail beside a card.
   */
  readonly headingLevel?: "h1" | "h2" | "h3"
  readonly termsExpanded?: boolean
  /** A context-specific, server-derived status (e.g. code expired at the till). */
  readonly statusTag?: ReactNode
  readonly supportLine?: ReactNode
}

export function OfferPass({
  venueName,
  discountPercent,
  validFrom,
  validTo,
  requiresIdCheck,
  extraTerms,
  state = "active",
  children,
  className,
  headingLevel: Heading = "h3",
  termsExpanded = true,
  statusTag,
  supportLine,
}: OfferPassProps) {
  const badge = STATE_BADGE[state]
  const opens = formatOfferPassDate(validFrom)
  const closes = formatOfferPassDate(validTo)
  const excerpts = offerTermExcerpts(extraTerms)
  const active = state === "active"

  return (
    <section
      aria-label={`Discount pass for ${venueName}`}
      data-offer-pass-state={state}
      className={cn(
        "grid min-w-0 rounded-lg border-2 bg-card text-left",
        active ? "border-ink shadow-md" : "border-dashed border-line-strong",
        className
      )}
    >
      <div className="grid min-w-0 gap-3 border-b-2 border-dashed border-line-strong p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Eyebrow>Discount pass</Eyebrow>
          {statusTag ?? <MonoTag tone={badge.tone}>{badge.label}</MonoTag>}
        </div>
        <Heading className="flex flex-wrap items-baseline gap-3 font-extrabold">
          <span
            className={cn(
              "numeric-tabular text-[4rem] leading-none tracking-tighter",
              !active && "text-muted-foreground"
            )}
          >
            {discountPercent}
            <span className="text-4xl">%</span>
          </span>{" "}
          <span className="min-w-0 text-xl leading-tight tracking-tight break-words">
            off at <br />
            {venueName}
          </span>
        </Heading>
        {excerpts.scope ? (
          <p className="text-sm leading-5 font-bold break-words whitespace-pre-line">
            {excerpts.scope}
          </p>
        ) : null}
        {requiresIdCheck ? (
          <MonoTag tone="sun" icon={IdentityCardIcon} className="w-fit">
            Photo ID
          </MonoTag>
        ) : null}
        <dl className="mono-meta grid gap-2 border-t-2 border-ink pt-3 tracking-normal">
          {opens ? (
            <div className="grid grid-cols-[3rem_minmax(0,1fr)] gap-2">
              <dt className="text-muted-foreground">From</dt>
              <dd>{opens}</dd>
            </div>
          ) : null}
          {closes ? (
            <div className="grid grid-cols-[3rem_minmax(0,1fr)] gap-2">
              <dt className="text-muted-foreground">Until</dt>
              <dd>{closes}</dd>
            </div>
          ) : null}
          {!opens && !closes ? (
            <div>
              <dt className="sr-only">Validity</dt>
              <dd>Dates from the venue</dd>
            </div>
          ) : null}
        </dl>
      </div>

      {children ? (
        <div className="grid gap-3 border-b-2 border-dashed border-line-strong p-4">
          {children}
        </div>
      ) : null}

      <div className="grid min-w-0 gap-4 p-4">
        <div className="text-sm leading-5 text-muted-foreground">
          {supportLine ?? passLead(state, opens, closes)}
        </div>
        <div className="flex items-start gap-2">
          <Icon
            icon={DiscountTag01Icon}
            size={20}
            className="mt-0.5 shrink-0"
          />
          <p className="min-w-0 text-sm leading-5 font-bold">
            {OFFER_NO_STACKING_TERM}
          </p>
        </div>
        {requiresIdCheck ? (
          <div className="flex items-start gap-2 rounded-lg border-2 border-ink bg-seal p-3 text-seal-foreground">
            <Icon
              icon={IdentityCardIcon}
              size={20}
              className="mt-0.5 shrink-0"
            />
            <div className="grid min-w-0 gap-2 text-sm leading-5">
              <p className="font-extrabold">Photo ID</p>
              <p>
                Bring photo identification. The team will check it before the
                discount is applied.
              </p>
              {excerpts.identification ? (
                <p className="break-words whitespace-pre-line">
                  {excerpts.identification}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
        {extraTerms ? (
          <details
            className="group min-w-0 border-t-2 border-dashed border-line pt-2"
            open={termsExpanded}
          >
            <summary className="focus-ring flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-extrabold [&::-webkit-details-marker]:hidden">
              Extra terms
              <Icon
                icon={ArrowRight01Icon}
                size={16}
                className="shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none"
              />
            </summary>
            <p className="pt-2 text-sm leading-5 break-words whitespace-pre-line">
              {extraTerms}
            </p>
          </details>
        ) : null}
      </div>
    </section>
  )
}

/**
 * One calm sentence per state. A pass that cannot be used right now says why
 * and what to do next, rather than showing a code that would fail at the till.
 */
function passLead(
  state: OfferPassState,
  opens: string | null,
  closes: string | null
): string {
  switch (state) {
    case "active":
      return closes
        ? `Show this pass at the counter. Use it as often as you like until ${closes} — on its own, not alongside another reward or offer.`
        : "Show this pass at the counter. Use it as often as you like while it lasts — on its own, not alongside another reward or offer."
    case "not_started":
      return opens
        ? `This pass opens on ${opens}. Come back then and your code will be here waiting.`
        : "This pass has not opened yet. Come back on its start date and your code will be here waiting."
    case "expired":
      return closes
        ? `This pass ran until ${closes}. Ask the team whether they have a new offer on.`
        : "This pass has finished. Ask the team whether they have a new offer on."
    case "revoked":
      return "This pass is no longer active. If that looks wrong, ask a team member at the venue."
  }
}
