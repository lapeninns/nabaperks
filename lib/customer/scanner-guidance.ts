/**
 * Per-status guidance for the in-app QR scanner. Pure so the secondary copy and
 * the retry decision are unit-testable, away from the camera lifecycle.
 *
 * - `detail` is the calm secondary line shown under the live status, or `null`.
 * - `showRetry` gates the "Try the camera again" control.
 */
export type ScannerStatusKind =
  | "idle"
  | "scanning"
  | "decoded"
  | "invalid"
  | "camera-error"

export type ScannerGuidance = {
  readonly detail: string | null
  readonly showRetry: boolean
}

// The printed venue QR works with any native camera, so the denied state
// offers that path instead of dead-ending on the permission (CUS-P3-12).
const CAMERA_ERROR_DETAIL =
  "We could not open your camera. Allow camera access, then try again. Or scan the venue QR with your phone's camera app."

const INVALID_DETAIL =
  "Point your camera at the venue QR on the table or counter."

export function scannerGuidance(kind: ScannerStatusKind): ScannerGuidance {
  if (kind === "camera-error") {
    return { detail: CAMERA_ERROR_DETAIL, showRetry: true }
  }

  if (kind === "invalid") {
    return { detail: INVALID_DETAIL, showRetry: false }
  }

  return { detail: null, showRetry: false }
}
