import assert from "node:assert/strict"
import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  symlink,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, relative, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import test from "node:test"

import { verifyTask20ALighthouseReceipt } from "../../scripts/task20a-devtools-lighthouse.mjs"
import { parseCompositeArguments } from "../../scripts/task20a-lighthouse-composite.mjs"
import { outputPath } from "../../scripts/task20a-lighthouse-runtime.mjs"

const ROUTES = ["/", "/pricing", "/loyalty-for-pubs", "/signup"]

test("Task20A composite accepts an output directory before either audit phase", () => {
  assert.deepEqual(
    parseCompositeArguments(["--output-dir", "reports/task20a"]),
    ["--output-dir", "reports/task20a"]
  )
  assert.deepEqual(
    parseCompositeArguments(["--", "--output-dir", "reports/task20a"]),
    ["--output-dir", "reports/task20a"]
  )
  assert.throws(() =>
    parseCompositeArguments(["--output-dir", "--prompt-like"])
  )
  assert.deepEqual(
    parseCompositeArguments(["--verify-receipt", "receipt.json"]),
    ["--verify-receipt", "receipt.json"]
  )
})

test("Task20A public composite verifier returns PASS without launching an audit", async () => {
  const root = await mkdtemp(join(tmpdir(), "nabaperks-task20a-receipt-"))
  const receipt = await writeValidReceipt(root, {
    devtoolsValues: [2_000, 3_000, 4_000],
    simulatedValues: [5_100, 5_200, 5_300],
  })
  const receiptPath = join(root, "receipt.json")
  await writeFile(receiptPath, JSON.stringify(receipt))

  const result = spawnSync(
    process.execPath,
    [
      "scripts/task20a-lighthouse-composite.mjs",
      "--verify-receipt",
      receiptPath,
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, TASK20A_AUDIT_SENTINEL: join(root, "audit-ran") },
    }
  )

  assert.equal(result.status, 0, result.stderr)
  await assert.rejects(() => access(join(root, "audit-ran")))
})

test("Task20A rejects output directories with a symlink component before mutation", async () => {
  const root = await mkdtemp(join(tmpdir(), "nabaperks-task20a-root-"))
  const external = await mkdtemp(join(tmpdir(), "nabaperks-task20a-external-"))
  await symlink(external, join(root, "reports"))

  await assert.rejects(
    () => outputPath(root, "reports/composite", "a".repeat(40)),
    /symlink/i
  )
  assert.equal(resolve(external), external)
})

test("Task20A receipt keeps simulated-mobile results informational while DevTools medians gate", async () => {
  const root = await mkdtemp(join(tmpdir(), "nabaperks-task20a-receipt-"))
  const receipt = await writeValidReceipt(root, {
    devtoolsValues: [2_000, 3_000, 4_000],
    simulatedValues: [5_100, 5_200, 5_300],
  })

  const outcome = await verifyTask20ALighthouseReceipt(receipt, root)

  assert.equal(outcome.verdict, "PASS")
  assert.equal(outcome.routes[0]?.medianLcpMs, 3_000)
  assert.deepEqual(
    outcome.routes[0]?.simulatedMobileLcpSamplesMs,
    [5_100, 5_200, 5_300]
  )
})

test("Task20A receipt fails closed when a DevTools route has fewer than three raw samples", async () => {
  const root = await mkdtemp(join(tmpdir(), "nabaperks-task20a-receipt-"))
  const receipt = await writeValidReceipt(root, {
    devtoolsValues: [2_000, 3_000, 4_000],
    simulatedValues: [2_000, 2_100, 2_200],
  })
  receipt.blocking.routes[0].rawReports.pop()

  await assert.rejects(
    () => verifyTask20ALighthouseReceipt(receipt, root),
    /exactly three raw DevTools reports/
  )
})

test("Task20A receipt rejects a median above the blocking LCP threshold", async () => {
  const root = await mkdtemp(join(tmpdir(), "nabaperks-task20a-receipt-"))
  const receipt = await writeValidReceipt(root, {
    devtoolsValues: [4_001, 4_100, 4_200],
    simulatedValues: [2_000, 2_100, 2_200],
  })

  const outcome = await verifyTask20ALighthouseReceipt(receipt, root)

  assert.equal(outcome.verdict, "FAIL")
  assert.equal(outcome.routes[0]?.blockingVerdict, "FAIL")
})

test("Task20A receipt fails closed when required identity or policy fields are absent", async () => {
  const requiredFields = [
    ["candidate", "parent"],
    ["candidate", "tree"],
    ["candidate", "clean"],
    ["server", "runtime"],
    ["chrome", "devtoolsPort"],
    ["blocking", "aggregation"],
    ["aspirationalGoodLine", "lcpThresholdMs"],
    ["aspirationalGoodLine", "nonBlocking"],
    ["environmentFixture"],
  ]
  for (const path of requiredFields) {
    const root = await mkdtemp(join(tmpdir(), "nabaperks-task20a-receipt-"))
    const receipt = await writeValidReceipt(root, {
      devtoolsValues: [2_000, 3_000, 4_000],
      simulatedValues: [2_000, 2_100, 2_200],
    })
    let current = receipt
    for (const segment of path.slice(0, -1)) current = current[segment]
    delete current[path.at(-1)]

    await assert.rejects(() => verifyTask20ALighthouseReceipt(receipt, root))
  }
})

