import assert from "node:assert/strict"
import { createHash, randomUUID } from "node:crypto"
import { spawn, spawnSync } from "node:child_process"
import { createRequire } from "node:module"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  realpathSync,
  rmSync,
  rmdirSync,
  openSync,
  closeSync,
} from "node:fs"
import { join, resolve } from "node:path"
import { pathToFileURL, fileURLToPath } from "node:url"
import { browserArguments } from "./browser-workload.mjs"
import {
  compareBrowserEvidence,
  inventoryFromPlaywright,
} from "./browser-parity.mjs"

const SELF = fileURLToPath(import.meta.url)
const MIB = 1024 * 1024
const hash = (value) => createHash("sha256").update(value).digest("hex")

export function validateExperiment(options) {
  assert.equal(options.schema, "nabaperks.browser-grouping-experiment.v1")
  const allowed = new Set([
    "schema",
    "repository",
    "output",
    "receiptRoot",
    "resourceMode",
    "cgroupRoot",
    "revision",
    "suite",
    "project",
    "heapMb",
    "timeoutMs",
    "budget",
  ])
  assert.ok(
    Object.keys(options).every((key) => allowed.has(key)),
    "Unknown experiment configuration field"
  )
  assert.ok(
    [undefined, "fresh-container", "delegated-cgroup"].includes(
      options.resourceMode
    ),
    "Unknown resource mode"
  )
  assert.ok(
    Object.keys(options.budget ?? {}).every((key) =>
      ["maxRssMb", "durationMs"].includes(key)
    ),
    "Unknown resource budget field"
  )
  assert.match(options.revision ?? "", /^[a-f0-9]{40}$/)
  for (const key of ["repository", "output"])
    assert.equal(resolve(options[key]), options[key], `${key} must be absolute`)
  if (options.resourceMode === "fresh-container") {
    assert.equal(
      resolve(options.receiptRoot),
      options.receiptRoot,
      "Host-only receiptRoot must be absolute"
    )
    for (const candidateRoot of [options.output, options.repository])
      assert.ok(
        options.receiptRoot !== candidateRoot &&
          !options.receiptRoot.startsWith(candidateRoot + "/"),
        "Host receipts must be outside candidate writable roots"
      )
  }
  if (options.resourceMode !== "fresh-container")
    assert.equal(
      resolve(options.cgroupRoot),
      options.cgroupRoot,
      "cgroupRoot must be absolute"
    )
  assert.ok(
    ["test:e2e", "test:a11y"].includes(options.suite),
    "Only local nonvisual suites are eligible"
  )
  browserArguments({
    plane: "local",
    suite: options.suite,
    project: options.project,
    shard: "1/8",
  })
  for (const key of ["maxRssMb", "durationMs"])
    assert.ok(
      Number.isFinite(options.budget?.[key]) && options.budget[key] > 0,
      `Explicit ${key} budget required`
    )
  assert.ok(
    Number.isSafeInteger(options.timeoutMs) &&
      options.timeoutMs > 0 &&
      options.timeoutMs <= 3_600_000,
    "Invocation timeout must be at most one hour"
  )
  assert.ok(
    Number.isInteger(options.heapMb) &&
      options.heapMb >= 1024 &&
      options.heapMb <= 16384
  )
  return options
}

function assertExecutionContext(options) {
  assert.equal(process.env.CI, "1")
  assert.equal(process.env.PLAYWRIGHT_WORKERS, "1")
  assert.equal(process.env.PLAYWRIGHT_REGULAR_CHROMIUM, "1")
  assert.equal(process.env.PLAYWRIGHT_NODE_HEAP_MB, String(options.heapMb))
  assert.notEqual(process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER, "1")
  for (const name of [".env", ".env.local"])
    assert.ok(
      !existsSync(join(options.repository, name)),
      "Checkout dotenv would change fixture semantics"
    )
  const revision = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: options.repository,
    encoding: "utf8",
  })
  assert.equal(revision.status, 0)
  assert.equal(revision.stdout.trim(), options.revision)
  const status = spawnSync(
    "git",
    ["status", "--porcelain", "--untracked-files=all"],
    { cwd: options.repository, encoding: "utf8" }
  )
  assert.equal(status.status, 0)
  assert.equal(
    status.stdout.trim(),
    "",
    "Pinned checkout changed or contains untracked tests"
  )
}

