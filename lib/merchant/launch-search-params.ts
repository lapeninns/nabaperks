/**
 * Typed parser for the `/app/launch` query protocol.
 *
 * The launch route uses query params as UI protocol state: `tab` selects the
 * active step, and a family of transient flags (`saved`, `created`, ...) signal
 * the result of a just-completed server action so the page can show a banner
 * and then strip them. Next resolves `searchParams` as
 * `string | string[] | undefined` per key, so this parser is the one place that
 * narrows the raw bag into a known, all-optional-string shape — callers never
 * touch the raw record. Unknown keys are dropped; array values collapse to the
 * first entry (a duplicated `?tab=a&tab=b` is treated as `a`).
 */
export type RawLaunchSearchParams = Record<
  string,
  string | string[] | undefined
>

export type LaunchSearchParams = {
  tab?: string
  saved?: string
  seeded?: string
  error?: string
  created?: string
  enabled?: string
  disabled?: string
  checkout?: string
  portal?: string
  qr?: string
}

/** Keys that form the launch query protocol; everything else is ignored. */
const LAUNCH_PARAM_KEYS = [
  "tab",
  "saved",
  "seeded",
  "error",
  "created",
  "enabled",
  "disabled",
  "checkout",
  "portal",
  "qr",
] as const satisfies ReadonlyArray<keyof LaunchSearchParams>

function firstString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}

export function parseLaunchSearchParams(
  raw: RawLaunchSearchParams | undefined
): LaunchSearchParams {
  if (!raw) {
    return {}
  }

  const parsed: LaunchSearchParams = {}

  for (const key of LAUNCH_PARAM_KEYS) {
    const value = firstString(raw[key])

    if (value !== undefined) {
      parsed[key] = value
    }
  }

  return parsed
}

/**
 * Params whose presence means "a server action just finished" — the launch page
 * shows the relevant banner, then redirects to a clean URL so a refresh does not
 * replay the banner. Excludes `error` (it should persist until the user acts)
 * and the Stripe `checkout`/`portal` returns (owned by the billing panel).
 */
const LAUNCH_TRANSIENT_KEYS = [
  "saved",
  "seeded",
  "created",
  "enabled",
  "disabled",
  "qr",
] as const satisfies ReadonlyArray<keyof LaunchSearchParams>

export function hasTransientLaunchParam(params: LaunchSearchParams): boolean {
  return LAUNCH_TRANSIENT_KEYS.some((key) => Boolean(params[key]))
}
