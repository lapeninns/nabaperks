/**
 * The public marketing surface's standalone text link.
 *
 * Every one of these used to be a bare `text-sm font-bold underline` on a
 * `<Link>` — a ~14px-tall hit area sitting on the same baseline as a 48px
 * `size="lg"` button, which fails both DESIGN.md's 44px primary-tap-target
 * rule and WCAG 2.5.8. `Button variant="link"` cannot be used for this: it
 * ships `h-auto p-0`, so it has no floor either.
 *
 * This is for links that stand alone beside a button or in a list. Links set
 * INSIDE a sentence keep their natural inline box (WCAG 2.5.8 exempts inline
 * targets, and boxing them would break the line's rhythm).
 */
export const MARKETING_TEXT_LINK =
  "focus-ring inline-flex min-h-11 items-center rounded-(--radius-md) text-sm font-bold underline underline-offset-4"
