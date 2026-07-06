"use client"

import dynamic from "next/dynamic"
import type { InputHTMLAttributes } from "react"

import { Eyebrow } from "@/components/brand"
import { FormField } from "@/components/forms"
import { Disclosure } from "@/components/merchant/launch/disclosure"
import { Input } from "@/components/ui/input"

export type VenueCoordinates = {
  latitude: number
  longitude: number
}

const VenuePinMap = dynamic(() => import("./venue-pin-map"), {
  ssr: false,
  loading: () => (
    <div
      className="h-64 w-full rounded-lg border-2 border-dashed border-border bg-card"
      aria-hidden
    />
  ),
})

export function AdvancedGpsChecks({
  requireGeofence,
  geofenceRadiusMeters,
  geofenceRadiusError,
  softGeofenceTriggerStamp,
  softGeofenceTriggerStampError,
  pin,
  geocoded,
  hasGeocode,
  mapRadiusMeters,
  onRequireGeofenceChange,
  onRadiusChange,
  onTriggerStampChange,
  onPinChange,
}: {
  requireGeofence: boolean
  geofenceRadiusMeters: string
  geofenceRadiusError?: string
  softGeofenceTriggerStamp: string
  softGeofenceTriggerStampError?: string
  pin: VenueCoordinates | null
  geocoded?: { latitude: number | null; longitude: number | null } | null
  hasGeocode: boolean
  mapRadiusMeters: number
  onRequireGeofenceChange: (checked: boolean) => void
  onRadiusChange: (value: string) => void
  onTriggerStampChange: (value: string) => void
  onPinChange: (coordinates: VenueCoordinates) => void
}) {
  return (
    <Disclosure
      label="Advanced GPS checks"
      defaultOpen={requireGeofence || Boolean(geofenceRadiusError)}
    >
      <p className="text-xs leading-5 text-muted-foreground">
        Off by default. When on, a stamp from outside the radius still goes
        through — it is only flagged for you to review later.
      </p>
      <label className="flex items-center justify-between gap-4 rounded-lg border-2 border-ink bg-card px-4 py-3 text-sm font-bold">
        <span>Use GPS anomaly checks</span>
        <input
          name="requireGeofence"
          type="checkbox"
          checked={requireGeofence}
          onChange={(event) => onRequireGeofenceChange(event.target.checked)}
          className="size-5 accent-primary"
        />
      </label>
      <GpsField
        id="geofenceRadiusMeters"
        label="Radius metres"
        name="geofenceRadiusMeters"
        inputMode="numeric"
        pattern="[0-9]*"
        value={geofenceRadiusMeters}
        onChange={(event) => onRadiusChange(event.target.value)}
        error={geofenceRadiusError}
      />
      <p className="text-xs leading-5 text-muted-foreground">
        100m suits most small, single-site venues. Set anything from 25m to
        1000m.
      </p>
      <GpsField
        id="softGeofenceTriggerStamp"
        label="Check on stamp number"
        name="softGeofenceTriggerStamp"
        inputMode="numeric"
        pattern="[0-9]*"
        value={softGeofenceTriggerStamp}
        onChange={(event) => onTriggerStampChange(event.target.value)}
        error={softGeofenceTriggerStampError}
      />
      <p className="text-xs leading-5 text-muted-foreground">
        Which stamp in each card cycle runs the location check. 3 works for
        most venues; use 1–99.
      </p>
      {requireGeofence && pin ? (
        <div className="grid gap-2">
          <VenuePinMap
            latitude={pin.latitude}
            longitude={pin.longitude}
            radiusMeters={mapRadiusMeters}
            onPinChange={onPinChange}
          />
          <p className="text-xs leading-5 text-muted-foreground">
            Drag the pin to your real entrance — the soft GPS check measures
            from this exact spot, not the postcode centre.
          </p>
        </div>
      ) : null}
      {hasGeocode ? (
        <p className="font-mono text-xs text-muted-foreground">
          Geocoded to {geocoded?.latitude}, {geocoded?.longitude}.
        </p>
      ) : null}
    </Disclosure>
  )
}

/**
 * Thin composition over the one input story (FormField + the themed slot
 * well) — gains proper aria error association the raw input lacked.
 */
function GpsField({
  id,
  label,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  id: string
  label: string
  error?: string
}) {
  return (
    <FormField id={id} label={<Eyebrow>{label}</Eyebrow>} error={error}>
      <Input id={id} className="h-12 text-sm" {...props} />
    </FormField>
  )
}
