/**
 * Shared base styling for customer-flow text inputs (join, login, profile).
 *
 * The `text-base … md:text-sm` pairing is load-bearing: it pins the mobile
 * font-size at 16px so iOS Safari does not auto-zoom the page when a field
 * gains focus, then drops back to the smaller `text-sm` from `md` up.
 *
 * Geometry follows the contract ink-well (DESIGN.md Inputs): the shared 10px
 * `rounded-lg` radius on a `bg-card` well (CUS-P2-06), with focus routed
 * through the unlayered `.focus-ring` hard offset outline on `:focus-visible`
 * — no soft `:focus` halo that reads as a pre-filled error on autofocus
 * (VCU-P2-04; CON-P3-10 customer slice).
 *
 * Compose variants on top of this (e.g. `${customerInputClass} font-mono` for
 * code inputs, or append `aria-invalid:border-destructive` — see
 * `profileInputClass`); class order does not affect the rendered result.
 */
export const customerInputClass =
  "focus-ring h-12 rounded-lg border-2 border-ink bg-card px-4 text-base outline-none md:text-sm"
