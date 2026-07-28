import assert from "node:assert/strict"
import test from "node:test"

import {
  assertPerformanceBudgets,
  assertStagingHealth,
  resolvePerfStressPolicy,
} from "../../scripts/perf-stress-policy.mjs"

const localEnv = {
  PERF_STRESS_APP_URL: "http://127.0.0.1:3000",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_DB_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
}

test("performance stress defaults to loopback-only local targets", () => {
  assert.deepEqual(resolvePerfStressPolicy(localEnv), {
    appOrigin: "http://127.0.0.1:3000",
    mode: "local",
    thresholds: {
      queryMedianMs: 250,
      queryMaxMs: 750,
      httpMedianMs: 750,
      httpMaxMs: 2_000,
    },
  })
})

test("performance stress refuses arbitrary and production hosts", () => {
  assert.throws(
    () =>
      resolvePerfStressPolicy({
        ...localEnv,
        PERF_STRESS_APP_URL: "https://preview.example.test",
      }),
    /app target must use loopback/
  )
  assert.throws(
    () =>
      resolvePerfStressPolicy({
        ...localEnv,
        PERF_STRESS_APP_URL: "https://nabaperks.com",
      }),
    /refusing to stress production/
  )
})

test("hosted performance stress requires exact isolated staging allowlists", () => {
  const projectRef = "abcdefghijklmnopqrst"
  const hostedEnv = {
    PERF_STRESS_TARGET_MODE: "isolated-staging",
    PERF_STRESS_ISOLATED_STAGING_CONFIRMED: "1",
    PERF_STRESS_ISOLATED_STAGING_PROJECT_REF: projectRef,
    PERF_STRESS_APP_URL: "https://nabaperks-staging-ab12.vercel.app",
    PERF_STRESS_ISOLATED_STAGING_APP_ORIGIN:
      "https://nabaperks-staging-ab12.vercel.app",
    NEXT_PUBLIC_SUPABASE_URL: `https://${projectRef}.supabase.co`,
    PERF_STRESS_ISOLATED_STAGING_SUPABASE_ORIGIN: `https://${projectRef}.supabase.co`,
    SUPABASE_DB_URL: `postgresql://postgres:secret@db.${projectRef}.supabase.co:5432/postgres`,
    PERF_STRESS_ISOLATED_STAGING_DB_HOST: `db.${projectRef}.supabase.co`,
  }

  assert.equal(resolvePerfStressPolicy(hostedEnv).mode, "isolated-staging")
  assert.throws(
    () =>
      resolvePerfStressPolicy({
        ...hostedEnv,
        PERF_STRESS_ISOLATED_STAGING_CONFIRMED: "",
      }),
    /explicit confirmation/
  )
  assert.throws(
    () =>
      resolvePerfStressPolicy({
        ...hostedEnv,
        PERF_STRESS_ISOLATED_STAGING_APP_ORIGIN:
          "https://another-staging.vercel.app",
      }),
    /not the allowlisted isolated staging origin/
  )
  assert.throws(
    () =>
      resolvePerfStressPolicy({
        ...hostedEnv,
        PERF_STRESS_ISOLATED_STAGING_PROJECT_REF: "skonlhwstejberyzobep",
      }),
    /production Supabase project/
  )
})

test("hosted performance health must identify isolated staging", () => {
  assert.doesNotThrow(() =>
    assertStagingHealth(
      { environment: "preview", targetEnvironment: "staging" },
      "isolated-staging"
    )
  )
  assert.throws(
    () =>
      assertStagingHealth(
        { environment: "production", targetEnvironment: "production" },
        "isolated-staging"
      ),
    /did not identify as isolated staging/
  )
})

test("performance budgets fail closed on median or maximum regressions", () => {
  const thresholds = {
    queryMedianMs: 250,
    queryMaxMs: 750,
    httpMedianMs: 750,
    httpMaxMs: 2_000,
  }
  assert.doesNotThrow(() =>
    assertPerformanceBudgets(
      [{ label: "query", median: 25, max: 100 }],
      [{ label: "page", median: 400, max: 800 }],
      thresholds
    )
  )
  assert.throws(
    () =>
      assertPerformanceBudgets(
        [{ label: "slow query", median: 251, max: 751 }],
        [{ label: "slow page", median: 751, max: 2_001 }],
        thresholds
      ),
    /Performance budgets failed:[\s\S]*slow query median[\s\S]*slow page max/
  )
})
