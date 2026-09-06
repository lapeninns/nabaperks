import assert from "node:assert/strict"
import { createHash, createHmac, randomUUID } from "node:crypto"
import {
  closeSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { isAbsolute, join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const ROOT = new URL("../../", import.meta.url)
const CONTRACT = JSON.parse(
  readFileSync(
    new URL("config/independent-monitoring-contract.json", ROOT),
    "utf8"
  )
)
const SLO = JSON.parse(
  readFileSync(new URL("config/production-slos.json", ROOT), "utf8")
)
const HASH = /^[a-f0-9]{64}$/
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex")

export function validateMonitorConfig(config) {
  assert.equal(config.schema, "nabaperks.independent-monitor-runtime.v1")
  assert.equal(
    config.origin,
    "https://nabaperks.com",
    "canonical production origin required"
  )
  assert.ok(
    isAbsolute(config.stateDirectory),
    "absolute independently hosted state directory required"
  )
  assert.ok(
    !resolve(config.stateDirectory).startsWith(resolve(new URL(ROOT).pathname)),
    "monitor state must be outside source checkout"
  )
  assert.ok(
    Number.isInteger(config.intervalSeconds) &&
      config.intervalSeconds >= 60 &&
      config.intervalSeconds <= 300,
    "independent scheduler cadence must be 60-300 seconds"
  )
  assert.ok(
    config.expectedRevision === "" ||
      /^[a-f0-9]{12}(?:[a-f0-9]{28})?$/.test(config.expectedRevision),
    "invalid expected revision"
  )
  for (const role of ["scheduler", "runtime", "state", "paging"]) {
    const inventory = config.dependencies?.[role]
    assert.equal(
      inventory?.inventoryComplete,
      true,
      `${role} reviewed dependency inventory required`
    )
    assert.ok(
      Array.isArray(inventory.dependencies) &&
        inventory.dependencies.length > 0,
      `${role} dependencies required`
    )
    assert.ok(
      inventory.dependencies.includes(inventory.provider),
      `${role} provider must be inventoried`
    )
    for (const item of inventory.dependencies) {
      assert.match(
        item,
        /^[a-z0-9][a-z0-9:_.-]{0,127}$/,
        "canonical dependency identifier required"
      )
      assert.ok(
        !CONTRACT.forbiddenPagingDependencies.some(
          (blocked) => item === blocked || item.startsWith(`${blocked}:`)
        ),
        `${role} shares a prohibited failure domain`
      )
    }
  }
  const endpoint = new URL(config.webhookUrl)
  assert.ok(
    endpoint.protocol === "https:" &&
      !endpoint.username &&
      !endpoint.password &&
      !endpoint.port &&
      !endpoint.search &&
      !endpoint.hash,
    "independent receiver must use public HTTPS without URL credentials or overrides"
  )
  assert.ok(
    /^[a-z0-9.-]+\.[a-z]{2,}$/.test(endpoint.hostname),
    "public receiver hostname required"
  )
  assert.ok(
    ![
      "github.com",
      "githubusercontent.com",
      "supabase.co",
      "supabase.com",
      "nabaperks.com",
      "localhost",
      "local",
      "invalid",
    ].some(
      (host) =>
        endpoint.hostname === host || endpoint.hostname.endsWith(`.${host}`)
    ),
    "receiver shares monitored/control-plane failure domain or is unconfigured"
  )
  assert.equal(
    config.dependencies.paging.hostname,
    endpoint.hostname,
    "reviewed receiver hostname binding required"
  )
  return config
}

export function loadMonitorConfig(file, expectedDigest) {
  assert.match(expectedDigest ?? "", HASH, "protected config SHA-256 required")
  const bytes = readFileSync(file)
  assert.equal(
    digest(bytes),
    expectedDigest,
    "runtime config changed without protected review"
  )
  return {
    config: validateMonitorConfig(JSON.parse(bytes)),
    configDigest: expectedDigest,
  }
}

export function initialMonitorState(configDigest) {
  return {
    schema: "nabaperks.independent-monitor-state.v1",
    configDigest,
    lastObservedAt: null,
    incident: null,
    healthyCount: 0,
    outbox: [],
  }
}

function validateState(state, configDigest) {
  assert.equal(state.schema, "nabaperks.independent-monitor-state.v1")
  assert.equal(
    state.configDigest,
    configDigest,
    "state belongs to different reviewed config"
  )
  assert.ok(
    Array.isArray(state.outbox) && state.outbox.length <= 64,
    "invalid monitor outbox"
  )
  assert.ok(
    Number.isInteger(state.healthyCount) &&
      state.healthyCount >= 0 &&
      state.healthyCount <= 2,
    "invalid recovery streak"
  )
  assert.ok(
    state.incident === null ||
      (typeof state.incident.id === "string" &&
        Number.isFinite(Date.parse(state.incident.openedAt))),
    "invalid incident state"
  )
  for (const event of state.outbox) {
    assert.deepEqual(
      Object.keys(event).sort(),
      [
        "action",
        "deliveryId",
        "environment",
        "incidentId",
        "occurredAt",
        "schema",
        "service",
        "summary",
      ],
      "unexpected pending payload fields"
    )
    assert.ok(
      event.schema === "nabaperks.independent-monitor-alert.v1" &&
        ["trigger", "resolve"].includes(event.action) &&
        typeof event.deliveryId === "string" &&
        typeof event.incidentId === "string" &&
        Number.isFinite(Date.parse(event.occurredAt)),
      "invalid pending event"
    )
    assert.equal(event.service, "nabaperks")
    assert.equal(event.environment, "production")
    assert.equal(
      event.summary,
      event.action === "trigger"
        ? "Production health or readiness failed"
        : "Two consecutive timely production observations passed"
    )
  }
}

export async function observeProduction({
  config,
  monitorSecret,
  fetcher = fetch,
  clock = () => performance.now(),
  wallClock = () => new Date(),
}) {
  assert.ok(
    typeof monitorSecret === "string" && monitorSecret.length >= 32,
    "monitor credential required"
  )
  const results = []
  for (const [route, scope, status, limit] of [
    ["health", "liveness", "ok", SLO.thresholds.livenessResponseMs],
    ["readiness", "readiness", "ready", SLO.thresholds.readinessResponseMs],
  ]) {
    try {
      const started = clock()
      const response = await fetcher(`${config.origin}/api/${route}`, {
        method: "GET",
        redirect: "error",
        cache: "no-store",
        headers:
          route === "readiness"
            ? { authorization: `Bearer ${monitorSecret}` }
            : {},
        signal: AbortSignal.timeout(10_000),
      })
      assert.equal(response.ok, true)
      const body = await response.json()
      assert.ok(clock() - started <= limit)
      assert.equal(body.scope, scope)
      assert.equal(body.status, status)
      assert.equal(body.service, "nabaperks")
      assert.equal(body.environment, "production")
      assert.equal(body.targetEnvironment, "production")
      assert.ok(
        typeof body.time === "string" && Number.isFinite(Date.parse(body.time))
      )
      const responseAgeMs = wallClock().getTime() - Date.parse(body.time)
      assert.ok(
        Number.isFinite(responseAgeMs) &&
          responseAgeMs >= -5_000 &&
          responseAgeMs <= Math.min(30_000, config.intervalSeconds * 1000),
        "production response is stale or from the future"
      )
      assert.match(body.revision, /^[a-f0-9]{12}$/)
      if (config.expectedRevision)
        assert.equal(body.revision, config.expectedRevision.slice(0, 12))
      if (route === "readiness") {
        assert.equal(body.checks?.database, "ok")
        assert.equal(body.checks?.operational, "ok")
        for (const key of [
          "notificationQueueAgeMinutes",
          "loyaltyInviteQueueAgeMinutes",
          "providerDeliveryFailureRate24h",
        ])
          assert.ok(
            Number.isFinite(body.signals?.[key]) && body.signals[key] >= 0
          )
        assert.ok(
          Array.isArray(body.signals?.cronJobs) &&
            body.signals.cronJobs.length === 7
        )
      }
      results.push({ scope, healthy: true })
    } catch {
      results.push({ scope, healthy: false })
    }
  }
  return { healthy: results.every((result) => result.healthy), checks: results }
}

export function applyObservation(
  state,
  observation,
  config,
  at,
  uuid = randomUUID
) {
  const now = new Date(at)
  assert.ok(Number.isFinite(now.getTime()), "invalid observation clock")
  const previous =
    state.lastObservedAt === null ? null : new Date(state.lastObservedAt)
  if (previous) assert.ok(now > previous, "observation clock must advance")
  const timely =
    previous &&
    now - previous >= config.intervalSeconds * 0.8 * 1000 &&
    now - previous <= config.intervalSeconds * 2 * 1000
  state.lastObservedAt = now.toISOString()
  const enqueue = (action, incident) => {
    assert.ok(
      state.outbox.length < 64,
      "monitor delivery backlog requires operator recovery"
    )
    state.outbox.push({
      schema: "nabaperks.independent-monitor-alert.v1",
      service: "nabaperks",
      environment: "production",
      action,
      incidentId: incident.id,
      deliveryId: uuid(),
      occurredAt: now.toISOString(),
      summary:
        action === "trigger"
          ? "Production health or readiness failed"
          : "Two consecutive timely production observations passed",
    })
  }
  if (!observation.healthy) {
    state.healthyCount = 0
    if (!state.incident) {
      state.incident = { id: uuid(), openedAt: now.toISOString() }
      enqueue("trigger", state.incident)
    }
  } else if (state.incident) {
    state.healthyCount = timely ? Math.min(2, state.healthyCount + 1) : 1
    if (state.healthyCount === 2) {
      enqueue("resolve", state.incident)
      state.incident = null
      state.healthyCount = 0
    }
  }
  return state
}

export async function deliverEvent(
  event,
  {
    config,
    webhookSecret,
    fetcher = fetch,
    sleeper = (ms) => new Promise((r) => setTimeout(r, ms)),
  }
) {
  assert.ok(
    typeof webhookSecret === "string" && webhookSecret.length >= 32,
    "receiver signing credential required"
  )
  const body = JSON.stringify(event)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const timestamp = String(Math.floor(Date.now() / 1000))
      const response = await fetcher(config.webhookUrl, {
        method: "POST",
        body,
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
        headers: {
          "content-type": "application/json",
          "x-nabaperks-delivery": event.deliveryId,
          "x-nabaperks-timestamp": timestamp,
          "x-nabaperks-signature": `v1=${createHmac("sha256", webhookSecret).update(`${timestamp}.${body}`).digest("hex")}`,
        },
      })
      if (response.ok)
        return { receiverAccepted: true, status: response.status }
      if (response.status !== 429 && response.status < 500)
        return { receiverAccepted: false, retryable: false }
    } catch {
      /* Retry transient transport failure without exposing provider bodies. */
    }
    if (attempt < 2) await sleeper(2 ** attempt * 1000)
  }
  return { receiverAccepted: false, retryable: true }
}