export function experimentDefinitionDigest(options) {
  const canonical = (value) =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [key, canonical(value[key])])
          )
        : value
  return hash(JSON.stringify(canonical(options)))
}

export function experimentArguments(options, phase, shard) {
  assert.ok(["before", "after"].includes(phase))
  const args = browserArguments({
    plane: "local",
    suite: options.suite,
    project: options.project,
    shard: `${shard}/8`,
  }).slice(1)
  // This is an experiment only. The active wrapper still rejects packed shards.
  return phase === "after"
    ? args.filter((arg) => !arg.startsWith("--shard="))
    : args
}

export function lifecycleMetrics(events) {
  assert.ok(Array.isArray(events))
  const starts = events.filter((event) => event.kind === "next-server-start")
  assert.ok(starts.length > 0, "Missing actual Next worker start observation")
  assert.ok(
    starts.every(
      (event) =>
        Number.isSafeInteger(event.pid) &&
        event.pid > 0 &&
        Number.isFinite(event.at)
    ),
    "Malformed lifecycle observation"
  )
  assert.equal(
    new Set(starts.map((event) => event.pid)).size,
    starts.length,
    "Duplicate Next worker startup observation"
  )
  return { serverStarts: starts.length, serverRestarts: starts.length - 1 }
}

export function invocationEvidence({
  report,
  policy,
  exitCode,
  signal,
  durationMs,
  memoryPeakBytes,
  memoryEvents,
  lifecycle,
  cgroupEmpty,
}) {
  assert.equal(exitCode, 0, "Browser process failed")
  assert.equal(signal, null, "Browser process was signalled")
  assert.equal(cgroupEmpty, true, "Invocation retained descendant processes")
  assert.ok(
    Array.isArray(report.errors),
    "Explicit global error report required"
  )
  assert.equal(report.errors.length, 0, "Global Playwright error")
  assert.ok(
    Number.isFinite(report.stats?.duration) && report.stats.duration >= 0,
    "Missing completed reporter duration"
  )
  for (const key of ["expected", "unexpected", "flaky", "skipped"])
    assert.ok(
      Number.isSafeInteger(report.stats[key]) && report.stats[key] >= 0,
      "Missing report outcome totals"
    )
  assert.equal(
    report.stats.unexpected + report.stats.flaky,
    0,
    "Unexpected or flaky tests cannot qualify"
  )
  const tests = inventoryFromPlaywright(report)
  assert.equal(
    tests.length,
    report.stats.expected + report.stats.skipped,
    "Report totals differ from complete inventory"
  )
  assert.ok(
    Number.isSafeInteger(memoryPeakBytes) && memoryPeakBytes > 0,
    "Missing fresh cgroup memory peak"
  )
  for (const key of ["oom", "oom_kill"])
    assert.equal(
      memoryEvents[key],
      0,
      "Cgroup OOM or missing memory event evidence"
    )
  assert.ok(Number.isFinite(durationMs) && durationMs > 0)
  return {
    tests,
    policy,
    execution: { exitCode, complete: true, globalErrors: report.errors },
    resources: {
      maxRssMb: memoryPeakBytes / MIB,
      durationMs,
      ...lifecycleMetrics(lifecycle),
    },
    measurement: {
      kind: "cgroup-v2-memory.peak",
      includesPageCache: true,
      notProcessRss: true,
    },
  }
}

