import type { GeoCoordinates } from "@/lib/customer/stamp"

/** Postgres `integer` ceiling for `p_capture_elapsed_ms`; larger values would fail the RPC. */
export const MAX_CAPTURE_ELAPSED_MS = 2_147_483_647

/**
 * Parse the stamp form's location fields. The browser is untrusted, so any
 * value outside its physical range is dropped here rather than forwarded:
 * an impossible latitude, longitude or accuracy discards the whole fix, which
 * the stamp RPC then treats exactly like a capture that produced no fix.
 */
export function parseStampLocationForm(
  formData: FormData
): GeoCoordinates | undefined {
  const qrId = formValue(formData, "qrId")
  const locationStatus = formValue(formData, "location_status")
  const fix = validFix(
    formNumber(formData, "latitude"),
    formNumber(formData, "longitude"),
    formNumber(formData, "accuracy_meters")
  )
  const captureElapsedMs = validCaptureElapsedMs(
    formNumber(formData, "capture_elapsed_ms")
  )

  if (
    !qrId &&
    fix.latitude === null &&
    fix.longitude === null &&
    fix.accuracyMeters === null &&
    !locationStatus &&
    captureElapsedMs === null
  ) {
    return undefined
  }

  return {
    qrId: qrId || null,
    ...fix,
    locationStatus: locationStatus || null,
    captureElapsedMs,
  }
}

type LocationFix = {
  readonly latitude: number | null
  readonly longitude: number | null
  readonly accuracyMeters: number | null
}

const NO_FIX: LocationFix = {
  latitude: null,
  longitude: null,
  accuracyMeters: null,
}

function validFix(
  latitude: number | null,
  longitude: number | null,
  accuracyMeters: number | null
): LocationFix {
  if (latitude === null || longitude === null) return NO_FIX
  if (latitude < -90 || latitude > 90) return NO_FIX
  if (longitude < -180 || longitude > 180) return NO_FIX
  if (accuracyMeters !== null && accuracyMeters < 0) return NO_FIX

  return { latitude, longitude, accuracyMeters }
}

function validCaptureElapsedMs(value: number | null): number | null {
  if (value === null || !Number.isInteger(value)) return null
  if (value < 0 || value > MAX_CAPTURE_ELAPSED_MS) return null
  return value
}

function formValue(formData: FormData, key: string): string {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}

function formNumber(formData: FormData, key: string): number | null {
  const raw = formValue(formData, key)
  if (!raw) return null

  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}
