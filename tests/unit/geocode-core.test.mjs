import assert from "node:assert/strict"
import { test } from "node:test"

import {
  createBoundedGeocodeCache,
  geocodeAddressWithProvider,
} from "../../lib/merchant/geocode-core.ts"

const config = {
  endpoint: "https://geo.example.test/search",
  contact: "ops@example.test",
}

test("configured geocoding sends identifiable Nominatim request after a permit", async () => {
  const requests = []
  let permitCalls = 0
  const result = await geocodeAddressWithProvider("10 High Street, Ely", config, {
    cache: createBoundedGeocodeCache(),
    now: () => 1_000,
    async acquirePermit() {
      permitCalls += 1
      return true
    },
    async fetchImpl(url, init) {
      requests.push({ url: String(url), init })
      return Response.json([{ lat: "52.3995", lon: "0.2624" }])
    },
  })

  assert.deepEqual(result, { latitude: 52.3995, longitude: 0.2624 })
  assert.equal(permitCalls, 1)
  assert.equal(requests.length, 1)

  const requestUrl = new URL(requests[0].url)
  assert.equal(requestUrl.origin, "https://geo.example.test")
  assert.equal(requestUrl.searchParams.get("q"), "10 High Street, Ely")
  assert.equal(requestUrl.searchParams.get("format"), "jsonv2")
  assert.equal(requestUrl.searchParams.get("limit"), "1")
  assert.equal(
    requests[0].init.headers["User-Agent"],
    "Nabaperks venue geocoder/1.0 (ops@example.test)"
  )
})

test("successful results are cached and bypass both the global permit and provider", async () => {
  let permitCalls = 0
  let fetchCalls = 0
  const dependencies = {
    cache: createBoundedGeocodeCache(),
    now: () => 1_000,
    async acquirePermit() {
      permitCalls += 1
      return true
    },
    async fetchImpl() {
      fetchCalls += 1
      return Response.json([{ lat: "51.5", lon: "-0.1" }])
    },
  }

  await geocodeAddressWithProvider("1 Market Road", config, dependencies)
  const cached = await geocodeAddressWithProvider(
    "  1 MARKET ROAD  ",
    config,
    dependencies
  )

  assert.deepEqual(cached, { latitude: 51.5, longitude: -0.1 })
  assert.equal(permitCalls, 1)
  assert.equal(fetchCalls, 1)
})

test("a denied application-wide permit fails safe without calling the provider", async () => {
  let fetchCalls = 0
  const result = await geocodeAddressWithProvider("1 Market Road", config, {
    cache: createBoundedGeocodeCache(),
    async acquirePermit() {
      return false
    },
    async fetchImpl() {
      fetchCalls += 1
      return Response.json([])
    },
  })

  assert.equal(result, null)
  assert.equal(fetchCalls, 0)
})

test("the provider cache evicts its least-recently-used entry at its bound", async () => {
  let fetchCalls = 0
  const dependencies = {
    cache: createBoundedGeocodeCache(1),
    now: () => 1_000,
    async acquirePermit() {
      return true
    },
    async fetchImpl() {
      fetchCalls += 1
      return Response.json([{ lat: "51.5", lon: "-0.1" }])
    },
  }

  await geocodeAddressWithProvider("1 Market Road", config, dependencies)
  await geocodeAddressWithProvider("2 Market Road", config, dependencies)
  await geocodeAddressWithProvider("1 Market Road", config, dependencies)

  assert.equal(fetchCalls, 3)
})

test("invalid provider configuration and out-of-range candidates fail safe", async () => {
  let permitCalls = 0
  const dependencies = {
    cache: createBoundedGeocodeCache(),
    async acquirePermit() {
      permitCalls += 1
      return true
    },
    async fetchImpl() {
      return Response.json([{ lat: "91", lon: "0" }])
    },
  }

  assert.equal(
    await geocodeAddressWithProvider(
      "1 Market Road",
      { ...config, contact: "placeholder" },
      dependencies
    ),
    null
  )
  assert.equal(permitCalls, 0)
  assert.equal(
    await geocodeAddressWithProvider("1 Market Road", config, dependencies),
    null
  )
})
