import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { lstat, readFile, realpath } from "node:fs/promises"
import { relative, resolve, sep } from "node:path"

export const TASK20A_ROUTES = Object.freeze([
  "/",
  "/pricing",
  "/loyalty-for-pubs",
  "/signup",
])
export const TASK20A_RUNS_PER_ROUTE = 3
export const TASK20A_BLOCKING_LCP_MS = 4_000
export const TASK20A_ASPIRATIONAL_LCP_MS = 2_500

export async function verifyTask20ALighthouseReceipt(receipt, receiptRoot) {
  assert.equal(receipt.schema, "nabaperks.task20a-lighthouse.v1")
  assert.match(receipt.revision, /^[a-f0-9]{40}$/)
  assert.equal(receipt.candidate.revision, receipt.revision)
  assert.match(receipt.candidate.parent, /^[a-f0-9]{40}$/)
  assert.match(receipt.candidate.tree, /^[a-f0-9]{40}$/)
  assert.equal(receipt.candidate.clean, true)
  assert.equal(receipt.server.revision, receipt.revision)
  assert.match(receipt.server.origin, /^http:\/\/127\.0\.0\.1:\d+$/)
  assert.equal(receipt.server.runtime, "next start production build")
  assert.equal(receipt.server.port, Number(new URL(receipt.server.origin).port))
  assert.match(receipt.chrome.version, /^Google Chrome \d+\./)
  assert.doesNotMatch(receipt.chrome.executable, /headless-shell/i)
  assert.ok(Number.isInteger(receipt.chrome.devtoolsPort))
  assert.ok(receipt.chrome.devtoolsPort > 0)
  assert.equal(receipt.environmentFixture, "task20a-ci-non-secret")
  assert.equal(receipt.blocking.measurement, "real-chrome-devtools")
  assert.equal(receipt.blocking.aggregation, "median-of-exactly-three")
  assert.equal(receipt.blocking.lcpThresholdMs, TASK20A_BLOCKING_LCP_MS)
  assert.equal(receipt.blocking.runsPerRoute, TASK20A_RUNS_PER_ROUTE)
  assert.equal(
    receipt.informationalTelemetry.measurement,
    "simulated-mobile-lantern"
  )
  assert.equal(
    receipt.informationalTelemetry.runsPerRoute,
    TASK20A_RUNS_PER_ROUTE
  )
  assert.equal(
    receipt.aspirationalGoodLine.lcpThresholdMs,
    TASK20A_ASPIRATIONAL_LCP_MS
  )
  assert.equal(receipt.aspirationalGoodLine.nonBlocking, true)
  assert.equal(receipt.composite.retries, 0)
  assert.equal(receipt.composite.phases.length, 2)
  for (const phase of receipt.composite.phases) {
    assert.equal(phase.exitCode, 0)
    assert.equal(phase.signal, null)
    assert.ok(Array.isArray(phase.argv))
  }
  assert.deepEqual(
    receipt.blocking.routes.map(({ route }) => route),
    TASK20A_ROUTES
  )

  const routes = await Promise.all(
    receipt.blocking.routes.map(async (route) => {
      const devtoolsSamples = await readLcpSamples({
        expectedRoute: route.route,
        measurement: "provided",
        receiptRoot,
        reports: route.rawReports,
        serverOrigin: receipt.server.origin,
      })
      const simulatedMobileSamples = await readLcpSamples({
        expectedRoute: route.route,
        measurement: "simulate",
        receiptRoot,
        reports: route.simulatedMobileRawReports,
        serverOrigin: receipt.server.origin,
      })
      const medianLcpMs = median(devtoolsSamples)
      return {
        route: route.route,
        devtoolsLcpSamplesMs: devtoolsSamples,
        medianLcpMs,
        simulatedMobileLcpSamplesMs: simulatedMobileSamples,
        blockingVerdict:
          medianLcpMs <= TASK20A_BLOCKING_LCP_MS ? "PASS" : "FAIL",
        aspirationalGoodLine:
          medianLcpMs <= TASK20A_ASPIRATIONAL_LCP_MS
            ? "good"
            : "above-good-line-non-blocking",
      }
    })
  )
  await verifyLegacyEvidence(receipt.legacy, receiptRoot)
  return {
    verdict: routes.every(({ blockingVerdict }) => blockingVerdict === "PASS")
      ? "PASS"
      : "FAIL",
    routes,
  }
}

export function median(values) {
  assert.equal(values.length, TASK20A_RUNS_PER_ROUTE)
  const sorted = [...values].sort((left, right) => left - right)
  const value = sorted[1]
  assert.ok(Number.isFinite(value), "median requires finite values")
  return value
}

