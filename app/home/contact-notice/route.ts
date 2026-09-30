import { clearContactNoticeFlash } from "@/lib/customer/contact-notice-flash"
import { noStoreEmpty } from "@/lib/http/no-store-json"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Spends this browser's contact notice once a screen has shown it, so a
 * reload or a later visit never repeats "Mobile number confirmed". It only
 * clears the caller's own short-lived cookie, reads nothing and reveals
 * nothing, and is a route handler so no page re-renders.
 */
export async function POST() {
  await clearContactNoticeFlash()
  return noStoreEmpty(204)
}