test("Task20A receipt fails closed when legacy machine-readable proof is missing", async () => {
  const root = await mkdtemp(join(tmpdir(), "nabaperks-task20a-receipt-"))
  const receipt = await writeValidReceipt(root, {
    devtoolsValues: [2_000, 3_000, 4_000],
    simulatedValues: [2_000, 2_100, 2_200],
  })
  delete receipt.legacy

  await assert.rejects(
    () => verifyTask20ALighthouseReceipt(receipt, root),
    /legacy/i
  )
})

async function writeValidReceipt(root, values) {
  const routes = []
  for (const [routeIndex, route] of ROUTES.entries()) {
    const devtoolsReports = await writeReports(
      root,
      "devtools",
      route,
      values.devtoolsValues,
      "provided"
    )
    const simulatedReports = await writeReports(
      root,
      "simulated-mobile",
      route,
      values.simulatedValues,
      "simulate"
    )
    routes.push({
      route,
      routeIndex,
      rawReports: devtoolsReports,
      simulatedMobileRawReports: simulatedReports,
    })
  }

  return {
    schema: "nabaperks.task20a-lighthouse.v1",
    revision: "a".repeat(40),
    candidate: {
      revision: "a".repeat(40),
      parent: "b".repeat(40),
      tree: "c".repeat(40),
      clean: true,
    },
    server: {
      origin: "http://127.0.0.1:3130",
      revision: "a".repeat(40),
      port: 3130,
      runtime: "next start production build",
    },
    chrome: {
      executable:
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      version: "Google Chrome 151.0.7922.172",
      devtoolsPort: 9222,
    },
    blocking: {
      measurement: "real-chrome-devtools",
      aggregation: "median-of-exactly-three",
      lcpThresholdMs: 4_000,
      runsPerRoute: 3,
      routes,
    },
    informationalTelemetry: {
      measurement: "simulated-mobile-lantern",
      runsPerRoute: 3,
    },
    legacy: await writeLegacyEvidence(root),
    composite: {
      retries: 0,
      phases: [
        {
          argv: ["audit"],
          command: "node",
          exitCode: 0,
          phase: "DevTools LCP median",
          signal: null,
        },
        {
          argv: ["autorun"],
          command: "pnpm",
          exitCode: 0,
          phase: "legacy non-LCP Lighthouse assertions",
          signal: null,
        },
      ],
    },
    aspirationalGoodLine: { lcpThresholdMs: 2_500, nonBlocking: true },
    environmentFixture: "task20a-ci-non-secret",
  }
}

async function writeLegacyEvidence(root) {
  const legacyDirectory = join(root, "legacy")
  await mkdir(legacyDirectory, { recursive: true })
  const rawReports = await Promise.all(
    Array.from({ length: 12 }, async (_, index) => {
      const reportPath = join(
        legacyDirectory,
        `legacy-${index + 1}.report.json`
      )
      await writeFile(
        reportPath,
        JSON.stringify({
          requestedUrl: `http://127.0.0.1:3130${ROUTES[index % ROUTES.length]}`,
          finalUrl: `http://127.0.0.1:3130${ROUTES[index % ROUTES.length]}`,
          audits: { "first-contentful-paint": { numericValue: 1_000 } },
          categories: { accessibility: { score: 1 } },
        })
      )
      return relative(root, reportPath)
    })
  )
  const assertionSummary = join(legacyDirectory, "assertion-summary.json")
  const summary = JSON.stringify({
    reportCount: rawReports.length,
    results: rawReports.map((reportPath) => ({
      reportPath,
      results: [{ name: "categories:accessibility", passed: true, value: 1 }],
    })),
  })
  await writeFile(assertionSummary, summary)
  const hashes = {}
  for (const reportPath of rawReports) {
    const source = await readFile(join(root, reportPath), "utf8")
    hashes[reportPath] = createHash("sha256").update(source).digest("hex")
  }
  const summaryPath = relative(root, assertionSummary)
  hashes[summaryPath] = createHash("sha256").update(summary).digest("hex")
  return {
    rawReports,
    assertionSummary: summaryPath,
    hashes,
    serverOrigin: "http://127.0.0.1:3130",
  }
}

async function writeReports(root, group, route, samples, throttlingMethod) {
  const routeDir = join(root, group, route === "/" ? "home" : route.slice(1))
  await mkdir(routeDir, { recursive: true })
  return Promise.all(
    samples.map(async (value, index) => {
      const reportPath = join(routeDir, `run-${index + 1}.json`)
      await writeFile(
        reportPath,
        JSON.stringify({
          requestedUrl: `http://127.0.0.1:3130${route}`,
          finalUrl: `http://127.0.0.1:3130${route}`,
          configSettings: { throttlingMethod },
          audits: { "largest-contentful-paint": { numericValue: value } },
        })
      )
      return relative(root, reportPath)
    })
  )
}
