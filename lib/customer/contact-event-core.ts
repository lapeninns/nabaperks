/**
 * Pure vocabulary for customer contact and sign-in tracking (Step 0 of email
 * sign-in). No `server-only`, no Supabase, no imports, so the metadata
 * allowlist unit-tests directly and a contract test can read it as source.
 *
 * Metadata is deliberately closed: `method`, `surface` and `reason`, each from
 * a fixed set. Nothing a customer typed (an email, a phone number, a code)
 * can ride along, because free text is never accepted.
 */

export const CUSTOMER_CONTACT_EVENT_NAMES = [
  "customer_email_prompt_viewed",
  "customer_email_prompt_dismissed",
  "customer_email_verification_started",
  "customer_email_verified",
  "customer_contact_conflict",
  "customer_login_code_requested",
  "customer_login_code_send_failed",
  "customer_login_verified",
  "customer_login_no_wallet",
  "join_code_send_failed",
] as const

export type CustomerContactEventName =
  (typeof CUSTOMER_CONTACT_EVENT_NAMES)[number]

/** The two events a browser may report itself; everything else is server-side. */
export const CLIENT_EMAIL_PROMPT_EVENTS = [
  "customer_email_prompt_viewed",
  "customer_email_prompt_dismissed",
] as const

export type ClientEmailPromptEvent = (typeof CLIENT_EMAIL_PROMPT_EVENTS)[number]

export const CONTACT_EVENT_METHODS = ["phone", "email"] as const
export type ContactEventMethod = (typeof CONTACT_EVENT_METHODS)[number]

export const CONTACT_EVENT_SURFACES = [
  "home_prompt",
  "stamp_prompt",
  "profile",
  "reward_gate",
  "home_login",
  "join",
] as const
export type ContactEventSurface = (typeof CONTACT_EVENT_SURFACES)[number]

/** Surfaces that render the email prompt, so the only ones a browser may name. */
export const EMAIL_PROMPT_SURFACES = ["home_prompt", "stamp_prompt"] as const
export type EmailPromptSurface = (typeof EMAIL_PROMPT_SURFACES)[number]

export const CONTACT_EVENT_REASONS = [
  "provider_unavailable",
  "pending_state_failed",
  "email_in_use",
  "phone_in_use",
] as const
export type ContactEventReason = (typeof CONTACT_EVENT_REASONS)[number]

export type ContactEventMetadata = {
  readonly method?: ContactEventMethod
  readonly surface?: ContactEventSurface
  readonly reason?: ContactEventReason
}

function oneOf<T extends string>(
  allowed: readonly T[],
  value: unknown
): T | undefined {
  return typeof value === "string" &&
    (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined
}

/**
 * Reduces any input to the closed metadata shape. Unknown keys are dropped and
 * a known key with a value outside its set is dropped, so the result can only
 * ever hold the fixed vocabulary above.
 */
export function contactEventMetadata(input: unknown): ContactEventMetadata {
  if (!input || typeof input !== "object") return {}
  const source = input as Record<string, unknown>
  const method = oneOf(CONTACT_EVENT_METHODS, source.method)
  const surface = oneOf(CONTACT_EVENT_SURFACES, source.surface)
  const reason = oneOf(CONTACT_EVENT_REASONS, source.reason)
  return {
    ...(method ? { method } : {}),
    ...(surface ? { surface } : {}),
    ...(reason ? { reason } : {}),
  }
}

export function isCustomerContactEventName(
  value: unknown
): value is CustomerContactEventName {
  return oneOf(CUSTOMER_CONTACT_EVENT_NAMES, value) !== undefined
}

export function isClientEmailPromptEvent(
  value: unknown
): value is ClientEmailPromptEvent {
  return oneOf(CLIENT_EMAIL_PROMPT_EVENTS, value) !== undefined
}

export function isEmailPromptSurface(
  value: unknown
): value is EmailPromptSurface {
  return oneOf(EMAIL_PROMPT_SURFACES, value) !== undefined
}
