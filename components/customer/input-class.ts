/**
 * Shared base styling for customer-flow text inputs (join, login, profile).
 *
 * The `text-base … md:text-sm` pairing is load-bearing: it pins the mobile
 * font-size at 16px so iOS Safari does not auto-zoom the page when a field
 * gains focus, then drops back to the smaller `text-sm` from `md` up.
 *
 * Compose variants on top of this (e.g. `${customerInputClass} font-mono` for
 * code inputs, or append `aria-invalid:border-destructive` — see
 * `profileInputClass`); class order does not affect the rendered result.
 */
export const customerInputClass =
  "h-12 rounded-xl border-2 border-ink bg-secondary/60 px-4 text-base transition-[border-color,box-shadow] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none motion-reduce:transition-none focus:border-ring focus:ring-3 focus:ring-ring/25 md:text-sm"
