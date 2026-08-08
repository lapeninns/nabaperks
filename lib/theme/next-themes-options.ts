/**
 * The exact next-themes configuration this app ships.
 *
 * Its own module, and deliberately not inside `components/theme-provider.tsx`:
 * `lib/security/csp.ts` pins SHA-256 hashes of the inline bootstrap script
 * next-themes injects, and that script's body is a function of these options,
 * so `tests/unit/csp-theme-hash.test.mjs` has to hash the REAL object. The unit
 * runner cannot import `.tsx`, so a plain `.ts` module is what lets the
 * provider and the test share one source instead of two copies.
 *
 * The copies were the bug: change a prop in the provider and the injected
 * script changes, the pin goes stale, CSP blocks the theme bootstrap in
 * production — and the suite stays green, because the test was hashing its own
 * literal. (Recorded in NEEDS-SIGNOFF 6 during 05#61.)
 */
export const NEXT_THEMES_OPTIONS = {
  attribute: "class",
  defaultTheme: "light",
  enableSystem: true,
  disableTransitionOnChange: true,
  storageKey: "nabaperks-theme",
} as const
