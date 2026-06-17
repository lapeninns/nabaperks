"use client"

import { useRef, useState, type FormEvent } from "react"

export type LocationMode = {
  requireGeofence: boolean
  geofenceRadiusMeters: number
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
