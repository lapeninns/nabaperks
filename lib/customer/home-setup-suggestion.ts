/**
 * The one optional setup suggestion the home screen may show.
 *
 * Home shows at most one quiet, dismissible suggestion, chosen by priority
 * (designer brief, section H):
 *
 * 1. A reward is unlocked and needs setup. That is the reward card's own
 *    action ("Get it ready"), not a separate prompt, so no suggestion shows.
 * 2. No confirmed mobile number: "Add your mobile number".
 * 3. Stamps may be saved under another number: "Find my previous stamps".
 * 4. No confirmed email (needed to collect a reward): "Add your email".
 * 5. No date of birth: "Add your birthday".
 *
 * The server supplies the ordered candidates from what it knows; the browser
 * removes the ones this viewer dismissed and shows the first left. Dismissal is
 * a per-viewer convenience kept in browser storage. It is never evidence of
 * anything and never gates a stamp, a reward or a requirement: the reward page
 * still asks for whatever is missing.
 *
 * Pure: no React, no storage, no server imports, so both halves are unit
 * tested directly.
 */

import { PREVIOUS_STAMPS_RETURN_TO } from "@/lib/customer/previous-stamps"

export const HOME_SETUP_SUGGESTION_KINDS = [
  "phone",
  "previous_stamps",
  "email",
  "birthday",
] as const

export type HomeSetupSuggestionKind =
  (typeof HOME_SETUP_SUGGESTION_KINDS)[number]

export type HomeSetupFacts = {
  /** Cards the guest holds. An empty home shows only the scan action. */
  readonly cardCount: number
  /** An unlocked reward is waiting on a detail from the guest. */
  readonly rewardNeedsSetup: boolean
  readonly hasConfirmedPhone: boolean
  readonly hasConfirmedEmail: boolean
  readonly hasBirthday: boolean
}

/**
 * The suggestions that apply to this guest, highest priority first. Empty when
 * the home has no cards or when a reward's own action already owns the slot.
 */
export function homeSetupSuggestionCandidates(
  facts: HomeSetupFacts
): HomeSetupSuggestionKind[] {
  if (facts.cardCount <= 0 || facts.rewardNeedsSetup) return []

  const candidates: HomeSetupSuggestionKind[] = []
  if (!facts.hasConfirmedPhone) {
    candidates.push("phone")
    // Only a guest who joined without a mobile number can have stamps saved
    // under one; adding that number brings them together. Offered as its own
    // task once the plainer "add your number" has been set aside.
    if (facts.hasConfirmedEmail) candidates.push("previous_stamps")
  }
  if (!facts.hasConfirmedEmail) candidates.push("email")
  if (!facts.hasBirthday) candidates.push("birthday")
  return candidates
}

/**
 * The single suggestion to render: the first candidate this viewer has not
 * dismissed, or null. Never more than one.
 */
export function pickHomeSetupSuggestion(
  candidates: readonly HomeSetupSuggestionKind[],
  dismissed: Iterable<HomeSetupSuggestionKind>
): HomeSetupSuggestionKind | null {
  const hidden = new Set(dismissed)
  return candidates.find((kind) => !hidden.has(kind)) ?? null
}

export type HomeSetupSuggestionCopy = {
  readonly title: string
  readonly body: string
  readonly action: string
  readonly href: string
}

/**
 * Copy for the link-style suggestions. The email suggestion is an inline form
 * (`HomeEmailPrompt`) and carries its own copy.
 */
export const HOME_SETUP_SUGGESTION_COPY: Record<
  Exclude<HomeSetupSuggestionKind, "email">,
  HomeSetupSuggestionCopy
> = {
  phone: {
    title: "Add your mobile number",
    body: "You'll need it to collect rewards.",
    action: "Add my number",
    href: "/home/profile#add-phone",
  },
  previous_stamps: {
    title: "Find my previous stamps",
    body: "Had stamps under another mobile number? Confirm that number and we'll bring them here.",
    action: "Find my stamps",
    // The profile's "Find my previous stamps" task (PREVIOUS_STAMPS_RETURN_TO).
    href: PREVIOUS_STAMPS_RETURN_TO,
  },
  birthday: {
    title: "Add your birthday",
    body: "It's one of the details you'll need to collect a reward.",
    action: "Add my birthday",
    href: "/home/profile",
  },
}

/** Browser storage key per suggestion, for the dismissal convenience only. */
export const HOME_SETUP_SUGGESTION_DISMISS_KEYS: Record<
  HomeSetupSuggestionKind,
  string
> = {
  phone: "nabaperks.phone-prompt-dismissed",
  previous_stamps: "nabaperks.previous-stamps-prompt-dismissed",
  // Existing keys, kept so a dismissal made before this change still holds.
  email: "nabaperks.email-prompt-dismissed",
  birthday: "nabaperks.dob-prompt-dismissed",
}

/** A dismissed suggestion may return after this long. */
export const HOME_SETUP_SUGGESTION_RESHOW_AFTER_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Whether a stored dismissal timestamp still hides its suggestion. Missing,
 * malformed or lapsed values show it again.
 */
export function suggestionDismissalActive(
  stored: string | null,
  now: number
): boolean {
  if (!stored) return false
  const dismissedAt = Number(stored)
  if (!Number.isFinite(dismissedAt)) return false
  return now - dismissedAt <= HOME_SETUP_SUGGESTION_RESHOW_AFTER_MS
}