async function readLcpSamples(options) {
  assert.equal(
    options.reports.length,
    TASK20A_RUNS_PER_ROUTE,
    `route ${options.expectedRoute} requires exactly three raw ${options.measurement === "provided" ? "DevTools" : "simulated-mobile"} reports`
  )
  assert.equal(
    new Set(options.reports).size,
    TASK20A_RUNS_PER_ROUTE,
    `route ${options.expectedRoute} raw report paths must be unique`
  )
  return Promise.all(
    options.reports.map(async (reportPath) => {
      const sourcePath = await resolveInside(options.receiptRoot, reportPath)
      const source = await readFile(sourcePath, "utf8")
      const report = JSON.parse(source)
      assert.equal(report.configSettings?.throttlingMethod, options.measurement)
      assert.equal(
        report.requestedUrl,
        `${options.serverOrigin}${options.expectedRoute}`
      )
      assert.equal(
        report.finalUrl,
        `${options.serverOrigin}${options.expectedRoute}`
      )
      const value = report.audits?.["largest-contentful-paint"]?.numericValue
      assert.ok(
        Number.isFinite(value),
        "LCP must be a finite raw numeric value"
      )
      return value
    })
  )
}

async function verifyLegacyEvidence(legacy, receiptRoot) {
  assert.equal(typeof legacy, "object", "legacy proof is required")
  assert.ok(Array.isArray(legacy.rawReports), "legacy raw reports are required")
  assert.equal(
    legacy.rawReports.length,
    12,
    "legacy proof requires exactly twelve raw reports"
  )
  assert.equal(
    new Set(legacy.rawReports).size,
    12,
    "legacy raw report paths must be unique"
  )
  assert.equal(typeof legacy.assertionSummary, "string")
  assert.equal(typeof legacy.hashes, "object", "legacy hashes are required")
  assert.match(legacy.serverOrigin, /^http:\/\/127\.0\.0\.1:\d+$/)
  const routeCounts = new Map(TASK20A_ROUTES.map((route) => [route, 0]))
  for (const reportPath of legacy.rawReports) {
    const sourcePath = await resolveInside(receiptRoot, reportPath)
    const source = await readFile(sourcePath, "utf8")
    assert.equal(legacy.hashes[reportPath], sha256(source))
    const report = JSON.parse(source)
    const finalUrl = new URL(report.finalUrl)
    const route = finalUrl.pathname
    assert.ok(routeCounts.has(route), "legacy report route must be expected")
    routeCounts.set(route, (routeCounts.get(route) ?? 0) + 1)
    assert.equal(finalUrl.origin, legacy.serverOrigin)
    assert.equal(report.requestedUrl, `${legacy.serverOrigin}${route}`)
    assert.ok(
      report.audits && report.categories,
      "legacy report must be an LHR"
    )
  }
  assert.deepEqual([...routeCounts.values()], [3, 3, 3, 3])
  const summaryPath = await resolveInside(receiptRoot, legacy.assertionSummary)
  const summary = await readFile(summaryPath, "utf8")
  assert.equal(legacy.hashes[legacy.assertionSummary], sha256(summary))
  const parsedSummary = JSON.parse(summary)
  assert.equal(parsedSummary.reportCount, 12)
  assert.equal(parsedSummary.results.length, 12)
  for (const report of parsedSummary.results) {
    assert.ok(Array.isArray(report.results))
    assert.ok(report.results.length > 0)
    assert.equal(
      report.results.some(({ name }) => name === "largest-contentful-paint"),
      false
    )
    assert.equal(
      report.results.every(({ passed }) => passed === true),
      true
    )
  }
}

function sha256(source) {
  return createHash("sha256").update(source).digest("hex")
}

async function resolveInside(root, candidate) {
  assert.equal(typeof candidate, "string", "raw report path must be a string")
  const resolvedRoot = await realpath(root)
  const resolvedCandidate = resolve(resolvedRoot, candidate)
  const pathFromRoot = relative(resolvedRoot, resolvedCandidate)
  assert.ok(
    pathFromRoot &&
      !pathFromRoot.startsWith(`..${sep}`) &&
      pathFromRoot !== "..",
    "raw report path must remain inside the receipt directory"
  )
  await assertNoSymlinkComponents(resolvedRoot, pathFromRoot)
  return resolvedCandidate
}

async function assertNoSymlinkComponents(root, relativePath) {
  let currentPath = root
  for (const component of relativePath.split(sep)) {
    currentPath = resolve(currentPath, component)
    const status = await lstat(currentPath)
    assert.equal(
      status.isSymbolicLink(),
      false,
      "receipt path cannot contain a symlink"
    )
  }
}
