import {
  LOCATION_ISSUE_COPY,
  type StampLocationIssue,
} from "@/lib/customer/stamp-location-recovery"
import { REFERRAL_BONUS_STAMP_LABEL } from "@/lib/customer/card-stamp-labels"
import type { CustomerBlockReason } from "@/lib/customer/experience/block-reasons"
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
 * location problem, and re-offering "Use my location" there abandons the code
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
  /** Unverified stamps still available, from the page payload, if known. */
  unverifiedGraceRemaining?: number
}

/** What the stamp screen needs to render the venue-code fallback, if any. */
export type VenueCodeFallbackView = {
  /** The six-digit code may be entered (idle on a verified visit, or after a refusal it answers). */
  venueCodeOffer: boolean
  /** Show "Use my location" / "Enter venue code" instead of the stamp press. */
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
    ? " 1 banked bonus stamp was added too."
    : ` ${count} banked bonus stamps were added too.`
}

function venueStampIndex(result: IssuedStamp, total: number): number {
  const bonusCount = Math.max(result.bonusStampsApplied, 0)
  const beforeVenueStamp = result.newStampCount - bonusCount - 1
  return Math.min(Math.max(beforeVenueStamp, 0), Math.max(total - 1, 0))
}

/**
 * How the visit was confirmed, when that is worth saying. A code-confirmed
 * stamp says so; an unverified one says so and, when the page knew the grace,
 * how many more the venue will take without a location check.
 */
function verificationCopy(
  result: IssuedStamp,
  unverifiedGraceRemaining: number | undefined
): string {
  if (result.verification === "venue_code") {
    return " Confirmed using today's venue code."
  }
  if (result.verification !== "unverified") return ""
  if (unverifiedGraceRemaining === undefined) {
    return " Added without a location check."
  }
  const left = Math.max(unverifiedGraceRemaining - 1, 0)
  if (left === 0) {
    return " Added without a location check. Next time, location or the venue code is needed."
  }
  return left === 1
    ? " Added without a location check. 1 more can be added without one."
    : ` Added without a location check. ${left} more can be added without one.`
}

function issuedCopy(
  result: IssuedStamp,
  total: number,
  unverifiedGraceRemaining: number | undefined
): Pick<StampChoreographyView, "announcement" | "statusTitle" | "statusBody"> {
  const complete = total > 0 && result.newStampCount >= total
  const extra =
    bonusCopy(result.bonusStampsApplied) +
    verificationCopy(result, unverifiedGraceRemaining)
  if (complete) {
    return {
      announcement:
        "Stamp added. That's the full card, your reward is unlocked.",
      statusTitle: "That's the full card.",
      statusBody: `Your reward is unlocked.${extra}`,
    }
  }

  const remaining = Math.max(total - result.newStampCount, 0)
  return {
    announcement: `Stamp added. That's ${result.newStampCount} of ${total}.`,
    statusTitle: `Stamp ${result.newStampCount} of ${total} added.`,
    statusBody: `${remaining} to go. Your next scan window opens on the next UK business day.${extra}`,
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

  // The browser is being asked for a fix. Nothing has been sent, so the card
  // does not ink and the venue code stays open; only the band says what is
  // happening and that the permission sheet, if any, is the thing to answer.
  if (
    input.acquiringLocation &&
    (state.phase === "idle" || state.phase === "blocked") &&
    input.canStamp
  ) {
    return {
      ...fallback,
      displayCurrent,
      dates: displayDates(input, result),
      slamIndex: -1,
      pendingIndex: -1,
      cardComplete,
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
      rewardSlammed: false,
    }
  }

  if (state.phase === "checking") {
    const pendingIndex = pendingSlotIndex(input, state.startedCurrent)
    return {
      ...fallback,
      displayCurrent,
      dates: displayDates(input, result),
      slamIndex: -1,
      pendingIndex,
      cardComplete,
      secured: true,
      pending: true,
      confirmed: false,
      ariaBusy: true,
      buttonLabel: "Checking today's stamp",
      announcement: "Checking today's stamp.",
      statusTitle: "Checking today's stamp.",
      statusBody:
        pendingIndex >= 0
          ? `Slot ${pendingIndex + 1} is inking. It lands once the venue confirms.`
          : "It lands once the venue confirms.",
      rewardUnlocked: false,
      rewardSlammed: false,
    }
  }

  if (state.phase === "blocked") {
    return {
      ...fallback,
      displayCurrent,
      dates: displayDates(input, result),
      slamIndex: -1,
      pendingIndex: -1,
      cardComplete,
      secured: false,
      pending: false,
      confirmed: false,
      ariaBusy: false,
      buttonLabel: "Try today's stamp again",
      announcement: `Stamp not added. ${state.locationIssue ? `${LOCATION_ISSUE_COPY[state.locationIssue].title}. ` : ""}${state.message}`,
      statusTitle: state.locationIssue
        ? LOCATION_ISSUE_COPY[state.locationIssue].title
        : state.reason === "location_out_of_range"
          ? "You appear to be outside the pub"
          : "Stamp not added.",
      statusBody: blockedBody(state, fallback),
      rewardUnlocked: false,
      rewardSlammed: false,
    }
  }

  if (state.phase === "unknown") {
    return {
      ...fallback,
      displayCurrent,
      dates: displayDates(input, result),
      slamIndex: -1,
      pendingIndex: -1,
      cardComplete,
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
      rewardSlammed: false,
    }
  }

  if (state.phase === "closed") {
    return {
      ...fallback,
      displayCurrent,
      dates: displayDates(input, result),
      slamIndex: -1,
      pendingIndex: -1,
      cardComplete,
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
      rewardSlammed: false,
    }
  }

  if (result) {
    const copy = issuedCopy(result, input.total, input.unverifiedGraceRemaining)
    return {
      ...fallback,
      displayCurrent,
      dates: displayDates(input, result),
      slamIndex: printing ? venueStampIndex(result, input.total) : -1,
      pendingIndex: -1,
      cardComplete,
      secured: true,
      pending: false,
      confirmed: true,
      ariaBusy: printing,
      buttonLabel: "Stamp added",
      ...copy,
      rewardUnlocked: result.rewardUnlocked || input.rewardUnlocked,
      rewardSlammed: printing && cardComplete && result.rewardUnlocked,
    }
  }

  if (closed && input.rewardUnlocked) {
    return {
      ...fallback,
      displayCurrent,
      dates: displayDates(input, result),
      slamIndex: -1,
      pendingIndex: -1,
      cardComplete,
      secured: true,
      pending: false,
      confirmed: true,
      ariaBusy: false,
      buttonLabel: "Reward unlocked",
      announcement: "",
      statusTitle: "That's the full card.",
      statusBody: "Your reward is ready to open.",
      rewardUnlocked: true,
      rewardSlammed: false,
    }
  }

  return {
    ...fallback,
    displayCurrent,
    dates: displayDates(input, result),
    slamIndex: -1,
    pendingIndex: -1,
    cardComplete,
    secured: closed,
    pending: false,
    confirmed: closed,
    ariaBusy: false,
    buttonLabel: closed ? "Stamp added" : "Add today's stamp",
    announcement: "",
    statusTitle: closed
      ? "You're stamped for today."
      : fallback.locationControls
        ? "Confirm you're at the venue."
        : "Ready for today's stamp.",
    statusBody: closed
      ? "Come back on the next UK business day."
      : fallback.locationControls
        ? "Use your phone's location, or enter today's code from a team member."
        : "Tap the stamp, or press and hold, to print today's mark.",
    rewardUnlocked: input.rewardUnlocked,
    rewardSlammed: false,
  }
}
