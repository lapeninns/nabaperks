const DAY_MS = 24 * 60 * 60 * 1_000

export const USABLE_PILOT_DAYS = 28
export const MINIMUM_TRIAL_NOTICE_DAYS = 7
export const UNDELIVERED_ROLL_FORWARD_DAYS = 14

export type DeliveryAnchoredTrialInput = {
  readonly deliveredAt: string
  readonly approvedExtensionEnd: string | null
  readonly now: string
}

export type DeliveryAnchoredTrial = {
  readonly pilotStartsAt: string
  readonly basePilotEndsAt: string
  readonly desiredTrialEndsAt: string
}

export class InvalidTrialDateError extends Error {
  readonly field: string

  constructor(field: string) {
    super(`Invalid trial date: ${field}`)
    this.name = "InvalidTrialDateError"
    this.field = field
  }
}

function timestamp(value: string, field: string): number {
  const parsed = new Date(value).getTime()
  if (!Number.isFinite(parsed)) throw new InvalidTrialDateError(field)
  return parsed
}

function addDays(value: number, days: number): number {
  return value + days * DAY_MS
}

export function calculateDeliveryAnchoredTrial(
  input: DeliveryAnchoredTrialInput
): DeliveryAnchoredTrial {
  const deliveredAt = timestamp(input.deliveredAt, "deliveredAt")
  const now = timestamp(input.now, "now")
  const basePilotEnd = addDays(deliveredAt, USABLE_PILOT_DAYS)
  const noticeFloor = addDays(now, MINIMUM_TRIAL_NOTICE_DAYS)
  const extensionEnd = input.approvedExtensionEnd
    ? timestamp(input.approvedExtensionEnd, "approvedExtensionEnd")
    : 0

  return {
    pilotStartsAt: new Date(deliveredAt).toISOString(),
    basePilotEndsAt: new Date(basePilotEnd).toISOString(),
    desiredTrialEndsAt: new Date(
      Math.max(basePilotEnd, noticeFloor, extensionEnd)
    ).toISOString(),
  }
}

export function calculateUndeliveredTrialExtension(now: string): string {
  return new Date(
    addDays(timestamp(now, "now"), UNDELIVERED_ROLL_FORWARD_DAYS)
  ).toISOString()
}

export function isTrialSynchronisable(status: string): boolean {
  return status === "trialing"
}