export function aggregateInvocations(invocations) {
  assert.ok(invocations.length > 0)
  for (const invocation of invocations)
    assert.deepEqual(
      invocation.policy,
      invocations[0].policy,
      "Invocation policy drift"
    )
  return {
    tests: invocations.flatMap((entry) => entry.tests),
    policy: invocations[0].policy,
    execution: {
      exitCode: 0,
      complete: invocations.every(
        (entry) => entry.execution.complete && entry.execution.exitCode === 0
      ),
      globalErrors: invocations.flatMap(
        (entry) => entry.execution.globalErrors
      ),
    },
    resources: {
      maxRssMb: Math.max(
        ...invocations.map((entry) => entry.resources.maxRssMb)
      ),
      durationMs: invocations.reduce(
        (sum, entry) => sum + entry.resources.durationMs,
        0
      ),
      serverStarts: invocations.reduce(
        (sum, entry) => sum + entry.resources.serverStarts,
        0
      ),
      serverRestarts: invocations.reduce(
        (sum, entry) => sum + entry.resources.serverRestarts,
        0
      ),
    },
  }
}

export function derivedConfigSource({
  repository,
  reportPath,
  policyPath,
  preloadPath,
  outputDir,
  heapMb,
  browserIdentity,
}) {
  const nodeOptions = `--max-old-space-size=${heapMb} --require ${JSON.stringify(preloadPath)}`
  const replacement =
    "NODE_OPTIONS='" + nodeOptions.replaceAll("'", "'\"'\"'") + "'"
  return `import base from ${JSON.stringify(join(repository, "playwright.config.ts"))};
import assert from 'node:assert/strict';
import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
assert.equal(base.workers,1); assert.equal(base.retries,1); assert.equal(base.forbidOnly,true); assert.equal(base.failOnFlakyTests,true);
assert.ok(base.webServer && !Array.isArray(base.webServer)); assert.equal(base.webServer.reuseExistingServer,false);
assert.ok(!base.globalSetup && !base.globalTeardown, 'Review setup/teardown instrumentation before grouping');
const original=base.webServer.command;
const expected='NODE_OPTIONS=--max-old-space-size=${heapMb}';
assert.equal(original.split(expected).length,2,'Heap/command semantics changed');
const command=original.replace(expected, ${JSON.stringify(replacement)});
writeFileSync(${JSON.stringify(policyPath)},JSON.stringify({workers:base.workers,retries:base.retries,forbidOnly:base.forbidOnly,failOnFlakyTests:base.failOnFlakyTests,heapMb:${heapMb},platform:process.platform,architecture:process.arch,browserVersion:${JSON.stringify(browserIdentity)},configurationDigest:createHash('sha256').update(JSON.stringify(base)).digest('hex'),environmentDigest:createHash('sha256').update(JSON.stringify(Object.entries(process.env).filter(([key])=>/^(CI$|PLAYWRIGHT_|NEXT_PUBLIC_|SUPABASE_|CUSTOMER_|STRIPE_|TWILIO_|RESEND_|CRON_|PRODUCTION_)/.test(key)&&key!=='PLAYWRIGHT_NEXT_DIST_DIR').sort(([a],[b])=>a.localeCompare(b)))).digest('hex'),sourceConfigDigest:createHash('sha256').update(readFileSync(${JSON.stringify(join(repository, "playwright.config.ts"))})).digest('hex')}));
export default {...base,testDir:resolve(${JSON.stringify(repository)},base.testDir),outputDir:${JSON.stringify(outputDir)},reporter:[['json',{outputFile:${JSON.stringify(reportPath)}}]],webServer:{...base.webServer,cwd:base.webServer.cwd??${JSON.stringify(repository)},command}};
`
}

export function preloadSource(workerPath, lifecyclePath) {
  return `const fs=require('node:fs'); if(process.argv[1] && fs.realpathSync(process.argv[1])===${JSON.stringify(workerPath)}) {fs.appendFileSync(${JSON.stringify(lifecyclePath)},JSON.stringify({kind:'next-server-start',pid:process.pid,at:Date.now()})+'\\n');}`
}

function parsedCounters(text) {
  return Object.fromEntries(
    text
      .trim()
      .split("\n")
      .map((line) => {
        const [key, value] = line.split(/\s+/)
        return [key, Number(value)]
      })
  )
}

async function childInvocation(payload) {
  writeFileSync(join(payload.cgroup, "cgroup.procs"), String(process.pid))
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "node",
      "scripts/run-playwright.mjs",
      ...payload.args,
      "--config",
      payload.config,
    ],
    {
      cwd: payload.repository,
      env: { ...process.env, PLAYWRIGHT_NEXT_DIST_DIR: payload.distDir },
      stdio: "inherit",
    }
  )
  return result.signal ? 1 : (result.status ?? 1)
}

