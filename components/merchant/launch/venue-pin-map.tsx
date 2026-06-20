"use client"

import { useEffect, useRef } from "react"

import * as L from "leaflet"
import "leaflet/dist/leaflet.css"

export type VenuePinMapProps = {
  latitude: number
  longitude: number
  radiusMeters: number
  /** Fires after a drag settles with the new marker coordinates. */
  onPinChange: (coordinates: { latitude: number; longitude: number }) => void
}

const PIN_COLOR = "#b8742c"

// Self-contained HTML marker so Leaflet's default image assets (which break
// under bundlers) are never requested.
const MARKER_HTML =
  '<span style="display:block;width:22px;height:22px;border-radius:9999px;' +
  `background:${PIN_COLOR};border:3px solid #ffffff;` +
  'box-shadow:0 1px 5px rgba(0,0,0,0.45);"></span>'

/**
 * Client-only draggable venue pin. Direct Leaflet (no React wrapper): the map is
 * built in an effect, kept in refs, and torn down on unmount. A second effect
 * keeps the marker, circle, and radius in sync with controlled props without
 * rebuilding the map.
 */
export default function VenuePinMap({
  latitude,
  longitude,
  radiusMeters,
  onPinChange,
}: VenuePinMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const circleRef = useRef<L.Circle | null>(null)
  const initialRef = useRef({ latitude, longitude, radiusMeters })
  const onPinChangeRef = useRef(onPinChange)

  useEffect(() => {
    onPinChangeRef.current = onPinChange
  }, [onPinChange])

  useEffect(() => {
    const container = containerRef.current
    if (!container || mapRef.current) return

    const {
      latitude: lat0,
      longitude: lng0,
      radiusMeters: radius0,
    } = initialRef.current

    const map = L.map(container, {
      center: [lat0, lng0],
      zoom: 17,
      scrollWheelZoom: false,
    })
    mapRef.current = map

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map)

    const circle = L.circle([lat0, lng0], {
      radius: radius0,
      color: PIN_COLOR,
      weight: 2,
      fillColor: PIN_COLOR,
      fillOpacity: 0.12,
    }).addTo(map)
    circleRef.current = circle

    const marker = L.marker([lat0, lng0], {
      draggable: true,
      keyboard: false,
      icon: L.divIcon({
        className: "venue-pin-marker",
        html: MARKER_HTML,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
    }).addTo(map)
    markerRef.current = marker

    marker.on("drag", () => {
      const { lat, lng } = marker.getLatLng()
      circle.setLatLng([lat, lng])
    })
    marker.on("dragend", () => {
      const { lat, lng } = marker.getLatLng()
      onPinChangeRef.current({ latitude: lat, longitude: lng })
    })

    // Leaflet sizes itself from the container, which may still be settling on
    // mount; recompute now and on any later resize.
    const invalidate = () => map.invalidateSize()
    const frame = requestAnimationFrame(invalidate)
    const observer = new ResizeObserver(invalidate)
    observer.observe(container)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      map.remove()
      mapRef.current = null
      markerRef.current = null
      circleRef.current = null
    }
  }, [])

  useEffect(() => {
    const marker = markerRef.current
    const circle = circleRef.current
    if (!marker || !circle) return
    marker.setLatLng([latitude, longitude])
    circle.setLatLng([latitude, longitude])
    circle.setRadius(radiusMeters)
  }, [latitude, longitude, radiusMeters])

  return (
    <div
      ref={containerRef}
      data-testid="venue-pin-map"
      role="application"
      aria-label="Drag the pin to your venue entrance for the soft GPS check"
      className="h-64 w-full overflow-hidden rounded-lg border-2 border-ink"
    />
  )
}
