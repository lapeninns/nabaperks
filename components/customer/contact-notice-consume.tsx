"use client"

import { useEffect } from "react"

import { CONTACT_NOTICE_CONSUME_PATH } from "@/lib/customer/previous-stamps"

/**
 * Spends the contact notice once it is on screen, so it shows once. A route
 * handler rather than a server action, so clearing the cookie does not
 * re-render the page and take the notice away while it is being read. If the
 * request fails, the cookie still lapses within a minute.
 */
export function ContactNoticeConsume() {
  useEffect(() => {
    void fetch(CONTACT_NOTICE_CONSUME_PATH, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
    }).catch(() => undefined)
  }, [])
  return null
}
