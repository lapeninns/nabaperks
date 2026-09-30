import {
  LOCATION_ISSUE_COPY,
  type StampLocationIssue,
} from "@/lib/customer/stamp-location-recovery"
import {
  FULL_CARD_REWARD_PENDING_COPY,
  REFERRAL_BONUS_STAMP_LABEL,
} from "@/lib/customer/card-stamp-labels"
import {
  blockReasonTitle,
  type CustomerBlockReason,
} from "@/lib/customer/experience/block-reasons"
import { nextStampLine } from "@/lib/customer/experience/next-stamp"
import type {
  SelfStampActionState,
  SelfStampBlockedDetail,
} from "@/lib/customer/self-stamp-action-state"

type IssuedStamp = Extract<SelfStampActionState, { status: "issued" }>

export type StampChoreographyState =
  | { phase: "idle" }
  | {
      phase: "checking"
      /**
       * The card count when the request went out. The inking slot is derived
       * from this snapshot, not the live props: the stamp action revalidates
       * the card path before it returns, so props can advance mid-request and
       * the live count would point the wet outline at the *next* slot.
       */
      startedCurrent?: number
    }
  | { phase: "printing"; result: IssuedStamp }
  | { phase: "confirmed"; result: IssuedStamp }
  | ({
      phase: "blocked"
      message: string
      locationIssue?: StampLocationIssue
    } & SelfStampBlockedDetail)
  | { phase: "unknown" }
  | { phase: "closed" }

export type StampChoreographyEvent =
  | { type: "request_started"; current?: number }
  | { type: "request_issued"; result: IssuedStamp }
  | ({ type: "request_blocked"; message: string } & SelfStampBlockedDetail)
  | { type: "request_unknown" }
  /**
   * The phone offered recovery before spending a request: the capture was
   * missing or imprecise. Nothing was sent, so this lands from idle or
   * from an earlier block, never from an in-flight request.
   */
  | { type: "capture_refused"; message: string; issue?: StampLocationIssue }
  | { type: "readback_issued"; result: IssuedStamp }
  | { type: "readback_closed" }
  | { type: "print_settled" }

export const initialStampChoreographyState: StampChoreographyState = {
  phase: "idle",
}

export function readbackBonusStampsApplied(
  previousCurrent: number,
  current: number
): number {
  return Math.max(current - previousCurrent - 1, 0)
}

/**
 * Whether a refusal is one the venue-code fallback can answer: the location
 * check said no (server-side, or on the phone before a request was spent),
 * the stamp path is throttled (the code has its own throttle, so it is the
 * way past a burst of failed location taps), or the last code was wrong /
 * malformed and can be retyped. Only a lockout withholds it.
 */
export function venueCodeOffered(
  reason: CustomerBlockReason | undefined
): boolean {
  return (
    reason === "location_out_of_range" ||
    reason === "location_required" ||
    reason === "location_blocked" ||
    reason === "rate_limited" ||
    reason === "venue_code_rejected" ||
    reason === "venue_code_format"
  )
}

/**
 * Whether the refusal is one that a fresh location reading could answer.
 * Narrower than venueCodeOffered: a mistyped or rejected code is not a
 * location problem, and re-offering "Share my location" there abandons the code
 * the customer was mid-way through entering.
 */
export function locationRetryOffered(
  reason: CustomerBlockReason | undefined
): boolean {
  return (
    reason === "location_out_of_range" ||
    reason === "location_required" ||
    reason === "location_blocked"
  )
}

export function reduceStampChoreography(
  state: StampChoreographyState,
  event: StampChoreographyEvent
): StampChoreographyState {
  switch (event.type) {
    case "request_started":
      return state.phase === "idle" || state.phase === "blocked"
        ? { phase: "checking", startedCurrent: event.current }
        : state
    case "request_issued":
      return state.phase === "checking"
        ? { phase: "printing", result: event.result }
        : state
    case "request_blocked":
      return state.phase === "checking" || state.phase === "unknown"
        ? {
            phase: "blocked",
            message: event.message,
            reason: event.reason,
            attemptsRemaining: event.attemptsRemaining,
            lockedUntil: event.lockedUntil,
          }
        : state
    case "request_unknown":
      return state.phase === "checking" ? { phase: "unknown" } : state
    case "capture_refused":
      return state.phase === "idle" || state.phase === "blocked"
        ? {
            phase: "blocked",
            message: event.message,
            reason: "location_blocked",
            locationIssue: event.issue,
          }
        : state
    case "readback_issued":
      return state.phase === "unknown"
        ? { phase: "printing", result: event.result }
        : state
    case "readback_closed":
      return state.phase === "unknown" ? { phase: "closed" } : state
    case "print_settled":
      return state.phase === "printing"
        ? { phase: "confirmed", result: state.result }
        : state
  }
}

