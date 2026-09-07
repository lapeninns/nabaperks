import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  symlinkSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import {
  applyObservation,
  canonicalAlert,
  deliverEvent,
  initialMonitorState,
  observeProduction,
  runMonitorOnce,
  validateMonitorConfig,
} from "../../ops/monitoring/independent-monitor.mjs"

const secret = "fixture-only-secret-".repeat(3)
const wallClock = () => new Date("2026-09-06T12:00:00.000Z")
function config(stateDirectory = "/var/lib/nabaperks-monitor") {
  const inventory = (provider) => ({
    inventoryComplete: true,
    provider,
    dependencies: [provider],
  })
  return {
    schema: "nabaperks.independent-monitor-runtime.v1",
    origin: "https://nabaperks.com",
    stateDirectory,
    intervalSeconds: 60,
    expectedRevision: "a".repeat(40),
    webhookUrl: "https://pager.example.test/events",
    dependencies: {
      scheduler: inventory("independent-scheduler"),
      runtime: inventory("independent-runtime"),
      state: inventory("independent-state"),
      paging: {
        ...inventory("independent-pager"),
        hostname: "pager.example.test",
      },
    },
  }
}
function probeResponse(url) {
  const readiness = String(url).endsWith("readiness")
  return Response.json({
    service: "nabaperks",
    scope: readiness ? "readiness" : "liveness",
    status: readiness ? "ready" : "ok",
    revision: "a".repeat(12),
    environment: "production",
    targetEnvironment: "production",
    time: "2026-09-06T12:00:00.000Z",
    checks: { database: "ok", operational: "ok" },
    signals: {
      notificationQueueAgeMinutes: 0,
      loyaltyInviteQueueAgeMinutes: 0,
      providerDeliveryFailureRate24h: 0,
      cronJobs: Array(7).fill({}),
    },
  })
}

test("runtime rejects shared failure domains, unreviewed inventories and provider-hosted receiver", () => {
  validateMonitorConfig(config())
  for (const role of ["scheduler", "runtime", "state", "paging"]) {
    const value = config()
    value.dependencies[role].dependencies.push(
      "supabase:skonlhwstejberyzobep:database"
    )
    assert.throws(() => validateMonitorConfig(value), /prohibited/)
    value.dependencies[role].dependencies = ["github:actions"]
    value.dependencies[role].provider = "github:actions"
    assert.throws(() => validateMonitorConfig(value), /prohibited/)
  }
  const value = config()
  value.webhookUrl =
    "https://skonlhwstejberyzobep.supabase.co/functions/v1/production-alert"
  assert.throws(() => validateMonitorConfig(value), /failure domain/)
})

test("independent probes preserve production semantics, narrow bearer scope and enforce latency", async () => {
  const seen = []
  const fetcher = async (url, options) => {
    seen.push({ url, options })
    return probeResponse(url)
  }
  assert.equal(
    (
      await observeProduction({
        config: config(),
        monitorSecret: secret,
        fetcher,
        wallClock,
      })
    ).healthy,
    true
  )
  assert.deepEqual(seen[0].options.headers, {})
  assert.equal(seen[1].options.headers.authorization, `Bearer ${secret}`)
  assert.equal(seen[1].options.redirect, "error")
  let tick = 0
  assert.equal(
    (
      await observeProduction({
        config: config(),
        monitorSecret: secret,
        fetcher,
        wallClock,
        clock: () => (tick += 6000),
      })
    ).healthy,
    false
  )
  assert.equal(
    (
      await observeProduction({
        config: config(),
        monitorSecret: secret,
        fetcher: async () => Response.json({ status: "ok" }),
      })
    ).healthy,
    false
  )
})

