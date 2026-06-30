import "server-only"

export {
  createCustomerSessionCookieValue,
  createPendingEmailCookieValue,
  createPendingPhoneCookieValue,
  readCustomerSessionCookieValue,
  readPendingEmailCookieValue,
  readPendingPhoneCookieValue,
} from "@/lib/customer/session-cookie-core"
export type {
  CookieReadResult,
  CustomerSessionPayload,
  PendingEmailPayload,
  PendingPhonePayload,
  PendingPhonePurpose,
} from "@/lib/customer/session-cookie-core"