type StampViewInput = {
  canStamp: boolean
  current: number
  total: number
  stampDates: string[]
  todayLabel: string
  rewardUnlocked: boolean
  /**
   * This visit has to confirm location (visit three onwards at a venue with
   * the check on). The press is replaced by the location / venue-code pair,
   * and the code is offered before any refusal.
   */
  verificationRequired?: boolean
  /** The browser is being asked for a fix; nothing has been sent yet. */
  acquiringLocation?: boolean
  /** The venue, for the location and refusal headlines ("the venue" if absent). */
  venueName?: string
  /**
   * When the stamp after this visit's opens (ISO instant), from the server.
   * Absent or null: the quiet line says "on your next visit" instead.
   */
  nextStampFrom?: string | null
}

/**
 * The screen's own headline and support line once a stamp has landed on this
 * visit. The stamp result owns the screen (S2/S3): the shell swaps to these
 * and nothing else is asked of the guest.
 */
export type StampOutcome = {
  headline: string
  supportLine: string
}

/** What the stamp screen needs to render the venue-code fallback, if any. */
export type VenueCodeFallbackView = {
  /** The six-digit code may be entered (idle on a verified visit, or after a refusal it answers). */
  venueCodeOffer: boolean
  /** Show "Share my location" / "Enter the venue code instead" in place of the stamp press. */
  locationControls: boolean
  /** Tries left before a lockout, when the last code was wrong. */
  venueCodeAttemptsRemaining: number | null
  /** ISO time the lockout lifts, when attempts are exhausted. */
  venueCodeLockedUntil: string | null
}

export type StampChoreographyView = VenueCodeFallbackView & {
  displayCurrent: number
  dates: string[]
  slamIndex: number
  /**
   * The slot that is inking while the request is in flight, or -1. It renders
   * as a wet outline, never as an earned stamp: `displayCurrent` does not move
   * until the server says so (F10), but the press gets an immediate, honest
   * answer on the card instead of only on the button.
   */
  pendingIndex: number
  cardComplete: boolean
  secured: boolean
  pending: boolean
  confirmed: boolean
  ariaBusy: boolean
  buttonLabel: string
  announcement: string
  statusTitle: string
  statusBody: string
  /** The receipt fact in the band ("4 OF 8") once a stamp is on the card. */
  statusReceipt: string | null
  /** Headline and support for the screen, only once a stamp has landed. */
  outcome: StampOutcome | null
  rewardUnlocked: boolean
  rewardSlammed: boolean
}

const NO_FALLBACK: VenueCodeFallbackView = {
  venueCodeOffer: false,
  locationControls: false,
  venueCodeAttemptsRemaining: null,
  venueCodeLockedUntil: null,
}

function venueCodeFallback(
  state: StampChoreographyState,
  input: StampViewInput
): VenueCodeFallbackView {
  const verificationRequired = Boolean(input.verificationRequired)
  if (state.phase === "idle") {
    if (!input.canStamp || !verificationRequired) return NO_FALLBACK
    return {
      venueCodeOffer: true,
      locationControls: true,
      venueCodeAttemptsRemaining: null,
      venueCodeLockedUntil: null,
    }
  }
  if (state.phase !== "blocked") return NO_FALLBACK
  const lockedOut = state.reason === "venue_code_locked"
  return {
    venueCodeOffer: venueCodeOffered(state.reason),
    locationControls:
      !lockedOut &&
      (verificationRequired || locationRetryOffered(state.reason)),
    venueCodeAttemptsRemaining: state.attemptsRemaining ?? null,
    venueCodeLockedUntil: state.lockedUntil ?? null,
  }
}

/**
 * The slot the in-flight stamp would land in, anchored to the count captured
 * when the request started. Once the live count has moved past that snapshot
 * the stamp has landed server-side and there is nothing left to ink.
 */
function pendingSlotIndex(
  input: StampViewInput,
  startedCurrent: number | undefined
): number {
  const anchor = startedCurrent ?? input.current
  if (input.total <= 0 || anchor >= input.total) return -1
  if (input.current > anchor) return -1
  return Math.max(anchor, 0)
}

function issuedResult(state: StampChoreographyState): IssuedStamp | undefined {
  return state.phase === "printing" || state.phase === "confirmed"
    ? state.result
    : undefined
}

function displayDates(
  input: StampViewInput,
  result: IssuedStamp | undefined
): string[] {
  if (!result) return input.stampDates.slice(0, input.current)

  const missing = Math.max(result.newStampCount - input.stampDates.length, 0)
  const bonusCount = Math.min(Math.max(result.bonusStampsApplied, 0), missing)
  const venueCount = missing - bonusCount

  return [
    ...input.stampDates,
    ...Array.from({ length: venueCount }, () => input.todayLabel),
    ...Array.from({ length: bonusCount }, () => REFERRAL_BONUS_STAMP_LABEL),
  ]
}

