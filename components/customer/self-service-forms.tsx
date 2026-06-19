"use client"

import { useRef, useState, type FormEvent } from "react"

export type LocationMode = {
  requireGeofence: boolean
  geofenceRadiusMeters: number
}

export type StampLocationStatus =
  | "skipped"
  | "available"
  | "denied"
  | "denied_remembered"
  | "timeout"
  | "unsupported"

export type StampLocationResult = {
  readonly status: StampLocationStatus
  readonly elapsedMs: number
  readonly coordinates?: {
    readonly latitude: number
    readonly longitude: number
  }
}

type StampLocationRequest = {
  readonly requireGeofence: boolean
  readonly nextStampNumber: number
}

type SelfStampFormDataInput = {
  readonly membershipId: string
  readonly qrId: string
  readonly nextStampNumber: number
  readonly location: LocationMode
}

const STAMP_LOCATION_DENIAL_KEY = "nabaperks:stamp-location-denied"

export function shouldRequestStampLocation({
  requireGeofence,
  nextStampNumber,
}: StampLocationRequest) {
  return requireGeofence && nextStampNumber === 3
}

export function resolveStampLocation(
  shouldRequestLocation: boolean
): Promise<StampLocationResult> {
  const startedAt = Date.now()

  return new Promise((resolve) => {
    if (
      !shouldRequestLocation ||
      typeof navigator === "undefined" ||
      !navigator.geolocation
    ) {
      resolve({
        status: shouldRequestLocation ? "unsupported" : "skipped",
        elapsedMs: elapsedSince(startedAt),
      })
      return
    }
    const denialRemembered = stampLocationDenialRemembered()
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          status: "available",
          elapsedMs: elapsedSince(startedAt),
          coordinates: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
        }),
      (error) => {
        const status = stampLocationErrorStatus(error, denialRemembered)
        resolve({ status, elapsedMs: elapsedSince(startedAt) })
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 5_000 }
    )
  })
}

export async function prepareSelfStampFormData({
  membershipId,
  qrId,
  nextStampNumber,
  location,
}: SelfStampFormDataInput) {
  const result = await resolveStampLocation(
    shouldRequestStampLocation({
      requireGeofence: location.requireGeofence,
      nextStampNumber,
    })
  )
  const formData = new FormData()
  formData.set("membershipId", membershipId)
  formData.set("qrId", qrId)
  appendStampLocation(formData, result)

  return formData
}

function appendStampLocation(formData: FormData, result: StampLocationResult) {
  formData.set("locationStatus", result.status)
  formData.set("locationElapsedMs", String(result.elapsedMs))
  if (result.coordinates) {
    formData.set("latitude", String(result.coordinates.latitude))
    formData.set("longitude", String(result.coordinates.longitude))
  }
}

function stampLocationErrorStatus(
  error: GeolocationPositionError,
  denialRemembered: boolean
): StampLocationStatus {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      rememberStampLocationDenial()
      return denialRemembered ? "denied_remembered" : "denied"
    case error.TIMEOUT:
      return "timeout"
    default:
      return "unsupported"
  }
}

function rememberStampLocationDenial() {
  if (typeof localStorage === "undefined") return

  localStorage.setItem(STAMP_LOCATION_DENIAL_KEY, "1")
}

function stampLocationDenialRemembered() {
  if (typeof localStorage === "undefined") return false

  return localStorage.getItem(STAMP_LOCATION_DENIAL_KEY) === "1"
}

function elapsedSince(startedAt: number) {
  return Math.max(0, Date.now() - startedAt)
}

export function GeoFields() {
  return (
    <>
      <input type="hidden" name="latitude" />
      <input type="hidden" name="longitude" />
      <input type="hidden" name="locationStatus" />
    </>
  )
}

export function LocationNote({ note }: { note: string | null }) {
  if (!note) return null

  return (
    <p className="rounded-xl bg-secondary px-3 py-2 text-sm leading-6 text-muted-foreground">
      {note}
    </p>
  )
}

export function useOptionalGeolocation({
  requireGeofence,
  geofenceRadiusMeters,
}: LocationMode) {
  const [note, setNote] = useState<string | null>(
    requireGeofence
      ? `This venue checks location within ${geofenceRadiusMeters}m when available.`
      : null
  )
  const skipLocationRef = useRef(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!requireGeofence) return

    if (skipLocationRef.current) {
      skipLocationRef.current = false
      return
    }

    event.preventDefault()
    const form = event.currentTarget

    if (!navigator.geolocation) {
      setFormValue(form, "locationStatus", "unavailable")
      setNote("Location unavailable. The action will continue and be reviewed.")
      submitAfterLocation(form)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormValue(form, "latitude", String(position.coords.latitude))
        setFormValue(form, "longitude", String(position.coords.longitude))
        setFormValue(form, "locationStatus", "available")
        setNote("Location captured.")
        submitAfterLocation(form)
      },
      () => {
        setFormValue(form, "locationStatus", "denied")
        setNote(
          "Location not shared. The action will continue and be reviewed."
        )
        submitAfterLocation(form)
      },
      {
        enableHighAccuracy: false,
        maximumAge: 60_000,
        timeout: 5_000,
      }
    )
  }

  function submitAfterLocation(form: HTMLFormElement) {
    skipLocationRef.current = true
    form.requestSubmit()
  }

  return { note, handleSubmit }
}

function setFormValue(form: HTMLFormElement, name: string, value: string) {
  const element = form.elements.namedItem(name)

  if (element instanceof HTMLInputElement) {
    element.value = value
  }
}
