import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { test } from "node:test"

import {
  resolveProductionAlertConfig,
  sendProductionAlert,
  trustedAlertEndpoint,
} from "../../scripts/notify-production-alert.mjs"

const ENV = {
  PRODUCTION_ALERT_WEBHOOK_URL: "https://alerts.example.net/nabaperks",
  PRODUCTION_ALERT_WEBHOOK_SECRET: "a".repeat(32),
  GITHUB_REPOSITORY: "lapeninns/nabaperks",
  GITHUB_SERVER_URL: "https://github.com",
  GITHUB_RUN_ID: "123456",
  EXPECTED_REVISION: "abcdef1234567890abcdef1234567890abcdef12",
}

test("production alert config accepts only the expected repository and immutable revision", () => {
  assert.deepEqual(resolveProductionAlertConfig(ENV), {
    endpoint: "https://alerts.example.net/nabaperks",
    repository: "lapeninns/nabaperks",
    revision: "abcdef123456",
    runUrl: "https://github.com/lapeninns/nabaperks/actions/runs/123456",
    secret: "a".repeat(32),
  })

  assert.throws(
    () =>
      resolveProductionAlertConfig({
        ...ENV,
        GITHUB_REPOSITORY: "attacker/fork",
      }),
    /lapeninns\/nabaperks/
  )
  assert.throws(
    () =>
      resolveProductionAlertConfig({
        ...ENV,
        EXPECTED_REVISION: "main",
      }),
    /Git SHA/
  )
})

test("production alert endpoints fail closed for mutable, local and credential-bearing URLs", () => {
  assert.equal(
    trustedAlertEndpoint("https://alerts.example.net/nabaperks"),
    "https://alerts.example.net/nabaperks"
  )
  for (const endpoint of [
    "http://alerts.example.net/hook",
    "https://localhost/hook",
    "https://127.0.0.1/hook",
    "https://10.1.2.3/hook",
    "https://user:pass@alerts.example.net/hook",
    "https://alerts.example.net:8443/hook",
    "https://alerts.example.net/hook?token=secret",
  ]) {
    assert.equal(trustedAlertEndpoint(endpoint), null)
  }
})

test("production alert delivery is signed, idempotent and retries only transient failures", async () => {
  const requests = []
  const responses = [
    new Response(null, { status: 503 }),
    new Response(null, { status: 202 }),
  ]
  const result = await sendProductionAlert({
    action: "trigger",
    env: ENV,
    now: () => new Date("2026-07-22T22:00:00.000Z"),
    randomUUID: () => "018f0000-0000-7000-8000-000000000001",
    sleeper: async () => {},
    fetcher: async (url, init) => {
      requests.push({ url: String(url), init })
      return responses.shift()
    },
  })

  assert.deepEqual(result, { attempt: 2, status: 202 })
  assert.equal(requests.length, 2)
  assert.equal(requests[0].url, ENV.PRODUCTION_ALERT_WEBHOOK_URL)
  assert.equal(requests[0].init.body, requests[1].init.body)
  assert.deepEqual(requests[0].init.headers, requests[1].init.headers)

  const payload = JSON.parse(requests[0].init.body)
  assert.equal(payload.action, "trigger")
  assert.equal(payload.kind, "readiness")
  assert.equal(payload.dedupKey, "nabaperks-production-readiness")
  assert.equal(payload.revision, "abcdef123456")
  assert.equal(payload.deliveryId, "018f0000-0000-7000-8000-000000000001")

  const timestamp = requests[0].init.headers["x-nabaperks-timestamp"]
  const expectedSignature = createHmac(
    "sha256",
    ENV.PRODUCTION_ALERT_WEBHOOK_SECRET
  )
    .update(`${timestamp}.${requests[0].init.body}`)
    .digest("hex")
  assert.equal(
    requests[0].init.headers["x-nabaperks-signature"],
    `v1=${expectedSignature}`
  )
})

test("production alert supports a separate availability-SLO incident key", async () => {
  let payload
  await sendProductionAlert({
    action: "trigger",
    kind: "availability-slo",
    env: ENV,
    fetcher: async (_url, init) => {
      payload = JSON.parse(init.body)
      return new Response(null, { status: 202 })
    },
  })

  assert.equal(payload.kind, "availability-slo")
  assert.equal(payload.dedupKey, "nabaperks-production-availability-slo")
  assert.match(payload.summary, /availability SLO/)

  await assert.rejects(
    sendProductionAlert({
      action: "trigger",
      kind: "arbitrary",
      env: ENV,
      fetcher: async () => new Response(null, { status: 202 }),
    }),
    /alert kind/
  )
})

test("production alert release canaries use an isolated incident key", async () => {
  let payload
  await sendProductionAlert({
    action: "trigger",
    kind: "release-canary",
    env: ENV,
    fetcher: async (_url, init) => {
      payload = JSON.parse(init.body)
      return new Response(null, { status: 202 })
    },
  })

  assert.equal(payload.kind, "release-canary")
  assert.equal(payload.dedupKey, "nabaperks-production-release-canary")
})

test("production alert delivery does not retry receiver contract failures", async () => {
  let calls = 0
  await assert.rejects(
    sendProductionAlert({
      action: "resolve",
      env: { ...ENV, EXPECTED_REVISION: "" },
      fetcher: async () => {
        calls += 1
        return new Response(null, { status: 401 })
      },
      sleeper: async () => {},
    }),
    /rejected delivery with HTTP 401/
  )
  assert.equal(calls, 1)
})
