import assert from "node:assert/strict"
import { test } from "node:test"

import {
  CircuitOpenError,
  HttpError,
  resilientCall,
  resilientFetch,
  withRetry,
} from "../../lib/observability/resilience.ts"

test("Given finite retry options When the second attempt succeeds Then the configured bounded delay is preserved", async () => {
  // Given
  const delays = []
  let attempts = 0

  // When
  const result = await withRetry(
    async () => {
      attempts += 1
      if (attempts === 1) throw new Error("fixture failure")
      return "recovered"
    },
    {
      retries: 1,
      minDelayMs: 7,
      maxDelayMs: 11,
      factor: 2,
      sleep: async (delay) => delays.push(delay),
    }
  )

  // Then
  assert.equal(result, "recovered")
  assert.equal(attempts, 2)
  assert.deepEqual(delays, [7])
})

const invalidRetryOptions = [
  ["a NaN retry budget", { retries: Number.NaN }],
  ["an infinite retry budget", { retries: Number.POSITIVE_INFINITY }],
  ["a negative retry budget", { retries: -1 }],
  ["a fractional retry budget", { retries: 1.5 }],
  ["a NaN minimum delay", { minDelayMs: Number.NaN }],
  ["an infinite maximum delay", { maxDelayMs: Number.POSITIVE_INFINITY }],
  ["a negative minimum delay", { minDelayMs: -1 }],
  ["a NaN backoff factor", { factor: Number.NaN }],
  ["a zero backoff factor", { factor: 0 }],
]

for (const [description, options] of invalidRetryOptions) {
  test(`Given ${description} When retry starts Then it rejects before the first attempt`, async () => {
    // Given
    let attempts = 0

    // When / Then
    await assert.rejects(
      withRetry(async () => {
        attempts += 1
        return "unexpected"
      }, options),
      (error) =>
        error instanceof Error && error.name === "InvalidRetryOptionsError"
    )
    assert.equal(attempts, 0)
  })
}

test("Given an open circuit When a retry policy is present Then it does not retry the open circuit", async () => {
  const name = `unit-open-circuit-${Date.now()}`

  await assert.rejects(
    resilientCall(
      name,
      async () => {
        throw new Error("upstream unavailable")
      },
      {
        retry: { retries: 0 },
        circuit: { failureThreshold: 1, resetTimeoutMs: 60_000 },
      }
    ),
    /upstream unavailable/
  )

  let retries = 0

  await assert.rejects(
    resilientCall(name, async () => "unexpected", {
      retry: {
        retries: 2,
        onRetry() {
          retries += 1
        },
        sleep: async () => {},
      },
    }),
    CircuitOpenError
  )

  assert.equal(retries, 0)
})

test("Given resilientFetch without opt-in retries When a server response fails Then it makes one attempt", async () => {
  const name = `unit-fetch-no-retry-${Date.now()}`
  let attempts = 0

  await assert.rejects(
    resilientFetch(name, "https://example.test/unstable", undefined, {
      fetchImpl: async () => {
        attempts += 1
        return new Response("down", { status: 503 })
      },
      sleep: async () => {},
    }),
    HttpError
  )

  assert.equal(attempts, 1)
})

test("Given resilientFetch with opt-in retries When the retry succeeds Then each attempt gets fresh init", async () => {
  const name = `unit-fetch-retry-${Date.now()}`
  const signals = []
  let attempts = 0

  const response = await resilientFetch(
    name,
    "https://example.test/unstable",
    undefined,
    {
      retries: 1,
      initForAttempt() {
        const controller = new AbortController()
        signals.push(controller.signal)
        return { signal: controller.signal }
      },
      fetchImpl: async () => {
        attempts += 1
        return new Response(attempts === 1 ? "down" : "ok", {
          status: attempts === 1 ? 503 : 200,
        })
      },
      sleep: async () => {},
    }
  )

  assert.equal(response.status, 200)
  assert.equal(attempts, 2)
  assert.equal(signals.length, 2)
  assert.notEqual(signals[0], signals[1])
})
