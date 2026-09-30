import "server-only"

import { cookies } from "next/headers"

import {
  CONTACT_NOTICE_COOKIE_NAME,
  CONTACT_NOTICE_TTL_SECONDS,
  contactNoticeForViewer,
  createContactNoticeCookieValue,
} from "@/lib/customer/contact-notice-flash-core"
import {
  contactNoticeReturn,
  type ContactNotice,
} from "@/lib/customer/previous-stamps"
import { readCustomerSessionCookieValue } from "@/lib/customer/session-cookie"
import {
  CUSTOMER_SESSION_COOKIE,
  persistentCookieOptions,
} from "@/lib/http/persistent-cookie-options"
import { logger } from "@/lib/observability/logger"
import { requiredCustomerSessionSecret } from "@/lib/security/customer-session-secret"

function nowSeconds(): number {
  return Math.floor(Date.now() / 1_000)
}

/**
 * Called by the server action that just confirmed the contact (and linked any
 * wallets): records the outcome for the screen at `returnTo` and returns the
 * validated path to redirect to. The notice is bound to the signed-in
 * customer read from the session cookie as it stands now, because a wallet
 * link re-issues that cookie for the surviving card within this same action.
 * Without a session nothing is recorded, and the guest simply sees no notice.
 */
export async function setContactNoticeFlash(
  notice: ContactNotice,
  returnTo: string
): Promise<string> {
  const target = contactNoticeReturn(returnTo)
  try {
    const cookieStore = await cookies()
    const secret = requiredCustomerSessionSecret()
    const issuedAt = nowSeconds()
    const session = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value
    const read = session
      ? readCustomerSessionCookieValue(session, secret, issuedAt)
      : null
    if (read?.ok) {
      cookieStore.set(
        CONTACT_NOTICE_COOKIE_NAME,
        createContactNoticeCookieValue(
          {
            version: 1,
            customerId: read.payload.customerId,
            notice,
            pathname: target.pathname,
            issuedAt,
            expiresAt: issuedAt + CONTACT_NOTICE_TTL_SECONDS,
          },
          secret
        ),
        persistentCookieOptions(CONTACT_NOTICE_TTL_SECONDS)
      )
    }
  } catch {
    // Best effort: the contact is confirmed either way; only the notice is lost.
    logger.warn("customer_contact_notice_record_failed", { notice })
  }
  return target.href
}

/** Read-only, so a page render may call it. */
export async function readContactNoticeFlash(viewer: {
  readonly customerId: string | null
  readonly pathname: string
}): Promise<ContactNotice | null> {
  const cookieStore = await cookies()
  return contactNoticeForViewer(
    cookieStore.get(CONTACT_NOTICE_COOKIE_NAME)?.value,
    viewer,
    requiredCustomerSessionSecret(),
    nowSeconds()
  )
}

/** Spends the notice once shown (route handler or server action only). */
export async function clearContactNoticeFlash(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(CONTACT_NOTICE_COOKIE_NAME)
}
