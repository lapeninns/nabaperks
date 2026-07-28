export type GeocodeResult = {
  latitude: number
  longitude: number
}

export type GeocodeProviderConfig = {
  endpoint: string
  contact: string
}

type NominatimCandidate = {
  lat?: unknown
  lon?: unknown
}

type CacheEntry = {
  expiresAt: number
  value: GeocodeResult | null
}

export type GeocodeCache = {
  get(key: string, now: number): GeocodeResult | null | undefined
  set(key: string, value: GeocodeResult | null, expiresAt: number): void
}

export type GeocodeDependencies = {
  acquirePermit: () => Promise<boolean>
  cache: GeocodeCache
  fetchImpl: typeof fetch
  now?: () => number
}

const SUCCESS_TTL_MS = 24 * 60 * 60 * 1_000
const MISS_TTL_MS = 60 * 1_000

export function createBoundedGeocodeCache(maxEntries = 256): GeocodeCache {
  const entries = new Map<string, CacheEntry>()

  return {
    get(key, now) {
      const entry = entries.get(key)
      if (!entry) return undefined
      if (entry.expiresAt <= now) {
        entries.delete(key)
        return undefined
      }

      entries.delete(key)
      entries.set(key, entry)
      return entry.value
    },
    set(key, value, expiresAt) {
      entries.delete(key)
      entries.set(key, { expiresAt, value })

      while (entries.size > maxEntries) {
        const oldestKey = entries.keys().next().value
        if (oldestKey === undefined) break
        entries.delete(oldestKey)
      }
    },
  }
}

export async function geocodeAddressWithProvider(
  address: string,
  config: GeocodeProviderConfig,
  dependencies: GeocodeDependencies
): Promise<GeocodeResult | null> {
  const trimmedAddress = address.trim()
  if (!trimmedAddress) return null

  const endpoint = parseEndpoint(config.endpoint)
  const contact = config.contact.trim()
  if (!endpoint || !isValidContact(contact)) return null

  const cacheKey = `${endpoint.origin}${endpoint.pathname}:${trimmedAddress.toLowerCase()}`
  const now = dependencies.now?.() ?? Date.now()
  const cached = dependencies.cache.get(cacheKey, now)
  if (cached !== undefined) return cached

  if (!(await dependencies.acquirePermit())) return null

  endpoint.searchParams.set("q", trimmedAddress)
  endpoint.searchParams.set("format", "jsonv2")
  endpoint.searchParams.set("limit", "1")
  endpoint.searchParams.set("addressdetails", "0")

  try {
    const response = await dependencies.fetchImpl(endpoint, {
      headers: {
        Accept: "application/json",
        "User-Agent": `Nabaperks venue geocoder/1.0 (${contact})`,
      },
      signal: AbortSignal.timeout(5_000),
    })
    if (!response.ok) return null

    const candidates: unknown = await response.json()
    const result = Array.isArray(candidates)
      ? parseCandidate(candidates[0])
      : null
    dependencies.cache.set(
      cacheKey,
      result,
      now + (result ? SUCCESS_TTL_MS : MISS_TTL_MS)
    )
    return result
  } catch {
    return null
  }
}

function parseEndpoint(value: string) {
  try {
    const url = new URL(value)
    if (url.protocol !== "https:") return null
    return url
  } catch {
    return null
  }
}

function isValidContact(value: string) {
  if (!value || /[\r\n]/.test(value)) return false
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return true

  try {
    return new URL(value).protocol === "https:"
  } catch {
    return false
  }
}

function parseCandidate(candidate: unknown): GeocodeResult | null {
  if (!isCandidate(candidate)) return null

  const latitude = parseCoordinate(candidate.lat, 90)
  const longitude = parseCoordinate(candidate.lon, 180)
  if (latitude === null || longitude === null) return null

  return { latitude, longitude }
}

function isCandidate(value: unknown): value is NominatimCandidate {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseCoordinate(value: unknown, bound: number) {
  if (typeof value !== "string") return null

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < -bound || parsed > bound) return null
  return parsed
}
