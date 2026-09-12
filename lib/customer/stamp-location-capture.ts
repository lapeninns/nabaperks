import {
  LOCATION_ISSUE_COPY,
  stampLocationIssue,
  type StampLocationIssue,
} from "@/lib/customer/stamp-location-recovery"

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

// Indoor pub GPS often needs several seconds. This is the on-screen "still
// waiting" hint, not a browser deadline: passing `timeout` into
// getCurrentPosition can dismiss Chrome's permission sheet and quiet-block
// the origin so Location cannot be turned back on for the site.
export const SOFT_GPS_CAPTURE_TIMEOUT_MS = 10_000

/**
 * Written by the flow before #272 to remember a refused prompt. Nothing reads
 * it any more, and a stale "1" once kept a customer marked as denied after they
 * had allowed location in site settings. Cleared on sight, best effort.
 */
const LEGACY_DENIAL_MEMORY_KEY = "nabaperks:soft-gps-denied:v1"

export type StampLocationCapture = {
  readonly latitude: number | null
  readonly longitude: number | null
  readonly accuracyMeters: number | null
  /**
   * `granted` carries a fix. `denied`, `timeout`, `unavailable` and
   * `unsupported` are what the browser said. `cancelled` means the customer
   * moved on (to the venue code) before the browser answered; it must never be
   * submitted.
   */
  readonly locationStatus: string
  readonly captureElapsedMs: number
}

export type GeolocationPermissionState =
  "granted" | "denied" | "prompt" | "unknown"

/**
 * Ask the browser for a fix. Always requests location from a customer tap:
 * a blocked site may answer PERMISSION_DENIED without showing a prompt.
 * A fresh request notices when the customer has allowed site access. The
 * Permissions API is for copy only (see {@link geolocationPermissionState}).
 *
 * Do not pass a Geolocation `timeout`. Chrome can treat a timed-out permission
 * sheet as a dismiss, then quiet-block the origin. The wait stays open until
 * the browser answers or the caller aborts (venue code). A late fix after
 * abort is ignored.
 */
export async function resolveStampLocation(
  shouldAttemptLocation: boolean,
  signal?: AbortSignal
): Promise<StampLocationCapture | null> {
  if (!shouldAttemptLocation || typeof navigator === "undefined") {
    return null
  }

  forgetLegacyDenial()

  if (!navigator.geolocation) {
    return emptyCapture("unsupported")
  }

  if (signal?.aborted) {
    return emptyCapture("cancelled")
  }

  return captureGeolocation(signal)
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

/**
 * What the browser currently says about this site's location permission.
 * Copy only: a missing or throwing Permissions API resolves to `unknown` and
 * must never hide a control or skip the browser call.
 */
export async function geolocationPermissionState(): Promise<GeolocationPermissionState> {
  try {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) {
      return "unknown"
    }
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

export type CaptureDecision =
  | { readonly action: "submit" }
  | { readonly action: "ignore" }
  | {
      readonly action: "refuse"
      readonly message: string
      readonly issue: StampLocationIssue
    }

export type CaptureDecisionInput = {
  /** Explicit fallback choice, never set by a GPS retry. */
  readonly useUnverifiedGrace?: boolean
  /**
   * Unverified stamps the server will still commit for this membership, from
   * the page payload. Undefined when the page could not say.
   */
  readonly unverifiedGraceRemaining: number | undefined
  /**
   * The server has already answered `location_required` to a capture without
   * a fix during this visit — so the grace is spent whatever the payload said.
   */
  readonly refusedWithoutFix: boolean
}

/**
 * Recovery comes before spending grace. Accurate fixes go to the server for
 * the distance check; failed/imprecise captures wait for an explicit fallback
 * choice. Unknown or exhausted grace never probes the stamp attempt bucket.
 */
export function decideCaptureSubmission(
  capture: StampLocationCapture | null,
  input: CaptureDecisionInput
): CaptureDecision {
  if (!capture) return { action: "submit" }
  if (capture.locationStatus === "cancelled") return { action: "ignore" }
  const issue = stampLocationIssue(capture)
  if (!issue) return { action: "submit" }
  if (
    input.useUnverifiedGrace &&
    (input.unverifiedGraceRemaining ?? 0) > 0 &&
    !input.refusedWithoutFix
  ) {
    return { action: "submit" }
  }
  return { action: "refuse", issue, message: LOCATION_ISSUE_COPY[issue].body }
}

function captureFromGeolocationPosition(
  position: GeolocationPosition,
  startedAt: number
): StampLocationCapture {
  const { coords } = position
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracyMeters: coords.accuracy,
    locationStatus: "granted",
    captureElapsedMs: elapsedMs(startedAt),
  }
}

export function supportsNativeGeolocationElement(): boolean {
  return typeof Reflect.get(globalThis, "HTMLGeolocationElement") === "function"
}

export type NativeGeolocationHost = HTMLElement & {
  readonly position: GeolocationPosition | null
  readonly error: GeolocationPositionError | null
}

export function captureFromNativeGeolocationHost(
  host: NativeGeolocationHost,
  startedAt: number
): StampLocationCapture {
  if (host.position) {
    return captureFromGeolocationPosition(host.position, startedAt)
  }
  if (host.error) {
    return captureFromGeolocationError(host.error, startedAt)
  }
  return {
    ...emptyCapture("unavailable"),
    captureElapsedMs: elapsedMs(startedAt),
  }
}

function captureFromGeolocationError(
  error: Pick<
    GeolocationPositionError,
    "code" | "PERMISSION_DENIED" | "TIMEOUT"
  >,
  startedAt: number
): StampLocationCapture {
  return {
    ...emptyCapture(
      error.code === error.PERMISSION_DENIED
        ? "denied"
        : error.code === error.TIMEOUT
          ? "timeout"
          : "unavailable"
    ),
    captureElapsedMs: elapsedMs(startedAt),
  }
}

function captureGeolocation(
  signal: AbortSignal | undefined
): Promise<StampLocationCapture> {
  return new Promise((resolve) => {
    const startedAt = nowMs()
    let settled = false
    const finish = (capture: StampLocationCapture) => {
      if (settled) return
      settled = true
      signal?.removeEventListener("abort", onAbort)
      resolve(capture)
    }
    const onAbort = () => {
      finish({
        ...emptyCapture("cancelled"),
        captureElapsedMs: elapsedMs(startedAt),
      })
    }
    signal?.addEventListener("abort", onAbort, { once: true })

    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          finish(captureFromGeolocationPosition(position, startedAt))
        },
        (error) => {
          finish(captureFromGeolocationError(error, startedAt))
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
        }
      )
    } catch {
      finish({
        ...emptyCapture("unavailable"),
        captureElapsedMs: elapsedMs(startedAt),
      })
    }
  })
}

function forgetLegacyDenial(): void {
  try {
    globalThis.localStorage?.removeItem(LEGACY_DENIAL_MEMORY_KEY)
  } catch {
    // Storage can be unavailable or throw in private modes; capture goes on.
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
