/**
 * One vertical rhythm for the customer journey (CUS 02#5).
 *
 * Three shells wrap the same 410px measure — `CustomerShell` (/q, /offer,
 * /reward), `CustomerAppShell` (the authed tabs) and `CustomerFlowShell` (join,
 * stamp, and their skeletons). They already agree on WIDTH, and
 * `customer-p2-polish` CUS-P2-12/16 pins the `max-w-customer` literal into each
 * file, so the token itself cannot move here. What that assertion never covered
 * — and what this module owns — is the rhythm: a member walking
 * `/home` -> `/card/x` -> `/pass/y` used to get 24px, then 20px, then 24px of
 * top padding, 40px / 20px / 32px of it at >=640px, and a `min-h-svh` column in
 * one shell against `min-h-[100dvh]` in another, which is a different scroll
 * height the moment the iOS URL bar collapses.
 *
 * `svh` is the shared answer because it is the height that does NOT change
 * while the URL bar animates: `100dvh` re-resolves mid-scroll, so a flow screen
 * grew under the member's thumb where the sibling app screens did not. It is
 * also what the other four shells in the app already use (merchant, admin,
 * customer-shell, customer-app-shell) — the flow shell was the outlier.
 *
 * The `sm:` TOP/BOTTOM overrides are deliberately absent. The column caps at
 * 410px, so at the 640px breakpoint the page is the same 410px of content it
 * was at 375px; scaling its vertical padding there only pushed the same content
 * further down a screen that had not changed. `sm:px-*` stays permitted by
 * CUS-P2-06 as a page-edge gutter, but is itself inert above 442px for the same
 * reason (410px column + 2x16px). Kept, not relied on.
 */

/** The customer page height. Stable across the iOS URL-bar animation. */
export const CUSTOMER_COLUMN_MIN_H = "min-h-svh"

/**
 * Page-edge gutters. `clip`, not `hidden`: `overflow-x-hidden` makes the
 * element a scroll container and silently kills `position: sticky` inside it,
 * which is how the activity day headers are anchored.
 */
export const CUSTOMER_COLUMN_INSET = "overflow-x-clip px-4 sm:px-6"

/** Top padding for a customer page. */
export const CUSTOMER_COLUMN_TOP = "pt-5"

/** Tighter top padding for the friction-heavy form steps (`dense`). */
export const CUSTOMER_COLUMN_TOP_DENSE = "pt-4"

/**
 * Bottom padding for a page with no fixed tab bar. Respects the home-indicator
 * safe area so the last CTA never sits clipped against the screen edge
 * (VCU-P3-06/08). Pages WITH the tab bar use `TAB_BAR_CLEARANCE` instead, which
 * already carries the safe area.
 */
export const CUSTOMER_COLUMN_BOTTOM =
  "pb-[max(1.25rem,env(safe-area-inset-bottom))]"

/** Bottom padding for a `dense` flow step. */
export const CUSTOMER_COLUMN_BOTTOM_DENSE =
  "pb-[max(1rem,env(safe-area-inset-bottom))]"
