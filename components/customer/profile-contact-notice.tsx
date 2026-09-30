import { ContactNoticeConsume } from "@/components/customer/contact-notice-consume"
import { StatusBanner } from "@/components/loyalty"
import {
  CONTACT_NOTICE_COPY,
  contactNoticeBacked,
  type ConfirmedContacts,
  type ContactNotice,
} from "@/lib/customer/previous-stamps"

/**
 * The confirmation a contact action sent back, for a screen that moved on and
 * unmounted the form: the profile's previous-stamps task, and the reward gate
 * once its phone step is done. `notice` is the server-proven outcome read from
 * the one-time cookie (`readContactNoticeFlash`), never a URL parameter; a
 * notice the current server state does not back still shows nothing. With
 * `consume`, the shown notice is spent so it appears once.
 */
export function ProfileContactNotice({
  notice,
  confirmed,
  consume = false,
}: {
  notice: ContactNotice | null
  confirmed: ConfirmedContacts
  consume?: boolean
}) {
  if (!notice || !contactNoticeBacked(notice, confirmed)) return null
  const copy = CONTACT_NOTICE_COPY[notice]
  return (
    <div role="status" data-contact-notice={notice}>
      <StatusBanner tone="success" title={copy.title}>
        {copy.body}
      </StatusBanner>
      {consume ? <ContactNoticeConsume /> : null}
    </div>
  )
}
