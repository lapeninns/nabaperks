import { PRODUCT, SETUP_FEE } from "@/lib/marketing/facts"
import type { ActivePromo } from "@/lib/marketing/promo"

/**
 * The one investment line, shared by every acquisition surface. While the
 * rolling launch window is open it renders the waived setup price with the
 * window's real end date; when the promo is off it falls back to the
 * standard-fee line — a "limited time" claim never renders without its dated
 * window.
 */
export function SetupPriceLine({ promo }: { promo: ActivePromo | null }) {
  return (
    <>
      {promo
        ? `${SETUP_FEE.label} (until ${promo.deadlineLabel})`
        : SETUP_FEE.standardLabel}{" "}
      · then {PRODUCT.price} (or {PRODUCT.priceAnnual} — {PRODUCT.annualSaving})
      after a {PRODUCT.pilot}.
    </>
  )
}
