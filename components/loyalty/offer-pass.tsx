import type { ReactNode } from "react"
import {
  Calendar03Icon,
  DiscountTag01Icon,
  IdentityCardIcon,
} from "@hugeicons/core-free-icons"

import { Eyebrow, Icon, MonoTag } from "@/components/brand"
import { OFFER_NO_STACKING_TERM } from "@/lib/merchant/offer-campaign-fields"
import { cn } from "@/lib/utils"

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
   * Slot below the terms — the live QR on the pass screen, or a link through to
   * it from a rail. Omitted for a pass that cannot be presented.
   */
  readonly children?: ReactNode
  /**
   * Slot directly under the discount lockup and date chip, above the lead
   * sentence and the terms. The pass screen puts the scannable code here: it is
   * the only reason that page exists, and behind the lead plus the four printed
   * terms it started roughly 430px down, on a screen used standing at a till
   * (CUS 02#41). Nothing is hidden to make room — the terms are what staff
   * enforce and stay on the face, they simply stop coming first.
   */
  readonly code?: ReactNode
  readonly className?: string
  /**
   * Outline level for the discount lockup. `h1` is for the pass screen, where
   * the pass is the page; `h3` is the default for a rail beside a card.
   */
  readonly headingLevel?: "h1" | "h2" | "h3"
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
  code,
  className,
  headingLevel: Heading = "h3",
}: OfferPassProps) {
  const badge = STATE_BADGE[state]
  const opens = formatOfferPassDate(validFrom)
  const closes = formatOfferPassDate(validTo)
  const active = state === "active"

  return (
    <section
      aria-label={`Discount pass for ${venueName}`}
      data-offer-pass-state={state}
      className={cn(
        "grid gap-4 rounded-lg bg-card p-4 text-left",
        active
          ? "border-2 border-ink shadow-sm"
          : "border-2 border-dashed border-line-strong",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <Icon icon={DiscountTag01Icon} size={16} />
          <Eyebrow>Discount pass</Eyebrow>
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          {requiresIdCheck ? (
            <MonoTag tone="sun" icon={IdentityCardIcon}>
              Photo ID
            </MonoTag>
          ) : null}
          <MonoTag tone={badge.tone}>{badge.label}</MonoTag>
        </span>
      </div>

      <div className="grid gap-1">
        <Heading className="flex flex-wrap items-baseline gap-2">
          <span
            className={cn(
              "numeric-tabular text-5xl leading-none font-extrabold",
              active ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {discountPercent}%
          </span>
          <span className="text-sm leading-tight font-extrabold break-words">
            off the whole bill at {venueName}
          </span>
        </Heading>
        {/* mono-meta, not mono-id: the window is the one fact a customer has to
            be able to read across a counter, so it stays above the 10px floor. */}
        <span className="mono-meta flex w-fit max-w-full items-center gap-1.5 rounded-md border-2 border-ink bg-seal/25 px-2 py-0.5 text-ink">
          <Icon icon={Calendar03Icon} size={13} strokeWidth={2.25} />
          <span className="min-w-0 truncate">
            {opens && closes ? `${opens} to ${closes}` : "Dates from the venue"}
          </span>
        </span>
      </div>

      {code}

      <p className="text-sm leading-6 text-muted-foreground">
        {passLead(state, opens, closes)}
      </p>

      {/* `list-disc` browser bullets were the one un-designed element on an
          otherwise fully-inked face, and the only bulleted list in the whole
          member journey. Each term is now a row with a 4px ink square marker,
          in the stamp/seal-free vocabulary the rest of the card uses. The
          no-stacking rule — the one staff actually enforce, and the one a
          member is asked to read across a counter — moves up to text-sm; the
          rest stay at text-xs. No term is removed or hidden (CUS 02#42). */}
      <ul className="grid gap-2 text-muted-foreground">
        {/* Always printed, never editable by the venue: staff attest to this
            same rule on every redemption. */}
        <PassTerm emphasis>{OFFER_NO_STACKING_TERM}</PassTerm>
        {requiresIdCheck ? (
          <PassTerm>
            Bring photo identification. The team will check it before the
            discount is applied.
          </PassTerm>
        ) : null}
        {extraTerms ? <PassTerm>{extraTerms}</PassTerm> : null}
      </ul>

      {children}
    </section>
  )
}

/**
 * One printed term. The marker is a 4px ink square — flat and hard-edged, and
 * deliberately not a circle, because circles belong to the stamp and reward
 * family and a term is neither.
 */
function PassTerm({
  children,
  emphasis = false,
}: {
  children: ReactNode
  emphasis?: boolean
}) {
  return (
    <li className="grid grid-cols-[auto_1fr] items-start gap-2">
      <span aria-hidden="true" className="mt-[0.45em] size-1 shrink-0 bg-ink" />
      <span className={emphasis ? "text-sm leading-5" : "text-xs leading-5"}>
        {children}
      </span>
    </li>
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