async function measuredInvocation(options, paths, args, distDir) {
  const cgroup = join(options.cgroupRoot, `grouping-${randomUUID()}`)
  mkdirSync(cgroup)
  let child, timer
  try {
    for (const file of [
      "memory.peak",
      "memory.events",
      "cgroup.procs",
      "cgroup.kill",
    ])
      assert.ok(
        existsSync(join(cgroup, file)),
        `Missing delegated cgroup support: ${file}`
      )
    assert.equal(
      readFileSync(join(cgroup, "cgroup.procs"), "utf8").trim(),
      "",
      "Fresh cgroup contains processes"
    )
    writeFileSync(join(cgroup, "cpu.max"), "1000000 100000")
    writeFileSync(
      join(cgroup, "memory.max"),
      String(Math.ceil(options.budget.maxRssMb * MIB))
    )
    const payload = {
      cgroup,
      args,
      config: paths.config,
      distDir,
      repository: options.repository,
    }
    writeFileSync(paths.payload, JSON.stringify(payload))
    const log = openSync(paths.log, "wx")
    const start = performance.now()
    try {
      child = spawn(process.execPath, [SELF, "--child", paths.payload], {
        cwd: options.repository,
        env: process.env,
        stdio: ["ignore", log, log],
      })
      timer = setTimeout(() => {
        writeFileSync(join(cgroup, "cgroup.kill"), "1")
        child.kill("SIGKILL")
      }, options.timeoutMs)
      const status = await new Promise((resolve, reject) => {
        child.once("error", reject)
        child.once("close", (exitCode, signal) => resolve({ exitCode, signal }))
      })
      clearTimeout(timer)
      const durationMs = performance.now() - start
      const counters = parsedCounters(
        readFileSync(join(cgroup, "memory.events"), "utf8")
      )
      const measurement = {
        ...status,
        durationMs,
        memoryPeakBytes: Number(
          readFileSync(join(cgroup, "memory.peak"), "utf8").trim()
        ),
        memoryEvents: counters,
        cgroupEmpty:
          readFileSync(join(cgroup, "cgroup.procs"), "utf8").trim() === "",
      }
      writeFileSync(paths.measurement, JSON.stringify(measurement, null, 2))
      return invocationEvidence({
        ...measurement,
        report: JSON.parse(readFileSync(paths.report, "utf8")),
        policy: JSON.parse(readFileSync(paths.policy, "utf8")),
        lifecycle: readFileSync(paths.lifecycle, "utf8")
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line)),
      })
    } finally {
      closeSync(log)
    }
  } finally {
    clearTimeout(timer)
    if (existsSync(join(cgroup, "cgroup.kill")))
      writeFileSync(join(cgroup, "cgroup.kill"), "1")
    // Only remove this experiment-created cgroup; never a parent/foreign group.
    try {
      rmdirSync(cgroup)
    } catch {
      /* Kernel may retain a dying child; operator gets path in payload. */
    }
  }
}

