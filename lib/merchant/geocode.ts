import "server-only"

import {
  createBoundedGeocodeCache,
  geocodeAddressWithProvider,
  type GeocodeProviderConfig,
  type GeocodeResult,
} from "@/lib/merchant/geocode-core"
import { enforceRateLimit } from "@/lib/security/rate-limit"

const GEOCODING_RATE_LIMIT_KEY = "venue-geocoding-provider-global"
const cache = createBoundedGeocodeCache()

export async function geocodeAddress(
  address: string
): Promise<GeocodeResult | null> {
  const config = loadGeocodeProviderConfig()
  if (!config) return null

  return geocodeAddressWithProvider(address, config, {
    cache,
    fetchImpl: fetch,
    acquirePermit,
  })
}

function loadGeocodeProviderConfig(): GeocodeProviderConfig | null {
  const endpoint = process.env.VENUE_GEOCODING_ENDPOINT?.trim()
  const contact = process.env.VENUE_GEOCODING_CONTACT?.trim()
  return endpoint && contact ? { endpoint, contact } : null
}

async function acquirePermit() {
  try {
    await enforceRateLimit({
      key: GEOCODING_RATE_LIMIT_KEY,
      limit: 1,
      windowMs: 1_000,
    })
    return true
  } catch {
    return false
  }
}

export type { GeocodeResult } from "@/lib/merchant/geocode-core"