function privateDirectory(directory) {
  const stat = lstatSync(directory)
  assert.ok(
    stat.isDirectory() && !stat.isSymbolicLink() && (stat.mode & 0o077) === 0,
    "state directory must be private and not a symlink"
  )
}

function saveState(directory, state) {
  const temp = join(directory, `state-${randomUUID()}.tmp`)
  const fd = openSync(temp, "wx", 0o600)
  try {
    writeFileSync(fd, JSON.stringify(state))
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
  renameSync(temp, join(directory, "state.json"))
  const directoryFd = openSync(directory, "r")
  try {
    fsyncSync(directoryFd)
  } finally {
    closeSync(directoryFd)
  }
}

export async function runMonitorOnce({
  config,
  configDigest,
  monitorSecret,
  webhookSecret,
  fetcher = fetch,
  now = () => new Date(),
  sleeper,
}) {
  validateMonitorConfig(config)
  assert.ok(
    monitorSecret?.length >= 32 && webhookSecret?.length >= 32,
    "independent runtime credentials required"
  )
  privateDirectory(config.stateDirectory)
  const lock = join(config.stateDirectory, "run.lock")
  mkdirSync(lock, { mode: 0o700 })
  try {
    const stateFile = join(config.stateDirectory, "state.json")
    const stat = lstatSync(stateFile)
    assert.ok(
      stat.isFile() && !stat.isSymbolicLink() && (stat.mode & 0o077) === 0,
      "private provisioned monitor state required"
    )
    const state = JSON.parse(readFileSync(stateFile, "utf8"))
    validateState(state, configDigest)
    const observation = await observeProduction({
      config,
      monitorSecret,
      fetcher,
      wallClock: now,
    })
    applyObservation(state, observation, config, now())
    saveState(config.stateDirectory, state)
    let accepted = 0
    while (state.outbox.length && accepted < 3) {
      const receipt = await deliverEvent(state.outbox[0], {
        config,
        webhookSecret,
        fetcher,
        sleeper,
      })
      assert.ok(
        receipt.receiverAccepted,
        "independent receiver acceptance failed; durable event retained"
      )
      state.outbox.shift()
      saveState(config.stateDirectory, state)
      accepted++
    }
    assert.equal(
      state.outbox.length,
      0,
      "delivery backlog remains for next independent invocation"
    )
    return {
      schema: "nabaperks.independent-monitor-run.v1",
      ...observation,
      receiverAcceptedEvents: accepted,
      lastObservedAt: state.lastObservedAt,
      incidentOpen: state.incident !== null,
      assurance: "receiver-acceptance-only",
    }
  } finally {
    rmSync(lock, { recursive: true })
  }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  try {
    assert.ok(
      process.argv.length === 3 ||
        (process.argv.length === 4 && process.argv[3] === "--init"),
      "configuration path required"
    )
    const { config, configDigest } = loadMonitorConfig(
      process.argv[2],
      process.env.INDEPENDENT_MONITOR_CONFIG_SHA256
    )
    if (process.argv[3] === "--init") {
      mkdirSync(config.stateDirectory, { mode: 0o700 })
      privateDirectory(config.stateDirectory)
      saveState(config.stateDirectory, initialMonitorState(configDigest))
      console.log(
        "Independent monitor state initialised; no network request made."
      )
    } else {
      const result = await runMonitorOnce({
        config,
        configDigest,
        monitorSecret: process.env.INDEPENDENT_MONITOR_SECRET,
        webhookSecret: process.env.INDEPENDENT_WEBHOOK_SECRET,
      })
      console.log(JSON.stringify(result))
      if (!result.healthy) process.exitCode = 2
    }
  } catch {
    console.error(
      "Independent monitor failed; inspect protected runtime state and scheduler logs."
    )
    process.exitCode = 1
  }
}