// A fresh existing job container may expose cgroup metrics read-only. The
// outer operational owner must create/inspect/remove it and provide a receipt;
// this inner process never pretends that its own success proves container exit.
export async function runFreshContainerInvocation(payload) {
  assert.equal(process.platform, "linux")
  assert.equal(payload.resourceMode, "fresh-container")
  assertExecutionContext(payload)
  assert.match(payload.invocationId, /^(before-[1-8]|after-1)$/)
  assert.match(payload.revision, /^[a-f0-9]{40}$/)
  const root = "/sys/fs/cgroup"
  for (const file of ["memory.peak", "memory.events", "memory.max", "cpu.max"])
    assert.ok(
      existsSync(join(root, file)),
      `Read-only cgroup metric missing: ${file}`
    )
  const initialEvents = parsedCounters(
    readFileSync(join(root, "memory.events"), "utf8")
  )
  assert.equal(initialEvents.oom, 0)
  assert.equal(initialEvents.oom_kill, 0)
  const start = performance.now()
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "node",
      "scripts/run-playwright.mjs",
      ...payload.args,
      "--config",
      payload.paths.config,
    ],
    {
      cwd: payload.repository,
      env: { ...process.env, PLAYWRIGHT_NEXT_DIST_DIR: payload.distDir },
      stdio: "inherit",
      timeout: payload.timeoutMs,
    }
  )
  const measurement = {
    subprocessExitCode: result.status,
    subprocessSignal: result.signal ?? null,
    durationMs: performance.now() - start,
    memoryPeakBytes: Number(
      readFileSync(join(root, "memory.peak"), "utf8").trim()
    ),
    memoryEvents: parsedCounters(
      readFileSync(join(root, "memory.events"), "utf8")
    ),
    memoryLimit: readFileSync(join(root, "memory.max"), "utf8").trim(),
    cpuLimit: readFileSync(join(root, "cpu.max"), "utf8").trim(),
    revision: payload.revision,
    invocationId: payload.invocationId,
    resourceMode: "fresh-container",
  }
  writeFileSync(payload.paths.measurement, JSON.stringify(measurement, null, 2))
  assert.ok(
    !result.error && result.status === 0 && !result.signal,
    "Browser subprocess failed; host must retain logs and inspect/clean the container"
  )
  assertExecutionContext(payload)
  return measurement
}

export function invocationBundleDigest(payload) {
  const records = [
    "payload",
    "config",
    "preload",
    "report",
    "policy",
    "lifecycle",
    "measurement",
  ].map((name) => {
    assert.ok(
      typeof payload.paths?.[name] === "string",
      `Missing invocation evidence file: ${name}`
    )
    return [name, hash(readFileSync(payload.paths[name]))]
  })
  return hash(JSON.stringify(records))
}

export function validateContainerReceipt(
  receipt,
  measurement,
  payload,
  budget,
  bundleDigest
) {
  assert.match(
    bundleDigest ?? "",
    /^[a-f0-9]{64}$/,
    "Actual invocation bundle digest required"
  )
  assert.equal(
    receipt.bundleDigest,
    bundleDigest,
    "Host receipt does not bind complete invocation evidence"
  )
  assert.equal(
    receipt.schema,
    "nabaperks.browser-grouping-container-receipt.v1"
  )
  assert.equal(receipt.revision, payload.revision)
  assert.equal(receipt.invocationId, payload.invocationId)
  assert.match(receipt.containerId ?? "", /^[a-f0-9]{64}$/)
  assert.match(receipt.imageDigest ?? "", /^sha256:[a-f0-9]{64}$/)
  assert.equal(receipt.freshContainer, true)
  assert.equal(receipt.exitCode, 0)
  assert.equal(receipt.oomKilled, false)
  assert.equal(receipt.removed, true)
  assert.equal(
    receipt.measurementDigest,
    hash(JSON.stringify(measurement)),
    "Host receipt must bind exact measured output"
  )
  assert.equal(receipt.resourcePolicy?.cpus, 10)
  assert.equal(
    receipt.resourcePolicy?.memoryBytes,
    Math.ceil(budget.maxRssMb * MIB)
  )
  assert.equal(
    Number(measurement.memoryLimit),
    receipt.resourcePolicy.memoryBytes
  )
  const [quota, period] = measurement.cpuLimit.split(/\s+/).map(Number)
  assert.ok(
    Number.isFinite(quota) &&
      Number.isFinite(period) &&
      period > 0 &&
      quota / period === 10,
    "Actual container CPU limit mismatch"
  )
  const created = Date.parse(receipt.createdAt),
    finished = Date.parse(receipt.finishedAt)
  assert.ok(
    Number.isFinite(created) &&
      Number.isFinite(finished) &&
      finished >= created,
    "Container timing evidence missing"
  )
  assert.equal(measurement.subprocessExitCode, 0)
  assert.equal(measurement.subprocessSignal, null)
  assert.equal(measurement.revision, payload.revision)
  assert.equal(measurement.invocationId, payload.invocationId)
  return {
    exitCode: receipt.exitCode,
    signal: null,
    cgroupEmpty: receipt.removed,
  }
}

