import { REFERRAL_BONUS_STAMP_LABEL } from "@/lib/customer/card-stamp-labels"
import type { CustomerBlockReason } from "@/lib/customer/experience/block-reasons"
import type {
  SelfStampActionState,
  SelfStampBlockedDetail,
} from "@/lib/customer/self-stamp-action-state"

type IssuedStamp = Extract<SelfStampActionState, { status: "issued" }>

export type StampChoreographyState =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "printing"; result: IssuedStamp }
  | { phase: "confirmed"; result: IssuedStamp }
  | ({ phase: "blocked"; message: string } & SelfStampBlockedDetail)
  | { phase: "unknown" }
  | { phase: "closed" }

export type StampChoreographyEvent =
  | { type: "request_started" }
  | { type: "request_issued"; result: IssuedStamp }
  | ({ type: "request_blocked"; message: string } & SelfStampBlockedDetail)
  | { type: "request_unknown" }
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
 * check said no (or the last code was wrong / malformed and can be retyped).
 * A lockout, or a code entered without any refused scan, offers nothing.
 */
export function venueCodeOffered(
  reason: CustomerBlockReason | undefined
): boolean {
  return (
    reason === "location_out_of_range" ||
    reason === "location_required" ||
    reason === "venue_code_rejected" ||
    reason === "venue_code_format"
  )
}

export function reduceStampChoreography(
  state: StampChoreographyState,
  event: StampChoreographyEvent
): StampChoreographyState {
  switch (event.type) {
    case "request_started":
      return state.phase === "idle" || state.phase === "blocked"
        ? { phase: "checking" }
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
}

/** What the stamp screen needs to render the venue-code fallback, if any. */
export type VenueCodeFallbackView = {
  /** Show the six-digit code input beneath the refusal. */
  venueCodeOffer: boolean
  /** Tries left before a lockout, when the last code was wrong. */
  venueCodeAttemptsRemaining: number | null
  /** ISO time the lockout lifts, when attempts are exhausted. */
  venueCodeLockedUntil: string | null
}

export type StampChoreographyView = VenueCodeFallbackView & {
  displayCurrent: number
  dates: string[]
  slamIndex: number
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
  venueCodeAttemptsRemaining: null,
  venueCodeLockedUntil: null,
}

function venueCodeFallback(
  state: StampChoreographyState
): VenueCodeFallbackView {
  if (state.phase !== "blocked") return NO_FALLBACK
  return {
    venueCodeOffer: venueCodeOffered(state.reason),
    venueCodeAttemptsRemaining: state.attemptsRemaining ?? null,
    venueCodeLockedUntil: state.lockedUntil ?? null,
  }
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

function issuedCopy(
  result: IssuedStamp,
  total: number
): Pick<StampChoreographyView, "announcement" | "statusTitle" | "statusBody"> {
  const complete = total > 0 && result.newStampCount >= total
  const extra = bonusCopy(result.bonusStampsApplied)
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

export function stampChoreographyView(
  state: StampChoreographyState,
  input: StampViewInput
): StampChoreographyView {
  const result = issuedResult(state)
  const displayCurrent = result?.newStampCount ?? input.current
  const cardComplete = input.total > 0 && displayCurrent >= input.total
  const printing = state.phase === "printing"
  const closed = !input.canStamp && state.phase === "idle"
  const fallback = venueCodeFallback(state)

  if (state.phase === "checking") {
    return {
      ...fallback,
      displayCurrent,
      dates: displayDates(input, result),
      slamIndex: -1,
      cardComplete,
      secured: true,
      pending: true,
      confirmed: false,
      ariaBusy: true,
      buttonLabel: "Checking today's stamp",
      announcement: "Checking today's stamp.",
      statusTitle: "Checking today's stamp.",
      statusBody: "Your card stays unchanged until the venue confirms it.",
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
      cardComplete,
      secured: false,
      pending: false,
      confirmed: false,
      ariaBusy: false,
      buttonLabel: "Try today's stamp again",
      announcement: `Stamp not added. ${state.message}`,
      statusTitle: "Stamp not added.",
      statusBody: state.message,
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
    const copy = issuedCopy(result, input.total)
    return {
      ...fallback,
      displayCurrent,
      dates: displayDates(input, result),
      slamIndex: printing ? venueStampIndex(result, input.total) : -1,
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
    cardComplete,
    secured: closed,
    pending: false,
    confirmed: closed,
    ariaBusy: false,
    buttonLabel: closed ? "Stamp added" : "Add today's stamp",
    announcement: "",
    statusTitle: closed
      ? "You're stamped for today."
      : "Ready for today's stamp.",
    statusBody: closed
      ? "Come back on the next UK business day."
      : "Tap the stamp, or press and hold, to print today's mark.",
    rewardUnlocked: input.rewardUnlocked,
    rewardSlammed: false,
  }
}
