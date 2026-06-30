/**
 * Pure frequency-cap policy for customer notifications.
 *
 * The constants + classifier + retry-window math live here (no `server-only`,
 * no Supabase) so they can be unit-tested directly. The IO-bound count query
 * stays in `frequency-cap.ts`, which re-exports these for existing importers.
 */

import type { NotificationCategory } from "@/lib/notifications/catalog"

/** Max non-operational notifications a customer may receive per rolling 24h. */
export const CUSTOMER_DAILY_NOTIFICATION_CAP = 6
export const NOTIFICATION_CAP_WINDOW_MS = 24 * 60 * 60 * 1000
export const NOTIFICATION_CAP_RETRY_MS = 60 * 60 * 1000

/** Operational push (subscription lifecycle) bypasses the cap; everything else counts. */
export function isFrequencyCappedCategory(category: NotificationCategory) {
  return category !== "operational"
}

/** When a capped event should be retried — one hour out. */
export function nextNotificationFrequencyWindow(now: Date) {
  return new Date(now.getTime() + NOTIFICATION_CAP_RETRY_MS)
}
