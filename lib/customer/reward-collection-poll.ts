/**
 * Cadence for the held-reward screen's collection-status poll. The screen polls
 * briskly while the guest is likely at the counter, backs off once the code has
 * been open a while, and stops after a ceiling so a phone left on the table
 * does not poll indefinitely. Focus or visibility starts a fresh window.
 */
export const REWARD_COLLECTION_POLL_INTERVAL_MS = 1500
export const REWARD_COLLECTION_POLL_BACKOFF_AFTER_MS = 2 * 60 * 1000
export const REWARD_COLLECTION_POLL_BACKOFF_INTERVAL_MS = 5000
export const REWARD_COLLECTION_POLL_MAX_MS = 10 * 60 * 1000

/**
 * Delay before the next status check, or null once the poll window has run
 * its course and the loop should wait for the guest to return to the screen.
 */
export function rewardCollectionPollDelay(elapsedMs: number): number | null {
  if (elapsedMs >= REWARD_COLLECTION_POLL_MAX_MS) return null
  if (elapsedMs >= REWARD_COLLECTION_POLL_BACKOFF_AFTER_MS) {
    return REWARD_COLLECTION_POLL_BACKOFF_INTERVAL_MS
  }
  return REWARD_COLLECTION_POLL_INTERVAL_MS
}

/**
 * Status responses that retrying cannot change: 401 (signed out) and 404 (the
 * reward is not this guest's, or does not exist). The poll stops for good on
 * these; anything else is treated as transient.
 */
export function isTerminalRewardStatusResponse(status: number): boolean {
  return status === 401 || status === 404
}