test("stale or future production responses cannot suppress outage or advance recovery", async () => {
  for (const route of ["health", "readiness"]) {
    for (const time of [
      "2026-09-06T11:59:29.999Z",
      "2026-09-06T12:00:05.001Z",
    ]) {
      const fetcher = async (url) => {
        const response = await probeResponse(url).json()
        if (String(url).endsWith(route)) response.time = time
        return Response.json(response)
      }
      const observation = await observeProduction({
        config: config(),
        monitorSecret: secret,
        fetcher,
        wallClock,
      })
      assert.equal(observation.healthy, false)
      assert.equal(
        observation.checks.find(
          (check) =>
            check.scope === (route === "health" ? "liveness" : "readiness")
        ).healthy,
        false
      )
      const state = initialMonitorState("a".repeat(64))
      applyObservation(
        state,
        { healthy: false },
        config(),
        new Date("2026-09-06T11:58:00.000Z")
      )
      applyObservation(
        state,
        { healthy: true },
        config(),
        new Date("2026-09-06T11:59:00.000Z")
      )
      applyObservation(state, observation, config(), wallClock())
      assert.notEqual(state.incident, null)
      assert.equal(state.healthyCount, 0)
      assert.deepEqual(
        state.outbox.map((event) => event.action),
        ["trigger"]
      )
    }
  }
  assert.equal(
    (
      await observeProduction({
        config: config(),
        monitorSecret: secret,
        fetcher: async (url) => probeResponse(url),
        wallClock: () => new Date("2026-09-06T12:00:30.000Z"),
      })
    ).healthy,
    true
  )
})

test("outages dedupe and recovery requires two spaced green observations; failures and gaps reset streak", () => {
  const state = initialMonitorState("a".repeat(64))
  const apply = (healthy, minute) =>
    applyObservation(
      state,
      { healthy },
      config(),
      new Date(Date.UTC(2026, 8, 6, 12, minute))
    )
  apply(false, 0)
  apply(false, 1)
  assert.equal(state.outbox.length, 1)
  apply(true, 2)
  apply(false, 3)
  apply(true, 4)
  assert.notEqual(state.incident, null)
  apply(true, 10)
  assert.notEqual(state.incident, null)
  apply(true, 11)
  assert.equal(state.incident, null)
  assert.deepEqual(
    state.outbox.map((event) => event.action),
    ["trigger", "resolve"]
  )
  assert.equal(state.outbox[0].incidentId, state.outbox[1].incidentId)
  assert.notEqual(state.outbox[0].deliveryId, state.outbox[1].deliveryId)
})

test("signed receiver retries preserve event identity and never label acceptance delivered", async () => {
  const event = validEvent()
  const calls = []
  const receipt = await deliverEvent(event, {
    config: config(),
    webhookSecret: secret,
    sleeper: async () => {},
    fetcher: async (_url, options) => {
      calls.push(options)
      return new Response("", { status: calls.length < 3 ? 503 : 202 })
    },
  })
  assert.deepEqual(receipt, { receiverAccepted: true, status: 202 })
  assert.equal(calls.length, 3)
  for (const call of calls) {
    assert.equal(call.headers["x-nabaperks-delivery"], event.deliveryId)
    assert.equal(
      call.headers["x-nabaperks-signature"],
      `v1=${createHmac("sha256", secret).update(`${call.headers["x-nabaperks-timestamp"]}.${call.body}`).digest("hex")}`
    )
  }
  let rejects = 0
  assert.equal(
    (
      await deliverEvent(event, {
        config: config(),
        webhookSecret: secret,
        fetcher: async () => {
          rejects++
          return new Response("", { status: 401 })
        },
      })
    ).receiverAccepted,
    false
  )
  assert.equal(rejects, 1)
})

