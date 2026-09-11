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

export type StampLocationCapture = {
  readonly latitude: number | null
  readonly longitude: number | null
  readonly accuracyMeters: number | null
  readonly locationStatus: string
  readonly captureElapsedMs: number
}

export async function resolveStampLocation(
  shouldAttemptLocation: boolean,
  timeoutMs = SOFT_GPS_CAPTURE_TIMEOUT_MS
): Promise<StampLocationCapture | null> {
  if (!shouldAttemptLocation || typeof navigator === "undefined") {
    return null
  }

  if (!navigator.geolocation) {
    return {
      latitude: null,
      longitude: null,
      accuracyMeters: null,
      locationStatus: "unsupported",
      captureElapsedMs: 0,
    }
  }

  // Script cannot re-open a blocked OS prompt. Skip the GPS wait in that
  // case so the stamp is not delayed. A later Allow in site settings shows
  // up as granted or prompt on the next collect, and we capture again.
  if ((await geolocationPermissionState()) === "denied") {
    return emptyCapture("denied_remembered")
  }

  return captureGeolocation(timeoutMs)
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

function captureGeolocation(timeoutMs: number): Promise<StampLocationCapture> {
  return new Promise((resolve) => {
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
        ...emptyCapture("timeout"),
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
        finish({
          ...emptyCapture(
            error.code === error.PERMISSION_DENIED
              ? "denied"
              : error.code === error.TIMEOUT
                ? "timeout"
                : "unavailable"
          ),
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

async function geolocationPermissionState(): Promise<
  "granted" | "denied" | "prompt" | "unknown"
> {
  try {
    if (!navigator.permissions?.query) return "unknown"
    const result = await navigator.permissions.query({ name: "geolocation" })
    if (
      result.state === "granted" ||
      result.state === "denied" ||
      result.state === "prompt"
    ) {
      return result.state
    }
    return "unknown"
  } catch {
    return "unknown"
  }
}

function emptyCapture(locationStatus: string): StampLocationCapture {
  return {
    latitude: null,
    longitude: null,
    accuracyMeters: null,
    locationStatus,
    captureElapsedMs: 0,
  }
}

function nowMs(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now()
}

function elapsedMs(startedAt: number): number {
  return Math.max(0, Math.round(nowMs() - startedAt))
}