export function prepareFreshContainerExperiment(options) {
  assert.equal(options.resourceMode, "fresh-container")
  validateExperiment(options)
  assertExecutionContext(options)
  assert.ok(!existsSync(options.output), "Evidence output must be new")
  const require = createRequire(join(options.repository, "package.json"))
  assert.equal(
    require("next/package.json").version,
    "16.2.12",
    "Review lifecycle instrumentation for another Next version"
  )
  const workerPath = realpathSync(
    require.resolve("next/dist/server/lib/start-server")
  )
  const playwright = require("playwright")
  const type = options.project.includes("safari")
    ? playwright.webkit
    : options.project.includes("firefox")
      ? playwright.firefox
      : playwright.chromium
  const browserIdentity = `${require("playwright/package.json").version}:${hash(readFileSync(type.executablePath()))}`
  mkdirSync(options.output, { recursive: true })
  const runId = randomUUID(),
    invocations = []
  for (const phase of ["before", "after"]) {
    const distDir = `.next-grouping-${runId}-${phase}`
    for (let index = 1; index <= (phase === "before" ? 8 : 1); index++) {
      const invocationId = `${phase}-${index}`,
        directory = join(options.output, invocationId)
      mkdirSync(directory)
      const paths = Object.fromEntries(
        ["report", "policy", "lifecycle", "measurement", "payload"].map(
          (name) => [name, join(directory, `${name}.json`)]
        )
      )
      paths.receipt = join(options.receiptRoot, `${invocationId}.json`)
      paths.config = join(directory, "playwright.config.mjs")
      const preloadPath = join(directory, "next-lifecycle.cjs")
      paths.preload = preloadPath
      writeFileSync(preloadPath, preloadSource(workerPath, paths.lifecycle))
      writeFileSync(
        paths.config,
        derivedConfigSource({
          repository: options.repository,
          reportPath: paths.report,
          policyPath: paths.policy,
          preloadPath,
          outputDir: join(directory, "test-results"),
          heapMb: options.heapMb,
          browserIdentity,
        })
      )
      const payload = {
        schema: options.schema,
        experimentDigest: experimentDefinitionDigest(options),
        revision: options.revision,
        suite: options.suite,
        project: options.project,
        heapMb: options.heapMb,
        resourceMode: "fresh-container",
        invocationId,
        repository: options.repository,
        args: experimentArguments(options, phase, index),
        distDir,
        timeoutMs: options.timeoutMs,
        paths,
      }
      writeFileSync(paths.payload, JSON.stringify(payload, null, 2))
      invocations.push(payload)
    }
  }
  writeFileSync(
    join(options.output, "prepared.json"),
    JSON.stringify({ options, invocations, browserIdentity }, null, 2)
  )
  return {
    activation: false,
    invocations: invocations.map((entry) => entry.paths.payload),
    requires:
      "Nine fresh identical job containers, serial before1..8 then after1; reviewed host receipts and owned per-phase cache mounts",
  }
}