test("durable outbox survives failed delivery and next process sends same event; overlap fails closed", async (t) => {
  const directory = realpathSync(
    mkdtempSync(join(tmpdir(), "independent-monitor-"))
  )
  t.after(() => rmSync(directory, { force: true, recursive: true }))
  const configDigest = "a".repeat(64)
  writeFileSync(
    join(directory, "state.json"),
    JSON.stringify(initialMonitorState(configDigest)),
    { mode: 0o600 }
  )
  let fail = true
  const ids = []
  const fetcher = async (url, options) => {
    if (String(url).includes("pager.example.test")) {
      ids.push(options.headers["x-nabaperks-delivery"])
      return new Response("", { status: fail ? 503 : 202 })
    }
    return new Response("", { status: 503 })
  }
  const options = {
    config: config(directory),
    configDigest,
    monitorSecret: secret,
    webhookSecret: secret,
    fetcher,
    sleeper: async () => {},
    now: () => new Date("2026-09-06T12:00:00.000Z"),
  }
  await assert.rejects(runMonitorOnce(options), /event retained/)
  const pending = JSON.parse(
    readFileSync(join(directory, "state.json"), "utf8")
  )
  assert.equal(pending.outbox.length, 1)
  fail = false
  const report = await runMonitorOnce({
    ...options,
    now: () => new Date("2026-09-06T12:01:00.000Z"),
  })
  assert.equal(report.healthy, false)
  assert.equal(report.receiverAcceptedEvents, 1)
  assert.equal(report.lastObservedAt, "2026-09-06T12:01:00.000Z")
  assert.equal(new Set(ids).size, 1)
  assert.equal(
    JSON.parse(readFileSync(join(directory, "state.json"), "utf8")).outbox
      .length,
    0
  )
  mkdirSync(join(directory, "run.lock"))
  await assert.rejects(runMonitorOnce(options), /EEXIST/)
})

function validEvent() {
  return {
    schema: "nabaperks.independent-monitor-alert.v1",
    service: "nabaperks",
    environment: "production",
    action: "trigger",
    incidentId: "11111111-1111-4111-8111-111111111111",
    deliveryId: "22222222-2222-4222-8222-222222222222",
    occurredAt: "2026-09-06T12:00:00.000Z",
    summary: "Production health or readiness failed",
  }
}

test("outbound boundaries reject unapproved destinations and non-protocol persisted data before transport", async () => {
  let calls = 0
  const fetcher = async () => {
    calls++
    return new Response(null, { status: 202 })
  }
  await assert.rejects(
    observeProduction({
      config: { ...config(), origin: "https://unapproved.example" },
      monitorSecret: secret,
      fetcher,
    }),
    /canonical/
  )
  await assert.rejects(
    deliverEvent(validEvent(), {
      config: { ...config(), webhookUrl: "http://127.0.0.1/events" },
      webhookSecret: secret,
      fetcher,
    }),
    /HTTPS/
  )
  for (const event of [
    { ...validEvent(), extra: "unapproved file contents" },
    { ...validEvent(), deliveryId: "arbitrary file contents" },
    { ...validEvent(), incidentId: "../private" },
    { ...validEvent(), occurredAt: "2026-09-06" },
    { ...validEvent(), summary: "unapproved copy" },
  ])
    await assert.rejects(
      deliverEvent(event, { config: config(), webhookSecret: secret, fetcher })
    )
  assert.equal(calls, 0)
  const event = validEvent()
  assert.deepEqual(canonicalAlert(event), event)
  assert.notEqual(canonicalAlert(event), event)
})

test("monitor refuses a symlink ancestor before reading or delivering persisted state", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "monitor-ancestry-")))
  try {
    const state = join(root, "private")
    mkdirSync(state, { mode: 0o700 })
    writeFileSync(
      join(state, "state.json"),
      JSON.stringify(initialMonitorState("a".repeat(64))),
      { mode: 0o600 }
    )
    symlinkSync(root, join(root, "alias"), "dir")
    let calls = 0
    await assert.rejects(
      runMonitorOnce({
        config: config(join(root, "alias", "private")),
        configDigest: "a".repeat(64),
        monitorSecret: secret,
        webhookSecret: secret,
        fetcher: async () => {
          calls++
          throw Error("unexpected")
        },
      }),
      /symlink/
    )
    assert.equal(calls, 0)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
