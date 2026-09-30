/**
 * Recovery for a tab that outlived a deploy (QA BUG-062).
 *
 * A page rendered by one production build posts the server-action IDs that
 * build compiled. When the origin serves a newer build whose IDs changed,
 * Next answers 404 with `x-nextjs-action-not-found` and the client throws
 * `UnrecognizedActionError` into the nearest error boundary. `reset()` only
 * re-renders with the same stale client bundle, so every retry fails again
 * (and a stale "Log out" never reaches the server). A full reload loads the
 * current build. Vercel Skew Protection covers most tabs for 12 hours; this
 * is the fallback for older tabs and for IDs that change inside the window.
 *
 * After the reload the server renders the page afresh: a "Log out" that
 * failed as stale did not run, so the customer is still signed in and the
 * button now works.
 */

/** Session-storage key holding when a stale-action reload last happened. */
export const STALE_ACTION_RELOAD_KEY = "nabaperks.stale-action-reload"

/** A second stale action within this window re-renders instead of reloading. */
const RELOAD_GUARD_MS = 30_000

// Next 16's error code for "Server Action ... was not found on the server".
const UNRECOGNIZED_ACTION_ERROR_CODE = "E715"

const STALE_ACTION_MESSAGE =
  /Server Action "?[^"\s]*"? was not found on the server|Failed to find Server Action/

export function isStaleServerActionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  if (error.name === "UnrecognizedActionError") return true
  const code = (error as { __NEXT_ERROR_CODE?: unknown }).__NEXT_ERROR_CODE
  if (code === UNRECOGNIZED_ACTION_ERROR_CODE) return true
  return STALE_ACTION_MESSAGE.test(error.message)
}

type RecoveryStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export type BoundaryRecoveryEnv = {
  now(): number
  storage: RecoveryStorage | null
  reload(): void
}

function browserEnv(): BoundaryRecoveryEnv {
  let storage: RecoveryStorage | null = null
  try {
    storage = window.sessionStorage
  } catch {
    // Storage can be blocked; the reload still happens once.
  }
  return {
    now: () => Date.now(),
    storage,
    reload: () => window.location.reload(),
  }
}

function reloadedRecently(env: BoundaryRecoveryEnv): boolean {
  try {
    const last = Number(env.storage?.getItem(STALE_ACTION_RELOAD_KEY))
    return (
      Number.isFinite(last) && last > 0 && env.now() - last < RELOAD_GUARD_MS
    )
  } catch {
    return false
  }
}

function rememberReload(env: BoundaryRecoveryEnv) {
  try {
    env.storage?.setItem(STALE_ACTION_RELOAD_KEY, String(env.now()))
  } catch {
    // Without storage the guard cannot hold, but each reload needs a tap.
  }
}

/**
 * What an error boundary's "Try again" does: reload the page for a stale
 * server action (at most once per guard window), otherwise `reset()`.
 */
export function recoverFromBoundaryError(
  error: unknown,
  reset: () => void,
  env: BoundaryRecoveryEnv = browserEnv()
): void {
  if (isStaleServerActionError(error) && !reloadedRecently(env)) {
    rememberReload(env)
    env.reload()
    return
  }
  reset()
}
