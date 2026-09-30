import {
  HOME_SETUP_SUGGESTION_DISMISS_KEYS,
  HOME_SETUP_SUGGESTION_KINDS,
  suggestionDismissalActive,
  type HomeSetupSuggestionKind,
} from "@/lib/customer/home-setup-suggestion"

/**
 * A tiny external store over the home suggestions' dismissal flags, read with
 * `useSyncExternalStore` so the client-only value arrives without a hydration
 * flash and without setState in an effect. Browser storage is a per-viewer
 * convenience here: every read and write is wrapped, a blocked or empty store
 * simply shows the suggestion again, and nothing reads it as proof.
 */
const listeners = new Set<() => void>()
/** Dismissals made on this page load, so "Not now" works without storage. */
const sessionDismissed = new Set<HomeSetupSuggestionKind>()

/** The server has no storage: render nothing until the client hydrates. */
export const SUGGESTIONS_UNHYDRATED = "unhydrated"

export function subscribeSuggestionDismissals(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * The dismissed kinds as a stable, comma-joined string: a primitive snapshot,
 * so React sees an unchanged value until a flag actually changes.
 */
export function dismissedSuggestionsSnapshot(): string {
  const now = Date.now()
  return HOME_SETUP_SUGGESTION_KINDS.filter(
    (kind) =>
      sessionDismissed.has(kind) ||
      suggestionDismissalActive(readFlag(kind), now)
  ).join(",")
}

export function unhydratedSuggestionsSnapshot(): string {
  return SUGGESTIONS_UNHYDRATED
}

export function parseDismissedSuggestions(
  snapshot: string
): HomeSetupSuggestionKind[] {
  if (!snapshot || snapshot === SUGGESTIONS_UNHYDRATED) return []
  return HOME_SETUP_SUGGESTION_KINDS.filter((kind) =>
    snapshot.split(",").includes(kind)
  )
}

export function dismissSuggestion(kind: HomeSetupSuggestionKind) {
  sessionDismissed.add(kind)
  try {
    window.localStorage.setItem(
      HOME_SETUP_SUGGESTION_DISMISS_KEYS[kind],
      String(Date.now())
    )
  } catch {
    // Storage can be unavailable; the session set above still hides it
    // until the page is reloaded.
  }
  for (const listener of listeners) listener()
}

function readFlag(kind: HomeSetupSuggestionKind): string | null {
  try {
    return window.localStorage.getItem(HOME_SETUP_SUGGESTION_DISMISS_KEYS[kind])
  } catch {
    return null
  }
}