export function collectFreshContainerExperiment(prepared) {
  const { options, invocations } = prepared
  assert.equal(options.resourceMode, "fresh-container")
  validateExperiment(options)
  assert.deepEqual(
    invocations.map((entry) => entry.invocationId),
    [
      ...Array.from({ length: 8 }, (_, index) => `before-${index + 1}`),
      "after-1",
    ]
  )
  const evidence = [],
    receipts = []
  for (const payload of invocations) {
    assert.deepEqual(
      JSON.parse(readFileSync(payload.paths.payload, "utf8")),
      payload,
      "Prepared payload changed"
    )
    assert.equal(
      payload.experimentDigest,
      experimentDefinitionDigest(options),
      "Experimental definition or budget changed"
    )
    assert.equal(payload.revision, options.revision)
    assert.deepEqual(
      payload.args,
      experimentArguments(
        options,
        payload.invocationId.startsWith("before") ? "before" : "after",
        Number(payload.invocationId.split("-")[1])
      ),
      "Experimental selection changed"
    )
    const measurement = JSON.parse(
      readFileSync(payload.paths.measurement, "utf8")
    )
    assert.equal(
      payload.paths.receipt,
      join(options.receiptRoot, `${payload.invocationId}.json`),
      "Host receipt location changed"
    )
    const receipt = JSON.parse(readFileSync(payload.paths.receipt, "utf8"))
    const status = validateContainerReceipt(
      receipt,
      measurement,
      payload,
      options.budget,
      invocationBundleDigest(payload)
    )
    if (receipts.length) {
      assert.equal(receipt.imageDigest, receipts[0].imageDigest)
      assert.ok(
        Date.parse(receipt.createdAt) >= Date.parse(receipts.at(-1).finishedAt),
        "Concurrent/out-of-order invocation"
      )
    }
    assert.ok(
      !receipts.some(
        (previous) => previous.containerId === receipt.containerId
      ),
      "Container reused across invocations"
    )
    receipts.push(receipt)
    evidence.push(
      invocationEvidence({
        ...measurement,
        ...status,
        report: JSON.parse(readFileSync(payload.paths.report, "utf8")),
        policy: JSON.parse(readFileSync(payload.paths.policy, "utf8")),
        lifecycle: readFileSync(payload.paths.lifecycle, "utf8")
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line)),
      })
    )
  }
  const before = aggregateInvocations(evidence.slice(0, 8)),
    after = aggregateInvocations(evidence.slice(8))
  assert.deepEqual(
    before.policy,
    after.policy,
    "Resolved browser configuration changed between arms"
  )
  const result = {
    revision: options.revision,
    project: options.project,
    suite: options.suite,
    activation: false,
    comparison: compareBrowserEvidence(before, after, options.budget),
    measurement:
      "whole fresh-container cgroup peak including setup/cache; not process RSS",
    hostReceiptsRequired: true,
  }
  writeFileSync(
    join(options.output, "comparison.json"),
    JSON.stringify(result, null, 2)
  )
  assert.equal(
    result.comparison.equivalent,
    true,
    "Grouping parity did not qualify"
  )
  return result
}