function bonusCopy(count: number): string {
  if (count <= 0) return ""
  return count === 1
    ? " Your bonus stamp was added too."
    : ` ${count} bonus stamps were added too.`
}

function remainingLine(remaining: number): string {
  return `${remaining} more to your reward.`
}

/** Receipt voice: a fact, mono and upper case on screen ("4 OF 8"). */
function receiptLine(count: number, total: number): string | null {
  if (total <= 0) return null
  return `${Math.min(Math.max(count, 0), total)} OF ${total}`
}

const FULL_CARD_HEADLINE = "Your card is full."
const OPEN_REWARD_LINE = "Open your reward to see when you can collect it."

function venueStampIndex(result: IssuedStamp, total: number): number {
  const bonusCount = Math.max(result.bonusStampsApplied, 0)
  const beforeVenueStamp = result.newStampCount - bonusCount - 1
  return Math.min(Math.max(beforeVenueStamp, 0), Math.max(total - 1, 0))
}

/**
 * The stamp result, which owns the screen (brief S2/S3). It confirms the
 * stamp, the updated progress and what is left, then one quiet line for when
 * the next stamp opens. How the visit was confirmed (location, venue code, or
 * one of the stamps a venue allows without a location check) is not repeated
 * here: the guest already did it, and the server keeps the record.
 */
function issuedCopy(
  result: IssuedStamp,
  total: number,
  nextStampFrom: string | null | undefined
): Pick<
  StampChoreographyView,
  "announcement" | "statusTitle" | "statusBody" | "statusReceipt" | "outcome"
> {
  const complete = total > 0 && result.newStampCount >= total
  const bonus = bonusCopy(result.bonusStampsApplied)
  const statusReceipt = receiptLine(result.newStampCount, total)
  // The card is full but the server issued no reward behind the final stamp
  // (reward_unlocked is false). Confirm the stamp and the full card, never an
  // unlock; the reward itself is sorted server-side.
  if (complete && !result.rewardUnlocked) {
    return {
      announcement: `Stamp added. ${FULL_CARD_HEADLINE} ${FULL_CARD_REWARD_PENDING_COPY}`,
      statusTitle: FULL_CARD_HEADLINE,
      statusBody: "Your stamps are safe.",
      statusReceipt,
      outcome: {
        headline: FULL_CARD_HEADLINE,
        supportLine: `${FULL_CARD_REWARD_PENDING_COPY}${bonus}`,
      },
    }
  }
  if (complete) {
    return {
      announcement: `Stamp added. ${FULL_CARD_HEADLINE} Your reward is unlocked.`,
      statusTitle: FULL_CARD_HEADLINE,
      statusBody: OPEN_REWARD_LINE,
      statusReceipt,
      outcome: {
        headline: FULL_CARD_HEADLINE,
        supportLine: `Your reward is unlocked.${bonus}`,
      },
    }
  }

  const remaining = Math.max(total - result.newStampCount, 0)
  const supportLine = `${remainingLine(remaining)}${bonus}`
  return {
    announcement: `Stamp added. ${supportLine}`,
    statusTitle: "Stamp added.",
    statusBody: nextStampLine(nextStampFrom),
    statusReceipt,
    outcome: { headline: "Stamp added.", supportLine },
  }
}

/** The refusal band, with the venue code named when it is the way past a throttle. */
function blockedBody(
  state: Extract<StampChoreographyState, { phase: "blocked" }>,
  fallback: VenueCodeFallbackView
): string {
  if (state.reason === "rate_limited" && fallback.venueCodeOffer) {
    return `${state.message} Or enter today's venue code below.`
  }
  return state.message
}

/** Band copy for a refusal: the situation in guest words, then what to do. */
function blockedTitle(
  state: Extract<StampChoreographyState, { phase: "blocked" }>,
  venueName: string | undefined
): string {
  return state.locationIssue
    ? LOCATION_ISSUE_COPY[state.locationIssue].title
    : blockReasonTitle(state.reason, venueName)
}

/**
 * The resting band: ready to stamp (S1), the location check (S4), or today's
 * stamp already on the card (S5), with the full card held when its reward is
 * unlocked (S3 after a reload).
 */
function restingCopy(
  closed: boolean,
  fallback: VenueCodeFallbackView,
  input: StampViewInput
): Pick<
  StampChoreographyView,
  "buttonLabel" | "statusTitle" | "statusBody" | "statusReceipt"
