import assert from "node:assert/strict"
import { test } from "node:test"

const { resolveCanonicalAppOrigin } = await import("@/lib/env/app-origin-core")

test("generic Preview uses the current immutable deployment origin", () => {
  assert.equal(
    resolveCanonicalAppOrigin({
      NEXT_PUBLIC_APP_URL: "https://cross-environment.example",
      VERCEL_ENV: "preview",
      VERCEL_TARGET_ENV: "preview",
      VERCEL_URL: "nabaperks-git-fix-123-lapeninns.vercel.app",
    }),
    "https://nabaperks-git-fix-123-lapeninns.vercel.app"
  )
})

test("custom Staging retains its explicit canonical origin", () => {
  assert.equal(
    resolveCanonicalAppOrigin({
      NEXT_PUBLIC_APP_URL: "https://staging.nabaperks.example",
      VERCEL_ENV: "preview",
      VERCEL_TARGET_ENV: "staging",
      VERCEL_URL: "nabaperks-random-deployment.vercel.app",
    }),
    "https://staging.nabaperks.example"
  )
})

test("Production retains its explicit canonical origin", () => {
  assert.equal(
    resolveCanonicalAppOrigin({
      NEXT_PUBLIC_APP_URL: "https://nabaperks.com",
      VERCEL_ENV: "production",
      VERCEL_URL: "nabaperks-random-deployment.vercel.app",
    }),
    "https://nabaperks.com"
  )
})

test("hosted canonical origins fail closed when their required source is absent", () => {
  assert.throws(
    () =>
      resolveCanonicalAppOrigin({
        VERCEL_ENV: "preview",
        VERCEL_TARGET_ENV: "preview",
      }),
    /VERCEL_URL/
  )
  assert.throws(
    () =>
      resolveCanonicalAppOrigin({
        VERCEL_ENV: "preview",
        VERCEL_TARGET_ENV: "staging",
      }),
    /NEXT_PUBLIC_APP_URL/
  )
  assert.throws(
    () => resolveCanonicalAppOrigin({ VERCEL_ENV: "production" }),
    /NEXT_PUBLIC_APP_URL/
  )
})

test("hosted origins reject mutable paths and non-HTTPS canonical values", () => {
  for (const input of [
    {
      NEXT_PUBLIC_APP_URL: "https://staging.example/path",
      VERCEL_ENV: "preview",
      VERCEL_TARGET_ENV: "staging",
    },
    {
      NEXT_PUBLIC_APP_URL: "http://staging.example",
      VERCEL_ENV: "preview",
      VERCEL_TARGET_ENV: "staging",
    },
    {
      VERCEL_ENV: "preview",
      VERCEL_URL: "https://preview.example",
    },
  ]) {
    assert.throws(() => resolveCanonicalAppOrigin(input))
  }
})

test("local development accepts its configured loopback origin", () => {
  assert.equal(
    resolveCanonicalAppOrigin({
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3146",
    }),
    "http://127.0.0.1:3146"
  )
})
