import { StatusBanner } from "@/components/loyalty"

/**
 * The one QR action-failure banner — previously duplicated (byte-identical
 * string matching) as QrErrorBanner in qr-panel.tsx and QrPanelError in
 * qr-panel-live.tsx, a copy-drift risk. Server actions redirect back with
 * `?error=`; known messages pass through, anything else gets honest generic
 * copy per action family.
 */
export function QrErrorBanner({ error }: { readonly error?: string }) {
  if (!error) return null

  const message =
    error === "Add at least 3 active mystery rewards before launching the QR."
      ? error
      : error === "Unable to update QR"
        ? "Unable to update QR. Check the QR status and try again."
        : "Unable to create QR. Check your card and reward setup, then try again."

  return (
    <StatusBanner tone="error" title="QR action failed.">
      {message}
    </StatusBanner>
  )
}
