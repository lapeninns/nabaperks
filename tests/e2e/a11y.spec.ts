import { defineA11yRouteSweep } from "./helpers/a11y-sweep"

/**
 * platform a11y — WCAG 2 A/AA sweep (@a11y).
 *
 * Scans the public marketing surfaces and the DB-free /dev/app-harness console
 * lanes (the real merchant shells, no login) for zero axe-core violations. The
 * dev overlay is hidden first (see helpers/axe.ts) so only product markup is
 * audited. Run via `pnpm test:a11y`. A failure points at a real violation to
 * remediate in the owning surface's spec — this spec owns the sweep, not the fix.
 */
defineA11yRouteSweep("mobile")