export async function runGroupingExperiment(options) {
  validateExperiment(options)
  assert.equal(
    process.platform,
    "linux",
    "Cgroup-qualified experiment requires Linux"
  )
  assert.ok(
    realpathSync(options.cgroupRoot).startsWith("/sys/fs/cgroup/"),
    "Delegated cgroup root required"
  )
  assert.equal(process.env.CI, "1")
  assert.equal(process.env.PLAYWRIGHT_WORKERS, "1")
  assert.equal(process.env.PLAYWRIGHT_REGULAR_CHROMIUM, "1")
  assert.equal(process.env.PLAYWRIGHT_NODE_HEAP_MB, String(options.heapMb))
  assert.notEqual(process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER, "1")
  for (const file of [".env", ".env.local"])
    assert.ok(
      !existsSync(join(options.repository, file)),
      "Checkout dotenv would change fixture/environment semantics"
    )
  assert.ok(!existsSync(options.output), "Evidence output must be new")
  const git = (args) => {
    const result = spawnSync("git", args, {
      cwd: options.repository,
      encoding: "utf8",
    })
    assert.equal(result.status, 0, "Git verification failed")
    return result.stdout.trim()
  }
  assert.equal(git(["rev-parse", "HEAD"]), options.revision)
  assert.equal(
    git(["status", "--porcelain", "--untracked-files=all"]),
    "",
    "Experiment needs a clean pinned checkout"
  )
  const require = createRequire(join(options.repository, "package.json"))
  const nextPackage = require("next/package.json")
  assert.equal(
    nextPackage.version,
    "16.2.12",
    "Review Next restart instrumentation for a different version"
  )
  const workerPath = realpathSync(
    require.resolve("next/dist/server/lib/start-server")
  )
  const playwright = require("playwright")
  const browserType = options.project.includes("safari")
    ? playwright.webkit
    : options.project.includes("firefox")
      ? playwright.firefox
      : playwright.chromium
  const executable = browserType.executablePath()
  const browserIdentity = `${require("playwright/package.json").version}:${hash(readFileSync(executable))}`
  mkdirSync(options.output, { recursive: true })
  const runId = randomUUID()
  const distDirs = []
  const phases = {}
  try {
    for (const phase of ["before", "after"]) {
      const distDir = `.next-grouping-${runId}-${phase}`
      assert.ok(!existsSync(join(options.repository, distDir)))
      distDirs.push(distDir)
      const invocations = []
      for (let index = 1; index <= (phase === "before" ? 8 : 1); index++) {
        const directory = join(options.output, `${phase}-${index}`)
        mkdirSync(directory)
        const paths = Object.fromEntries(
          ["report", "policy", "lifecycle", "measurement", "payload"].map(
            (name) => [name, join(directory, `${name}.json`)]
          )
        )
        paths.config = join(directory, "playwright.config.mjs")
        paths.log = join(directory, "process.log")
        const preloadPath = join(directory, "next-lifecycle.cjs")
        writeFileSync(preloadPath, preloadSource(workerPath, paths.lifecycle))
        writeFileSync(
          paths.config,
          derivedConfigSource({
            repository: options.repository,
            reportPath: paths.report,
            policyPath: paths.policy,
            preloadPath,
            outputDir: join(directory, "test-results"),
            heapMb: options.heapMb,
            browserIdentity,
          })
        )
        invocations.push(
          await measuredInvocation(
            options,
            paths,
            experimentArguments(options, phase, index),
            distDir
          )
        )
      }
      phases[phase] = aggregateInvocations(invocations)
      writeFileSync(
        join(options.output, `${phase}.json`),
        JSON.stringify(phases[phase], null, 2)
      )
    }
    assert.equal(
      hash(readFileSync(executable)),
      browserIdentity.split(":").at(-1),
      "Browser executable changed during experiment"
    )
    assert.equal(
      git([
        "status",
        "--porcelain",
        "--untracked-files=all",
        "--",
        "tests/e2e",
      ]),
      "",
      "Browser tests or snapshots changed"
    )
    assert.equal(
      git(["diff", "--name-only", options.revision]),
      "",
      "Tracked source/snapshots changed during experiment"
    )
    assert.deepEqual(
      phases.before.policy,
      phases.after.policy,
      "Resolved browser configuration changed between arms"
    )
    const comparison = compareBrowserEvidence(
      phases.before,
      phases.after,
      options.budget
    )
    const result = {
      schema: options.schema,
      revision: options.revision,
      suite: options.suite,
      project: options.project,
      comparison,
      activation: false,
      measurement:
        "fresh per-invocation cgroup memory.peak (includes cache; conservative memory budget, not RSS)",
      instrumentation: {
        reporter: "Playwright JSON",
        nextWorkerPreload: true,
        nextVersion: nextPackage.version,
      },
      beforeInvocations: 8,
      afterInvocations: 1,
    }
    writeFileSync(
      join(options.output, "comparison.json"),
      JSON.stringify(result, null, 2)
    )
    assert.equal(
      comparison.equivalent,
      true,
      "Grouping experiment did not qualify"
    )
    return result
  } finally {
    for (const dir of distDirs)
      rmSync(join(options.repository, dir), { recursive: true, force: true })
  }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  try {
    if (process.argv[2] === "--prepare-containers")
      console.log(
        JSON.stringify(
          prepareFreshContainerExperiment(
            JSON.parse(readFileSync(process.argv[3], "utf8"))
          )
        )
      )
    else if (process.argv[2] === "--container-invocation")
      await runFreshContainerInvocation(
        JSON.parse(readFileSync(process.argv[3], "utf8"))
      )
    else if (process.argv[2] === "--collect-containers")
      console.log(
        JSON.stringify(
          collectFreshContainerExperiment(
            JSON.parse(readFileSync(process.argv[3], "utf8"))
          )
        )
      )
    else if (process.argv[2] === "--child")
      process.exitCode = await childInvocation(
        JSON.parse(readFileSync(process.argv[3], "utf8"))
      )
    else {
      assert.equal(
        process.argv.length,
        3,
        "Experiment configuration JSON required"
      )
      console.log(
        JSON.stringify(
          await runGroupingExperiment(
            JSON.parse(readFileSync(process.argv[2], "utf8"))
          )
        )
      )
    }
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
