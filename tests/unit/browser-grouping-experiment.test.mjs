import test from "node:test"
import assert from "node:assert/strict"
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  realpathSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
  validateExperiment,
  experimentArguments,
  lifecycleMetrics,
  invocationEvidence,
  aggregateInvocations,
  derivedConfigSource,
  preloadSource,
  validateContainerReceipt,
  invocationBundleDigest,
  experimentDefinitionDigest,
} from "../../scripts/ci/browser-grouping-experiment.mjs"

const options = {
  schema: "nabaperks.browser-grouping-experiment.v1",
  repository: "/workspace",
  output: "/evidence",
  revision: "a".repeat(40),
  suite: "test:a11y",
  project: "chromium",
  heapMb: 12288,
  timeoutMs: 600000,
  budget: { maxRssMb: 32768, durationMs: 600000 },
  resourceMode: "fresh-container",
  receiptRoot: "/host-only-receipts",
}
const policy = {
  workers: 1,
  retries: 1,
  failOnFlakyTests: true,
  forbidOnly: true,
  heapMb: 12288,
  platform: "linux",
  architecture: "arm64",
  browserVersion: "verified-executable-digest",
}
function invocation() {
  return {
    report: {
      errors: [],
      stats: { duration: 10, expected: 1, unexpected: 0, flaky: 0, skipped: 0 },
      suites: [
        {
          title: "a.spec.ts",
          file: "a.spec.ts",
          specs: [
            {
              title: "works",
              file: "a.spec.ts",
              tests: [
                {
                  projectName: "chromium",
                  status: "expected",
                  results: [{ status: "passed" }],
                  annotations: [],
                },
              ],
            },
          ],
        },
      ],
    },
    policy,
    exitCode: 0,
    signal: null,
    durationMs: 20,
    memoryPeakBytes: 1000,
    memoryEvents: { oom: 0, oom_kill: 0 },
    lifecycle: [{ kind: "next-server-start", pid: 12, at: 1 }],
    cgroupEmpty: true,
  }
}

