import "server-only"

export {
  createCustomerSessionCookieValue,
  createPendingAccessRecoveryCookieValue,
  createPendingEmailCookieValue,
  createPendingPhoneCookieValue,
  readCustomerSessionCookieValue,
  readPendingAccessRecoveryCookieValue,
  readPendingEmailCookieValue,
  readPendingPhoneCookieValue,
} from "@/lib/customer/session-cookie-core"
export type {
  CookieReadResult,
  CustomerSessionPayload,
  PendingAccessRecoveryPayload,
  PendingEmailPayload,
  PendingPhonePayload,
  PendingPhonePurpose,
} from "@/lib/customer/session-cookie-core"
