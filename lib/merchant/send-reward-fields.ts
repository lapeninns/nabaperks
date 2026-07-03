/**
 * Pure validation for the merchant "send a reward" form (dialog + page). No
 * server-only / Supabase imports so it unit-tests directly. The UI restricts
 * expiry to a fixed set; the DB RPC accepts the wider 1–365 range.
 */

export const SEND_REWARD_EXPIRY_OPTIONS = [7, 14, 30, 60, 90] as const

export const DEFAULT_SEND_REWARD_EXPIRY_DAYS = 30

// Uniform success — never reveals whether a typed contact is already a member.
export const SEND_REWARD_SUCCESS =
  "Reward sent. If they're new to Nabaperks, it'll be waiting when they join."

export type SendRewardInput = {
  membershipId?: string
  contact?: string
  rewardName: string
  rewardTerms: string
  expiresInDays: string
  message?: string
}

export type SendRewardErrors = {
  contact?: string
  rewardName?: string
  rewardTerms?: string
  expiresInDays?: string
  message?: string
  form?: string
}

export type SendRewardValidation = {
  errors: SendRewardErrors
  /** Parsed expiry (null when invalid). */
  expiresInDays: number | null
}

export function validateSendRewardFields(
  input: SendRewardInput
): SendRewardValidation {
  const errors: SendRewardErrors = {}
  const name = input.rewardName.trim()
  const terms = input.rewardTerms.trim()
  const message = (input.message ?? "").trim()
  const hasMember = Boolean(input.membershipId?.trim())
  const contact = (input.contact ?? "").trim()

  if (!hasMember && !contact) {
    errors.contact = "Enter the member's email or phone."
  }

  if (!name) {
    errors.rewardName = "Enter the reward name."
  } else if (name.length > 100) {
    errors.rewardName = "Use 100 characters or fewer."
  }

  if (!terms) {
    errors.rewardTerms = "Enter clear reward terms."
  } else if (terms.length < 12) {
    errors.rewardTerms = "Add enough detail for the member to understand it."
  } else if (terms.length > 500) {
    errors.rewardTerms = "Use 500 characters or fewer."
  }

  const expiresInDays = /^\d+$/.test(input.expiresInDays)
    ? Number.parseInt(input.expiresInDays, 10)
    : null
  if (
    expiresInDays === null ||
    !(SEND_REWARD_EXPIRY_OPTIONS as readonly number[]).includes(expiresInDays)
  ) {
    errors.expiresInDays = "Choose a valid expiry."
  }

  if (message.length > 200) {
    errors.message = "Use 200 characters or fewer."
  }

  return { errors, expiresInDays }
}

export function hasSendRewardErrors(errors: SendRewardErrors): boolean {
  return Object.keys(errors).length > 0
}
