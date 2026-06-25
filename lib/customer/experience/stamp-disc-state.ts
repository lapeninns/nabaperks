/**
 * The visual treatment of the self-service stamp disc, kept pure so it can be
 * triangulated without rendering. Friction F10: the disc used to flip to the
 * confirmed success-green leaf the instant the customer tapped — optimistically,
 * before the server agreed. When the server then declined (already-stamped,
 * rate-limited, billing) the optimistic mark rolled back and the green silently
 * un-happened. Green must mean "the server issued this stamp", nothing less.
 *
 * - `idle`     — the stamp is available and untouched (or a decline rolled the
 *                optimistic mark back). Actionable; the neutral stamp disc.
 * - `pending`  — the optimistic slam has landed but the server has not confirmed.
 *                Still the neutral stamp colour, optionally tinted: a press is
 *                not yet a success.
 * - `confirmed`— server truth: the RPC returned "issued", or the screen opened on
 *                an already-stamped card. Only this state earns the green disc.
 */
export type StampDiscState = "idle" | "pending" | "confirmed"

export type StampDiscStateArgs = {
  /** The server confirmed the stamp (the RPC returned "issued"). */
  committed: boolean
  /** Optimistic stamp shown, server not yet confirmed. */
  inFlight: boolean
  /** Today's stamp is still available — false once it has landed server-side. */
  canStamp: boolean
  /** A stamp attempt was declined and its calm error is showing. */
  hasError: boolean
}

export function stampDiscState({
  committed,
  inFlight,
  canStamp,
  hasError,
}: StampDiscStateArgs): StampDiscState {
  // The optimistic press is in flight: neutral, not green — the success is not
  // earned until the server agrees.
  if (inFlight && !committed) return "pending"
  // Green is reserved for server truth: a confirmed issue, or an already-stamped
  // card that the server reported (no in-flight attempt, no decline showing).
  if (committed || (!canStamp && !hasError)) return "confirmed"
  return "idle"
}
