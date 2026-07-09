import assert from "node:assert/strict"
import { test } from "node:test"

import {
  CircuitOpenError,
  HttpError,
  resilientCall,
  resilientFetch,
} from "../../lib/observability/resilience.ts"

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
    resilientCall(
      name,
      async () => "unexpected",
      {
        retry: {
          retries: 2,
          onRetry() {
            retries += 1
          },
          sleep: async () => {},
        },
      }
    ),
    CircuitOpenError
  )

  assert.equal(retries, 0)
})

test("Given resilientFetch without opt-in retries When a server response fails Then it makes one attempt", async () => {
  const name = `unit-fetch-no-retry-${Date.now()}`
  let attempts = 0

  await assert.rejects(
    resilientFetch(
      name,
      "https://example.test/unstable",
      undefined,
      {
        fetchImpl: async () => {
          attempts += 1
          return new Response("down", { status: 503 })
        },
        sleep: async () => {},
      }
    ),
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
