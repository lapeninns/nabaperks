import { Eyebrow } from "@/components/brand"
import { Disclosure } from "@/components/merchant/launch/disclosure"
import { OFFER_NO_STACKING_TERM } from "@/lib/merchant/offer-campaign-fields"

/**
 * The review-step readback: the campaign's own name and the line customers
 * read, followed by every rule the merchant is about to freeze, in the order the
 * customer and the counter will meet them.
 *
 * The no-stacking line is rendered from {@link OFFER_NO_STACKING_TERM} and is
 * not a field — it applies to every offer, staff attest to it on each
 * redemption, and a merchant cannot edit it away. It is listed alongside the
 * merchant's own additional terms so the review shows the complete set.
 *
 * Two audiences, one component. Before publishing, this is the promise the
 * merchant is about to freeze, so every row is open and unavoidable. After
 * publishing it is a readback of settled facts the merchant checks rarely, and
 * seven stacked rows plus the terms card cost most of a phone screen above the
 * link and the counts they actually came for — so `collapsed` folds it into two
 * disclosures. The panel decides which mode applies; this component never
 * collapses the pre-publish reading of its own accord.
 */

/**
 * A campaign date is a plain calendar date, not an instant, so it is formatted
 * in UTC: reading `2026-08-03` in a local zone can slip it to the 2nd.
 */
const offerDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

export function formatOfferDate(iso: string | null): string {
  if (!iso) return "—"
  const parsed = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(parsed) ? "—" : offerDateFormatter.format(parsed)
}

export type OfferRulesSummaryProps = {
  /** The campaign's name. Null only for campaigns created before the field existed. */
  readonly name: string | null
  /** The line the customer reads on the claim landing. */
  readonly customerDescription: string | null
  readonly bonusStampCount: number | null
  readonly discountPercent: number | null
  readonly startsOn: string | null
  readonly endsOn: string | null
  readonly requiresIdCheck: boolean
  readonly extraTerms: string | null
  /** The venue's card length, used to phrase what the bonus stamps are worth. */
  readonly stampsRequired: number
  /**
   * Fold the rows and the terms into two disclosures. Used once a campaign is
   * published, where this is a readback rather than a decision. Never set on
   * the review step — a promise about to be frozen is read, not expanded.
   */
  readonly collapsed?: boolean
}

export function OfferRulesSummary({
  name,
  customerDescription,
  bonusStampCount,
  discountPercent,
  startsOn,
  endsOn,
  requiresIdCheck,
  extraTerms,
  stampsRequired,
  collapsed = false,
}: OfferRulesSummaryProps) {
  const rows = [
    name ? { label: "Name", value: name } : null,
    customerDescription
      ? { label: "What customers read", value: customerDescription }
      : null,
    bonusStampCount
      ? {
          label: "Welcome stamps",
          value:
            stampsRequired > 0
              ? `${bonusStampCount} of the ${stampsRequired} needed for a reward`
              : `${bonusStampCount} stamps`,
        }
      : null,
    discountPercent
      ? {
          label: "Discount pass",
          value: `${discountPercent}% off the whole bill, as often as they like while the offer runs`,
        }
      : null,
    { label: "Opens", value: formatOfferDate(startsOn) },
    { label: "Closes", value: formatOfferDate(endsOn) },
    {
      label: "Photo ID",
      value: requiresIdCheck
        ? "Staff check photo ID before honouring the pass"
        : "Not required",
    },
  ].filter((row): row is { label: string; value: string } => row !== null)

  const rules = (
    <dl className="grid gap-0">
      {rows.map((row) => (
        <div
          key={row.label}
          className="grid gap-1 border-b border-dashed border-ink/15 py-2.5 last:border-b-0 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-baseline sm:gap-4"
        >
          <dt className="eyebrow">{row.label}</dt>
          <dd className="text-sm leading-6 text-foreground">{row.value}</dd>
        </div>
      ))}
    </dl>
  )

  const terms = (
    <>
      <ul className="grid list-disc gap-1.5 pl-4 text-sm leading-6 text-muted-foreground">
        <li className="text-foreground">{OFFER_NO_STACKING_TERM}</li>
        {requiresIdCheck ? (
          <li>Photo ID is checked before the discount is applied.</li>
        ) : null}
        {extraTerms ? <li>{extraTerms}</li> : null}
      </ul>
      <p className="text-xs leading-5 text-muted-foreground">
        The first line is always part of the offer and cannot be removed.
      </p>
    </>
  )

  // A shared `name` makes these a native exclusive accordion: opening one
  // closes the other, so the panel grows by one section at most.
  if (collapsed) {
    return (
      <section className="grid gap-2" aria-label="Offer rules">
        <Disclosure label="Offer details" name="offer-readback">
          {rules}
        </Disclosure>
        <Disclosure label="Terms shown to customers" name="offer-readback">
          {terms}
        </Disclosure>
      </section>
    )
  }

  return (
    <section className="grid gap-4" aria-label="Offer rules">
      {rules}

      <div className="grid gap-2 rounded-lg border-2 border-border bg-secondary/40 p-3 sm:p-4">
        <Eyebrow>Terms shown to customers</Eyebrow>
        {terms}
      </div>
    </section>
  )
}