> {
  if (closed && input.rewardUnlocked) {
    return {
      buttonLabel: "Reward unlocked",
      statusTitle: FULL_CARD_HEADLINE,
      statusBody: OPEN_REWARD_LINE,
      statusReceipt: receiptLine(input.current, input.total),
    }
  }
  if (closed) {
    const remaining = Math.max(input.total - input.current, 0)
    return {
      buttonLabel: "Stamp added",
      statusTitle: "You've got today's stamp.",
      statusBody:
        remaining > 0 ? remainingLine(remaining) : "Your stamps are safe.",
      statusReceipt: receiptLine(input.current, input.total),
    }
  }
  if (fallback.locationControls) {
    return {
      buttonLabel: "Stamp my card",
      statusTitle: `We need to check you're at ${input.venueName?.trim() || "the venue"}.`,
      statusBody:
        "Share your location, or ask a team member for today's venue code.",
      statusReceipt: null,
    }
  }
  return {
    buttonLabel: "Stamp my card",
    statusTitle: "Ready for today's stamp.",
    statusBody: "Tap the stamp, or press and hold.",
    statusReceipt: null,
  }
}

export function stampChoreographyView(
  state: StampChoreographyState,
  input: StampViewInput
): StampChoreographyView {
  const result = issuedResult(state)
  const displayCurrent = result?.newStampCount ?? input.current
  const cardComplete = input.total > 0 && displayCurrent >= input.total
  const printing = state.phase === "printing"
  const closed = !input.canStamp && state.phase === "idle"
  const fallback = venueCodeFallback(state, input)
  const common = {
    ...fallback,
    displayCurrent,
    dates: displayDates(input, result),
    slamIndex: -1,
    pendingIndex: -1,
    cardComplete,
    statusReceipt: null,
    outcome: null,
    rewardSlammed: false,
  }

  // The browser is being asked for a fix. Nothing has been sent, so the card
  // does not ink and the venue code stays open; only the band says what is
  // happening and that the permission sheet, if any, is the thing to answer.
  if (
    input.acquiringLocation &&
    (state.phase === "idle" || state.phase === "blocked") &&
    input.canStamp
  ) {
    return {
      ...common,
      secured: false,
      pending: false,
      confirmed: false,
      ariaBusy: true,
      buttonLabel: "Checking location",
      announcement: "Checking your location.",
      statusTitle: "Checking your location.",
      statusBody:
        "Allow location if your phone asks. Or enter today's venue code instead.",
      rewardUnlocked: false,
    }
  }

  if (state.phase === "checking") {
    const pendingIndex = pendingSlotIndex(input, state.startedCurrent)
    return {
      ...common,
      pendingIndex,
      secured: true,
      pending: true,
      confirmed: false,
      ariaBusy: true,
      buttonLabel: "Checking today's stamp",
      announcement: "Checking today's stamp.",
      statusTitle: "Checking today's stamp.",
      statusBody:
        pendingIndex >= 0
          ? `Stamp ${pendingIndex + 1} goes on your card once it's confirmed.`
          : "Your stamp goes on your card once it's confirmed.",
      rewardUnlocked: false,
    }
  }

  if (state.phase === "blocked") {
    const title = blockedTitle(state, input.venueName)
    return {
      ...common,
      secured: false,
      pending: false,
      confirmed: false,
      ariaBusy: false,
      buttonLabel: "Try again",
      announcement: `Stamp not added. ${state.locationIssue ? `${title}. ` : ""}${state.message}`,
      statusTitle: title,
      statusBody: blockedBody(state, fallback),
      rewardUnlocked: false,
    }
  }

  if (state.phase === "unknown") {
    return {
      ...common,
      secured: true,
      pending: true,
      confirmed: false,
      ariaBusy: true,
      buttonLabel: "Checking your card",
      announcement: "We couldn't confirm the result. Checking your card.",
      statusTitle: "Checking your card.",
      statusBody:
        "We couldn't confirm the result. Refresh before trying another stamp.",
      rewardUnlocked: false,
    }
  }

  if (state.phase === "closed") {
    return {
      ...common,
      secured: true,
      pending: false,
      confirmed: false,
      ariaBusy: false,
      buttonLabel: "Card updated",
      announcement: "Card updated. No new stamp was confirmed.",
      statusTitle: "Your card is up to date.",
      statusBody:
        "No new stamp was confirmed. Check your card before trying again.",
      rewardUnlocked: input.rewardUnlocked,
    }
  }

  if (result) {
    return {
      ...common,
      slamIndex: printing ? venueStampIndex(result, input.total) : -1,
      secured: true,
      pending: false,
      confirmed: true,
      ariaBusy: printing,
      buttonLabel: "Stamp added",
      ...issuedCopy(result, input.total, input.nextStampFrom),
      rewardUnlocked: result.rewardUnlocked || input.rewardUnlocked,
      rewardSlammed: printing && cardComplete && result.rewardUnlocked,
    }
  }

  return {
    ...common,
    secured: closed,
    pending: false,
    confirmed: closed,
    ariaBusy: false,
    announcement: "",
    ...restingCopy(closed, fallback, input),
    rewardUnlocked: input.rewardUnlocked,
  }
}
