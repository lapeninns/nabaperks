import assert from "node:assert/strict"
import { test } from "node:test"

import { checkOperationalReadiness } from "@/lib/observability/operational-signals"
import { checkDatabaseReadiness } from "@/lib/observability/readiness"

const thresholds = {
  notificationQueueAgeMinutes: 30,
  loyaltyInviteQueueAgeMinutes: 15,
  referralBonusBacklogAgeMinutes: 30,
  providerDeliveryFailureRate: 0.1,
  consecutiveCronFailures: 1,
}

function operationalSignals(overrides = {}) {
  return {
    notificationQueueAgeMinutes: 0,
    loyaltyInviteQueueAgeMinutes: 0,
    referralBonusBacklogCount: 0,
    referralBonusBacklogAgeMinutes: 0,
    providerDeliveryAttempts24h: 20,
    providerDeliveryFailures24h: 1,
    providerDeliveryFailureRate24h: 0.05,
    cronJobs: [
      "notifications",
      "privacy-retention",
      "merchant-digest",
      "birthday-rewards",
      "referral-bonus-drain",
      "loyalty-invite-drain",
    ].map((name) => ({
      name,
      state: "ok",
      consecutiveFailures: 0,
      lastCompletedAt: "2026-07-23T10:00:00.000Z",
    })),
    ...overrides,
  }
}

test("database readiness returns ok only for a successful bounded RLS read", async () => {
  let request
  const result = await checkDatabaseReadiness({
    serviceRoleKey: "service-role-test-key",
    fetcher: async (input, init) => {
      request = { input: String(input), init }
      return new Response("[]", { status: 200 })
    },
    supabaseUrl: "https://project.supabase.co",
  })

  assert.deepEqual(result, { database: "ok" })
  assert.match(request.input, /\/rest\/v1\/rpc\/production_readiness_probe$/)
  assert.equal(request.init.method, "POST")
  assert.equal(request.init.body, "{}")
  assert.equal(request.init.headers.apikey, "service-role-test-key")
  assert.equal(request.init.cache, "no-store")
  assert.equal(request.init.redirect, "error")
  assert.ok(request.init.signal instanceof AbortSignal)
})

test("database readiness collapses provider failures to a safe public state", async () => {
  const result = await checkDatabaseReadiness({
    serviceRoleKey: "service-role-test-key",
    fetcher: async () =>
      new Response("private provider detail", { status: 503 }),
    supabaseUrl: "https://project.supabase.co",
  })

  assert.deepEqual(result, { database: "error" })
  assert.equal(
    JSON.stringify(result).includes("private provider detail"),
    false
  )
})

test("database readiness fails closed before fetch when configuration is absent", async () => {
  let calls = 0
  const result = await checkDatabaseReadiness({
    serviceRoleKey: "",
    fetcher: async () => {
      calls += 1
      return new Response("[]")
    },
    supabaseUrl: "",
  })

  assert.deepEqual(result, { database: "error" })
  assert.equal(calls, 0)
})

test("database readiness never sends the service role key to an untrusted origin", async () => {
  let calls = 0

  for (const supabaseUrl of [
    "http://project.supabase.co",
    "https://supabase.co.evil.example",
    "https://evil.example/project.supabase.co",
    "https://user:password@project.supabase.co",
  ]) {
    const result = await checkDatabaseReadiness({
      serviceRoleKey: "service-role-test-key",
      fetcher: async () => {
        calls += 1
        return new Response("[]")
      },
      supabaseUrl,
    })

    assert.deepEqual(result, { database: "error" })
  }

  assert.equal(calls, 0)
})

test("loopback readiness requires the exact ephemeral staging opt-in", async () => {
  let calls = 0
  const fetcher = async () => {
    calls += 1
    return new Response("[]", { status: 200 })
  }

  const denied = await checkDatabaseReadiness({
    serviceRoleKey: "service-role-test-key",
    fetcher,
    supabaseUrl: "http://127.0.0.1:54321",
  })
  assert.deepEqual(denied, { database: "error" })
  assert.equal(calls, 0)

  const allowed = await checkDatabaseReadiness({
    allowLoopback: true,
    serviceRoleKey: "service-role-test-key",
    fetcher,
    supabaseUrl: "http://127.0.0.1:54321",
  })
  assert.deepEqual(allowed, { database: "ok" })
  assert.equal(calls, 1)

  for (const supabaseUrl of [
    "http://localhost:54321",
    "http://127.0.0.1:54322",
    "http://127.0.0.1:54321/rest/v1",
  ]) {
    const rejected = await checkDatabaseReadiness({
      allowLoopback: true,
      serviceRoleKey: "service-role-test-key",
      fetcher,
      supabaseUrl,
    })
    assert.deepEqual(rejected, { database: "error" })
  }
  assert.equal(calls, 1)
})

test("database readiness collapses timeouts and network errors", async () => {
  const result = await checkDatabaseReadiness({
    serviceRoleKey: "service-role-test-key",
    fetcher: async () => {
      throw new DOMException("timed out with sensitive URL", "TimeoutError")
    },
    supabaseUrl: "https://project.supabase.co",
  })

  assert.deepEqual(result, { database: "error" })
})

