import type { QrCodeSummary } from "@/lib/merchant/qr-code"

/**
 * What the Counter QR card may do, resolved once from the venue's join QR row
 * and launch readiness. Pure so the four states are unit-tested and the
 * harness can pin each one.
 *
 * - `ready`   — scannable now; the card is the present-mode button.
 * - `paused`  — the row exists but the owner switched it off under Poster.
 * - `gated`   — the row is active but launch gates (setup, billing) are not
 *               all met, so customers cannot join yet.
 * - `missing` — no join QR row at all. `ensure-join-qr.ts` should have
 *               prevented this; callers log it as a bug.
 */
export type CounterQrState = "ready" | "paused" | "gated" | "missing"

export function resolveCounterQrState({
  qrCode,
  launchReady,
}: {
  readonly qrCode: Pick<QrCodeSummary, "is_active"> | null
  readonly launchReady: boolean
}): CounterQrState {
  if (!qrCode) return "missing"
  if (!qrCode.is_active) return "paused"
  return launchReady ? "ready" : "gated"
}

/** The QR is drawn (dimmed or not) rather than replaced by a receipt note. */
export function counterQrHasImage(state: CounterQrState): boolean {
  return state !== "missing"
}
