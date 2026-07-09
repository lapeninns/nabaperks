import "server-only"

import { resilientFetch } from "@/lib/observability/resilience"

export type GeocodeResult = {
  latitude: number
  longitude: number
}

type NominatimCandidate = {
  lat?: unknown
  lon?: unknown
}

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search"
const USER_AGENT =
  "Nabaperks venue geocoder (https://nabaperks.example; support@nabaperks.example)"

export async function geocodeAddress(
  address: string
): Promise<GeocodeResult | null> {
  const trimmed = address.trim()

  if (!trimmed) return null

  const url = new URL(NOMINATIM_ENDPOINT)
  url.searchParams.set("q", trimmed)
  url.searchParams.set("format", "jsonv2")
  url.searchParams.set("limit", "1")
  url.searchParams.set("addressdetails", "0")

  try {
    const response = await resilientFetch("nominatim", url, undefined, {
      retries: 2,
      initForAttempt() {
        return {
          headers: {
            Accept: "application/json",
            "User-Agent": USER_AGENT,
          },
          signal: AbortSignal.timeout(5_000),
        }
      },
    })

    if (!response.ok) return null

    const candidates = await response.json()
    if (!Array.isArray(candidates)) return null

    return parseCandidate(candidates[0])
  } catch (error) {
    if (error instanceof Error) return null

    throw error
  }
}

function parseCandidate(candidate: unknown): GeocodeResult | null {
  if (!isCandidate(candidate)) return null

  const latitude = parseCoordinate(candidate.lat)
  const longitude = parseCoordinate(candidate.lon)

  if (latitude === null || longitude === null) return null

  return { latitude, longitude }
}

function isCandidate(value: unknown): value is NominatimCandidate {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseCoordinate(value: unknown) {
  if (typeof value !== "string") return null

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}
