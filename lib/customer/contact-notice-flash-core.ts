import {
  createEncryptedPendingCookieValue,
  readEncryptedPendingCookieValue,
  type EncryptedPendingCookieReadResult,
} from "@/lib/customer/pending-cookie-crypto"
import {
  isContactNotice,
  type ContactNotice,
} from "@/lib/customer/previous-stamps"

/**
 * The outcome of a contact confirmation ("Mobile number confirmed", "Your
 * stamps are together now"), carried from the server action that proved it
 * to the screen it redirects back to. Only the server can mint it: the value
 * is encrypted and authenticated with the customer session secret, names the
 * customer and the path it is for, lasts a minute, and is cleared once shown
 * (`lib/customer/contact-notice-flash.ts`). A URL parameter never renders a
 * notice.
 */
export const CONTACT_NOTICE_COOKIE_NAME = "nabaperks_contact_notice"
export const CONTACT_NOTICE_TTL_SECONDS = 60

export type ContactNoticeFlashPayload = {
  readonly version: 1
  readonly customerId: string
  readonly notice: ContactNotice
  readonly pathname: string
  readonly issuedAt: number
  readonly expiresAt: number
}

export function createContactNoticeCookieValue(
  payload: ContactNoticeFlashPayload,
  secret: string
): string {
  return createEncryptedPendingCookieValue({
    payload,
    secret,
    context: "contact-notice",
  })
}

export function readContactNoticeCookieValue(
  value: string,
  secret: string,
  nowSeconds: number
): EncryptedPendingCookieReadResult<ContactNoticeFlashPayload> {
  return readEncryptedPendingCookieValue({
    value,
    secret,
    context: "contact-notice",
    nowSeconds,
    parse: parseContactNoticeFlashPayload,
  })
}

/**
 * The notice for this customer on this screen, or null: a missing, forged,
 * expired or another customer's or another screen's value shows nothing.
 */
export function contactNoticeForViewer(
  value: string | undefined,
  viewer: { readonly customerId: string | null; readonly pathname: string },
  secret: string,
  nowSeconds: number
): ContactNotice | null {
  if (!value || !viewer.customerId) return null
  const result = readContactNoticeCookieValue(value, secret, nowSeconds)
  if (!result.ok) return null
  const { payload } = result
  return payload.customerId === viewer.customerId &&
    payload.pathname === viewer.pathname
    ? payload.notice
    : null
}

function parseContactNoticeFlashPayload(
  value: unknown
): ContactNoticeFlashPayload | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null
  }
  const record = value as Record<string, unknown>
  const { version, customerId, notice, pathname, issuedAt, expiresAt } = record
  if (version !== 1) return null
  if (typeof customerId !== "string" || !customerId) return null
  if (!isContactNotice(notice)) return null
  if (typeof pathname !== "string" || !pathname.startsWith("/")) return null
  if (typeof issuedAt !== "number" || typeof expiresAt !== "number") {
    return null
  }
  return { version, customerId, notice, pathname, issuedAt, expiresAt }
}
