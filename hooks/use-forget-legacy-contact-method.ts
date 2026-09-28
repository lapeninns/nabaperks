"use client"

import { useEffect } from "react"

/**
 * An earlier build remembered the sign-in method a device last confirmed, to
 * put it first on the join page. Phone now always leads and nothing reads the
 * key, so the join and login phone forms remove it from browsers that still
 * hold it. Storage can be unavailable; nothing depends on this succeeding.
 */
export const LEGACY_CONTACT_METHOD_KEY = "nabaperks.last-contact-method"

export function useForgetLegacyContactMethod(): void {
  useEffect(() => {
    try {
      window.localStorage.removeItem(LEGACY_CONTACT_METHOD_KEY)
    } catch {
      // Blocked or unavailable storage holds nothing to remove.
    }
  }, [])
}
