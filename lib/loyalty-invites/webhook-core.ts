/**
 * Pure mapping of a Resend webhook payload to the loyalty-invite delivery event
 * the database understands (no server-only, no Supabase — unit-tested directly).
 * Signature verification is handled separately by verifyStandardWebhook.
 *
 * Resend emits `email.*` events with the provider message id in `data.email_id`.
 * We only act on the delivery-outcome events; sent/opened/clicked/delayed are
 * acknowledged but ignored (invitation "opened" is a link visit, not an email
 * open, so tracking-pixel opens are deliberately not consumed).
 */

export type LoyaltyInviteDeliveryEvent =
  | "delivered"
  | "bounced"
  | "complained"
  | "failed"

const EVENT_MAP: Readonly<Record<string, LoyaltyInviteDeliveryEvent>> = {
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.failed": "failed",
}

export type ParsedResendDeliveryEvent = {
  readonly providerMessageId: string
  readonly event: LoyaltyInviteDeliveryEvent
}

export function parseResendDeliveryEvent(
  payload: unknown
): ParsedResendDeliveryEvent | null {
  if (!payload || typeof payload !== "object") return null
  const record = payload as { type?: unknown; data?: unknown }

  const type = typeof record.type === "string" ? record.type : ""
  const event = EVENT_MAP[type]
  if (!event) return null

  const data = record.data
  const emailId =
    data && typeof data === "object" && "email_id" in data
      ? (data as { email_id?: unknown }).email_id
      : undefined
  if (typeof emailId !== "string" || emailId.trim() === "") return null

  return { providerMessageId: emailId, event }
}
