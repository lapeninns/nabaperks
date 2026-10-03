/**
 * What a venue QR scan leads to, decided apart from rendering so each failure
 * is told apart (QA BUG-041, BUG-042):
 *
 *  - `rate_limited`: too many scans; the customer waits and scans again.
 *  - `load_failed`: the QR could not be resolved because a dependency failed.
 *    Nothing is known to be wrong with the QR, so the page asks for a retry
 *    instead of claiming the card is unavailable.
 *  - `paused`: the venue has paused this join QR; existing cards remain open.
 *  - `unavailable`: the QR is unknown or its card is not live.
 *  - `member`: the signed-in customer already holds this card.
 *  - `join`: everyone else, including a member whose membership lookup
 *    failed. The join page reads the membership again and sends a member on
 *    to the stamp screen, so a failed lookup degrades to the join flow rather
 *    than to "This loyalty card is unavailable". Nothing is written on the
 *    way, so the fallback is safe.
 *
 * Every caught failure is reported (the caller logs it with a request id and
 * no PII) instead of being swallowed. Pure: the boundaries are passed in.
 */
export type QrEntryStage = "resolve" | "membership_lookup"

type ResolvedQr = {
  readonly available: boolean
  readonly qrPaused?: boolean
  readonly merchant: { readonly id: string }
}

export type QrEntryOutcome<Q extends ResolvedQr, M> =
  | { readonly kind: "rate_limited" }
  | { readonly kind: "load_failed" }
  | { readonly kind: "unavailable" }
  | { readonly kind: "paused" }
  | { readonly kind: "member"; readonly qrContext: Q; readonly membership: M }
  | { readonly kind: "join"; readonly qrContext: Q }

export type QrEntryBoundaries<Q extends ResolvedQr, M> = {
  readonly resolve: () => Promise<Q | null>
  readonly lookupMembership: (merchantId: string) => Promise<M | null>
  readonly isRateLimited: (error: unknown) => boolean
  readonly report: (stage: QrEntryStage, error: unknown) => void
}

export async function decideQrEntry<Q extends ResolvedQr, M>({
  resolve,
  lookupMembership,
  isRateLimited,
  report,
}: QrEntryBoundaries<Q, M>): Promise<QrEntryOutcome<Q, M>> {
  let qrContext: Q | null
  try {
    qrContext = await resolve()
  } catch (error) {
    // A rate-limited scan is a transient retry, not a dead QR.
    if (isRateLimited(error)) return { kind: "rate_limited" }
    report("resolve", error)
    return { kind: "load_failed" }
  }

  if (!qrContext) return { kind: "unavailable" }
  if (qrContext.qrPaused) return { kind: "paused" }
  if (!qrContext.available) return { kind: "unavailable" }

  let membership: M | null
  try {
    membership = await lookupMembership(qrContext.merchant.id)
  } catch (error) {
    report("membership_lookup", error)
    return { kind: "join", qrContext }
  }

  return membership
    ? { kind: "member", qrContext, membership }
    : { kind: "join", qrContext }
}

/** A failure's category for the log line: never its message, which may carry data. */
export function qrEntryFailureReason(error: unknown): string {
  if (error instanceof Error) {
    return error.name === "Error" ? "error" : error.name
  }
  return "unknown"
}
