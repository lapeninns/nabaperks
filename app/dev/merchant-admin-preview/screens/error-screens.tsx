"use client"

import AdminError from "@/app/admin/error"
import MerchantError from "@/app/app/error"

/**
 * Error-state preview bodies for the merchant/admin console harness. They render
 * the real route error boundaries (`app/app/error.tsx`, `app/admin/error.tsx`)
 * with a fixed mock error and a no-op `reset`, so the screenshot/a11y specs can
 * prove the recovery UI is mobile-clean (Wet Ink, reachable recovery action, no
 * overflow) inside the shell. The boundaries import no server-only code.
 *
 * Client-only: the boundaries take a `reset` function prop, which cannot cross a
 * server-component boundary. `reset` is a no-op here — the preview never recovers
 * from a real error; it only captures the resting error state.
 */

const PREVIEW_ERROR = new Error(
  "Preview error state — no real failure occurred"
)

function noop() {}

export function MerchantErrorScreen() {
  return <MerchantError error={PREVIEW_ERROR} reset={noop} />
}

export function AdminErrorScreen() {
  return <AdminError error={PREVIEW_ERROR} reset={noop} />
}