test("operational readiness accepts bounded aggregate signals", async () => {
  let request
  const signals = operationalSignals()
  const result = await checkOperationalReadiness({
    serviceRoleKey: "service-role-test-key",
    thresholds,
    fetcher: async (input, init) => {
      request = { input: String(input), init }
      return Response.json(signals)
    },
    supabaseUrl: "https://project.supabase.co",
  })

  assert.deepEqual(result, { operational: "ok", signals })
  assert.match(
    request.input,
    /\/rest\/v1\/rpc\/production_operational_signals$/
  )
  assert.equal(request.init.method, "POST")
  assert.equal(request.init.headers.apikey, "service-role-test-key")
  assert.equal(request.init.redirect, "error")
})

test("operational readiness fails closed on breached queue, provider or cron signals", async () => {
  const breachedSignals = [
    operationalSignals({ notificationQueueAgeMinutes: 30.001 }),
    operationalSignals({ loyaltyInviteQueueAgeMinutes: 15.001 }),
    operationalSignals({
      referralBonusBacklogCount: 1,
      referralBonusBacklogAgeMinutes: 30.001,
    }),
    operationalSignals({
      providerDeliveryFailures24h: 3,
      providerDeliveryFailureRate24h: 0.15,
    }),
    operationalSignals({
      cronJobs: operationalSignals().cronJobs.map((job, index) =>
        index === 0 ? { ...job, state: "failing", consecutiveFailures: 1 } : job
      ),
    }),
    operationalSignals({
      cronJobs: operationalSignals().cronJobs.map((job, index) =>
        index === 0 ? { ...job, state: "stale" } : job
      ),
    }),
  ]

  for (const signals of breachedSignals) {
    const result = await checkOperationalReadiness({
      serviceRoleKey: "service-role-test-key",
      thresholds,
      fetcher: async () => Response.json(signals),
      supabaseUrl: "https://project.supabase.co",
    })
    assert.equal(result.operational, "error")
    assert.deepEqual(result.signals, signals)
  }
})

test("operational readiness permits the bounded first-run warm-up", async () => {
  const signals = operationalSignals({
    cronJobs: operationalSignals().cronJobs.map((job) => ({
      ...job,
      state: "warming",
      lastCompletedAt: null,
    })),
  })
  const result = await checkOperationalReadiness({
    serviceRoleKey: "service-role-test-key",
    thresholds,
    fetcher: async () => Response.json(signals),
    supabaseUrl: "https://project.supabase.co",
  })

  assert.equal(result.operational, "ok")
})

test("staging readiness can omit production-only cron health without omitting other signals", async () => {
  const staleCrons = operationalSignals({
    cronJobs: operationalSignals().cronJobs.map((job) => ({
      ...job,
      state: "stale",
    })),
  })
  const result = await checkOperationalReadiness({
    serviceRoleKey: "service-role-test-key",
    thresholds,
    requireCronHealth: false,
    fetcher: async () => Response.json(staleCrons),
    supabaseUrl: "https://project.supabase.co",
  })

  assert.equal(result.operational, "ok")

  const breachedQueue = await checkOperationalReadiness({
    serviceRoleKey: "service-role-test-key",
    thresholds,
    requireCronHealth: false,
    fetcher: async () =>
      Response.json(
        operationalSignals({
          notificationQueueAgeMinutes: 30.001,
          cronJobs: staleCrons.cronJobs,
        })
      ),
    supabaseUrl: "https://project.supabase.co",
  })

  assert.equal(breachedQueue.operational, "error")
})

test("operational readiness permits only the explicit ephemeral loopback origin", async () => {
  let request
  const signals = operationalSignals()
  const result = await checkOperationalReadiness({
    allowLoopback: true,
    serviceRoleKey: "service-role-test-key",
    thresholds,
    fetcher: async (input) => {
      request = String(input)
      return Response.json(signals)
    },
    supabaseUrl: "http://127.0.0.1:54321",
  })

  assert.deepEqual(result, { operational: "ok", signals })
  assert.equal(
    request,
    "http://127.0.0.1:54321/rest/v1/rpc/production_operational_signals"
  )
})

test("operational readiness rejects malformed or untrusted provider responses", async () => {
  for (const signals of [
    { ...operationalSignals(), cronJobs: [] },
    { ...operationalSignals(), providerDeliveryFailureRate24h: 2 },
    { ...operationalSignals(), referralBonusBacklogCount: -1 },
    {
      ...operationalSignals(),
      referralBonusBacklogAgeMinutes: "private detail",
    },
    { ...operationalSignals(), notificationQueueAgeMinutes: "private detail" },
  ]) {
    const result = await checkOperationalReadiness({
      serviceRoleKey: "service-role-test-key",
      thresholds,
      fetcher: async () => Response.json(signals),
      supabaseUrl: "https://project.supabase.co",
    })
    assert.deepEqual(result, { operational: "error", signals: null })
  }

  let calls = 0
  const untrusted = await checkOperationalReadiness({
    serviceRoleKey: "service-role-test-key",
    thresholds,
    fetcher: async () => {
      calls += 1
      return Response.json(operationalSignals())
    },
    supabaseUrl: "https://project.supabase.co.evil.example",
  })
  assert.deepEqual(untrusted, { operational: "error", signals: null })
  assert.equal(calls, 0)
})
