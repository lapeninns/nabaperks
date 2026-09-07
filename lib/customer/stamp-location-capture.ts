export function shouldAttemptStampLocation(
  requireGeofence: boolean,
  nextVisitNumber: number,
  firstVerifiedVisit = 3
): boolean {
  return (
    requireGeofence &&
    nextVisitNumber >= Math.max(Math.trunc(firstVerifiedVisit), 1)
  )
}

// Indoor pub GPS often needs several seconds. The previous 1.2s window timed
// out before a fix arrived and then ignored the late success.
export const SOFT_GPS_CAPTURE_TIMEOUT_MS = 10_000
const SOFT_GPS_CAPTURE_WATCHDOG_MS = 500

const LOCATION_DENIAL_MEMORY_KEY = "nabaperks:soft-gps-denied:v1"

export type StampLocationCapture = {
  readonly latitude: number | null
  readonly longitude: number | null
  readonly accuracyMeters: number | null
  readonly locationStatus: string
  readonly captureElapsedMs: number
}

export function resolveStampLocation(
  shouldAttemptLocation: boolean,
  timeoutMs = SOFT_GPS_CAPTURE_TIMEOUT_MS
): Promise<StampLocationCapture | null> {
  return new Promise((resolve) => {
    if (!shouldAttemptLocation || typeof navigator === "undefined") {
      resolve(null)
      return
    }

    if (!navigator.geolocation) {
      resolve({
        latitude: null,
        longitude: null,
        accuracyMeters: null,
        locationStatus: "unsupported",
        captureElapsedMs: 0,
      })
      return
    }

    // A remembered denial resolves the soft check locally — no fresh browser
    // prompt, so the customer is never re-nagged and the stamp is never delayed.
    if (rememberedLocationDenied()) {
      resolve({
        latitude: null,
        longitude: null,
        accuracyMeters: null,
        locationStatus: "denied_remembered",
        captureElapsedMs: 0,
      })
      return
    }

    const startedAt = nowMs()
    const waitMs = Math.max(Math.trunc(timeoutMs), 1)
    let settled = false
    const finish = (capture: StampLocationCapture) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(capture)
    }
    // Hang-guard only. The browser timeout is the real deadline so a fix that
    // arrives near the end of the window is not discarded by a racing timer.
    const timer = globalThis.setTimeout(() => {
      finish({
        latitude: null,
        longitude: null,
        accuracyMeters: null,
        locationStatus: "timeout",
        captureElapsedMs: waitMs,
      })
    }, waitMs + SOFT_GPS_CAPTURE_WATCHDOG_MS)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { coords } = position
        finish({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracyMeters: coords.accuracy,
          locationStatus: "granted",
          captureElapsedMs: elapsedMs(startedAt),
        })
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          rememberLocationDenied()
        }
        finish({
          latitude: null,
          longitude: null,
          accuracyMeters: null,
          locationStatus:
            error.code === error.PERMISSION_DENIED
              ? "denied"
              : error.code === error.TIMEOUT
                ? "timeout"
                : "unavailable",
          captureElapsedMs: elapsedMs(startedAt),
        })
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: waitMs,
      }
    )
  })
}

export function addLocationCapture(
  formData: FormData,
  capture: StampLocationCapture | null
): void {
  if (!capture) return

  if (capture.latitude !== null) {
    formData.set("latitude", String(capture.latitude))
  }
  if (capture.longitude !== null) {
    formData.set("longitude", String(capture.longitude))
  }
  if (capture.accuracyMeters !== null) {
    formData.set("accuracy_meters", String(capture.accuracyMeters))
  }
  formData.set("location_status", capture.locationStatus)
  formData.set("capture_elapsed_ms", String(capture.captureElapsedMs))
}

function rememberedLocationDenied(): boolean {
  try {
    return localStorage.getItem(LOCATION_DENIAL_MEMORY_KEY) === "1"
  } catch {
    return false
  }
}

function rememberLocationDenied(): void {
  try {
    localStorage.setItem(LOCATION_DENIAL_MEMORY_KEY, "1")
  } catch {
    return
  }
}

function nowMs(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now()
}

function elapsedMs(startedAt: number): number {
  return Math.max(0, Math.round(nowMs() - startedAt))
}