test("pilot retains all eight original selections and only removes sharding after", () => {
  validateExperiment(options)
  for (let i = 1; i <= 8; i++) {
    const before = experimentArguments(options, "before", i)
    assert.ok(before.includes(`--shard=${i}/8`))
    assert.deepEqual(
      before.filter((arg) => !arg.startsWith("--shard=")),
      experimentArguments(options, "after", 1)
    )
    assert.ok(before.includes("--ignore-snapshots"))
    assert.ok(before.includes("@visual"))
    assert.ok(before.includes("@a11y"))
  }
  assert.throws(
    () => validateExperiment({ ...options, suite: "test:visual" }),
    /nonvisual/
  )
  assert.throws(
    () => validateExperiment({ ...options, project: "desktop-firefox" }),
    /Unknown/
  )
})
test("missing global teardown, memory or lifecycle evidence cannot become parity", () => {
  const good = invocationEvidence(invocation())
  assert.equal(good.resources.serverRestarts, 0)
  for (const change of [
    { exitCode: 1 },
    { signal: "SIGKILL" },
    { memoryPeakBytes: 0 },
    { memoryEvents: {} },
    { lifecycle: [] },
    { cgroupEmpty: false },
  ])
    assert.throws(() => invocationEvidence({ ...invocation(), ...change }))
  const report = invocation().report
  delete report.errors
  assert.throws(
    () => invocationEvidence({ ...invocation(), report }),
    /Explicit global/
  )
})
test("actual extra Next worker starts remain restarts and aggregation preserves them", () => {
  assert.equal(
    lifecycleMetrics([
      { kind: "next-server-start", pid: 12, at: 1 },
      { kind: "next-server-start", pid: 14, at: 2 },
    ]).serverRestarts,
    1
  )
  const first = invocationEvidence(invocation()),
    second = invocationEvidence({
      ...invocation(),
      lifecycle: [
        { kind: "next-server-start", pid: 12, at: 1 },
        { kind: "next-server-start", pid: 14, at: 2 },
      ],
    })
  const all = aggregateInvocations([first, second])
  assert.equal(all.resources.serverRestarts, 1)
  assert.equal(all.resources.serverStarts, 3)
  assert.throws(
    () =>
      aggregateInvocations([
        first,
        { ...second, policy: { ...second.policy, workers: 2 } },
      ]),
    /policy drift/
  )
})
test("derived config changes reporter and lifecycle observation while preserving test policy", async () => {
  const directory = mkdtempSync(join(tmpdir(), "grouping-config-"))
  try {
    const original = {
      testDir: "./tests/e2e",
      workers: 1,
      retries: 1,
      forbidOnly: true,
      failOnFlakyTests: true,
      fullyParallel: true,
      timeout: 180000,
      use: { trace: "retain-on-failure" },
      projects: [{ name: "chromium", testMatch: ["**/*.desktop.spec.ts"] }],
      webServer: {
        command:
          "PORT=3146 NODE_OPTIONS=--max-old-space-size=12288 pnpm exec next dev --turbopack",
        url: "http://127.0.0.1:3146/signup",
        reuseExistingServer: false,
        timeout: 180000,
      },
    }
    writeFileSync(
      join(directory, "playwright.config.ts"),
      `export default ${JSON.stringify(original)}`
    )
    const config = join(directory, "derived.mjs"),
      policyPath = join(directory, "policy.json")
    writeFileSync(
      config,
      derivedConfigSource({
        repository: directory,
        reportPath: join(directory, "report.json"),
        policyPath,
        preloadPath: join(directory, "space and $() ' quote.cjs"),
        outputDir: join(directory, "results"),
        heapMb: 12288,
        browserIdentity: "pinned",
      })
    )
    const { default: derived } = await import(pathToFileURL(config).href)
    for (const key of [
      "workers",
      "retries",
      "forbidOnly",
      "failOnFlakyTests",
      "fullyParallel",
      "timeout",
      "use",
      "projects",
    ])
      assert.deepEqual(derived[key], original[key])
    assert.equal(derived.webServer.url, original.webServer.url)
    assert.equal(derived.webServer.timeout, original.webServer.timeout)
    assert.match(derived.webServer.command, /NODE_OPTIONS='/)
    assert.equal(JSON.parse(readFileSync(policyPath, "utf8")).heapMb, 12288)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
test("preload emits a real newline-delimited process start without starting a server", () => {
  const directory = mkdtempSync(join(tmpdir(), "grouping-preload-"))
  try {
    const worker = join(directory, "worker.cjs"),
      preload = join(directory, "preload.cjs"),
      log = join(directory, "lifecycle.json")
    writeFileSync(worker, "")
    writeFileSync(preload, preloadSource(realpathSync(worker), log))
    const result = spawnSync(process.execPath, ["--require", preload, worker], {
      encoding: "utf8",
    })
    assert.equal(result.status, 0, result.stderr)
    const text = readFileSync(log, "utf8")
    assert.ok(text.endsWith("\n"))
    assert.equal(JSON.parse(text).kind, "next-server-start")
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
test("fresh container success requires host exit cleanup resource and measurement binding", () => {
  const payload = { revision: options.revision, invocationId: "before-1" }
  const measurement = {
    subprocessExitCode: 0,
    subprocessSignal: null,
    revision: payload.revision,
    invocationId: payload.invocationId,
    memoryLimit: String(32768 * 1024 * 1024),
    cpuLimit: "1000000 100000",
  }
  const receipt = {
    schema: "nabaperks.browser-grouping-container-receipt.v1",
    ...payload,
    containerId: "a".repeat(64),
    imageDigest: "sha256:" + "b".repeat(64),
    bundleDigest: "d".repeat(64),
    freshContainer: true,
    exitCode: 0,
    oomKilled: false,
    removed: true,
    measurementDigest: createHash("sha256")
      .update(JSON.stringify(measurement))
      .digest("hex"),
    resourcePolicy: { cpus: 10, memoryBytes: 32768 * 1024 * 1024 },
    createdAt: "2026-09-07T00:00:00Z",
    finishedAt: "2026-09-07T00:01:00Z",
  }
  assert.equal(
    validateContainerReceipt(
      receipt,
      measurement,
      payload,
      options.budget,
      "d".repeat(64)
    ).cgroupEmpty,
    true
  )
  for (const change of [
    { removed: false },
    { exitCode: 1 },
    { freshContainer: false },
    { measurementDigest: "c".repeat(64) },
    { resourcePolicy: { cpus: 2, memoryBytes: 32768 * 1024 * 1024 } },
  ])
    assert.throws(() =>
      validateContainerReceipt(
        { ...receipt, ...change },
        measurement,
        payload,
        options.budget,
        "d".repeat(64)
      )
    )
})

test("host bundle digest covers test identity, skip and lifecycle evidence after container exit", () => {
  const directory = mkdtempSync(join(tmpdir(), "grouping-bundle-"))
  try {
    const names = [
      "payload",
      "config",
      "preload",
      "report",
      "policy",
      "lifecycle",
      "measurement",
    ]
    const payload = {
      paths: Object.fromEntries(
        names.map((name) => [name, join(directory, name)])
      ),
    }
    for (const name of names)
      writeFileSync(payload.paths[name], JSON.stringify({ name }))
    const baseline = invocationBundleDigest(payload)
    for (const name of names) {
      const original = readFileSync(payload.paths[name])
      writeFileSync(payload.paths[name], "changed")
      assert.notEqual(invocationBundleDigest(payload), baseline, name)
      writeFileSync(payload.paths[name], original)
    }
    assert.throws(
      () =>
        validateExperiment({
          ...options,
          receiptRoot: options.output + "/receipts",
        }),
      /outside candidate/
    )
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("experimental definition digest binds budget selection and runtime policy", () => {
  const digest = experimentDefinitionDigest(options)
  for (const change of [
    { budget: { ...options.budget, durationMs: 999999 } },
    { heapMb: 8192 },
    { suite: "test:e2e" },
    { revision: "b".repeat(40) },
  ])
    assert.notEqual(
      experimentDefinitionDigest({ ...options, ...change }),
      digest
    )
  assert.throws(
    () => validateExperiment({ ...options, unknown: "ignored" }),
    /Unknown experiment/
  )
  assert.throws(
    () => validateExperiment({ ...options, resourceMode: "typo" }),
    /Unknown resource/
  )
})
