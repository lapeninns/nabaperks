import { StatusBanner } from "@/components/loyalty"
import {
  CONTACT_NOTICE_COPY,
  contactNoticeFromParam,
  type ConfirmedContacts,
} from "@/lib/customer/previous-stamps"

/**
 * The confirmation a contact form redirected back with (`?contact=`), for a
 * screen that moved on and unmounted the form: the profile's previous-stamps
 * task, and the reward gate once its phone step is done. Pass the raw search
 * param and what the server says is confirmed now; anything unrecognised, or
 * a flag the server state does not back, shows nothing.
 */
export function ProfileContactNotice({
  value,
  confirmed,
}: {
  value: string | string[] | null | undefined
  confirmed: ConfirmedContacts
}) {
  const notice = contactNoticeFromParam(value, confirmed)
  if (!notice) return null
  const copy = CONTACT_NOTICE_COPY[notice]
  return (
    <div role="status" data-contact-notice={notice}>
      <StatusBanner tone="success" title={copy.title}>
        {copy.body}
      </StatusBanner>
    </div>
  )
}
