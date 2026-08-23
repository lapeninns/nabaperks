import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { readdir, readFile, writeFile } from "node:fs/promises"
import { relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { verifyTask20ALighthouseReceipt } from "./task20a-lighthouse-policy.mjs"

const DEVTOOLS_RUNNER = "scripts/task20a-devtools-lighthouse.mjs"

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  run(parseCompositeArguments(process.argv.slice(2))).catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error))
    process.exitCode = 1
  })
}

export function parseCompositeArguments(argumentsList) {
  const values = argumentsList.filter((value) => value !== "--")
  if (values.length === 0) return []
  if (
    values.length === 2 &&
    values[0] === "--verify-receipt" &&
    values[1] &&
    !values[1].startsWith("--")
  )
    return values
  if (
    values.length !== 2 ||
    values[0] !== "--output-dir" ||
    !values[1] ||
    values[1].startsWith("--")
  ) {
    throw new Error(
      "Task20A accepts only --output-dir <repository-relative-dir>"
    )
  }
  return values
}

async function run(argumentsList) {
  if (argumentsList[0] === "--verify-receipt") {
    await verifyReceipt(argumentsList[1])
    return
  }
  const devtools = await runChild("DevTools LCP median", process.execPath, [
    DEVTOOLS_RUNNER,
    ...argumentsList,
  ])
  const outputDirectory = await outputDirectoryFrom(argumentsList)
  const configPath = await writeLegacyConfig(outputDirectory)
  const legacy = await runChild(
    "legacy non-LCP Lighthouse assertions",
    "pnpm",
    ["exec", "lhci", "autorun", "--config", configPath]
  )
  const receiptPath = resolve(outputDirectory, "receipt.json")
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"))
  receipt.legacy = await collectLegacyEvidence(outputDirectory)
  receipt.composite = { phases: [devtools, legacy], retries: 0 }
  receipt.outcome = await verifyTask20ALighthouseReceipt(
    receipt,
    outputDirectory
  )
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)
  console.log(JSON.stringify(receipt.outcome, null, 2))
}

async function runChild(phase, command, argumentsList) {
  console.log(
    `[Task20A] phase=${phase} command=${command} ${argumentsList.join(" ")}`
  )
  if (process.env.TASK20A_AUDIT_SENTINEL) {
    await writeFile(process.env.TASK20A_AUDIT_SENTINEL, phase)
  }
  const child = spawn(command, argumentsList, { stdio: "inherit" })
  const result = await new Promise((resolvePromise, reject) => {
    child.once("error", reject)
    child.once("exit", (code, signal) => resolvePromise({ code, signal }))
  })
  console.log(
    `[Task20A] phase=${phase} exit=${result.code ?? "null"} signal=${result.signal ?? "none"}`
  )
  if (result.code !== 0 || result.signal) {
    throw new Error(`${phase} failed without retry`)
  }
  return {
    argv: argumentsList,
    command,
    exitCode: result.code,
    phase,
    signal: result.signal,
  }
}

async function verifyReceipt(receiptPath) {
  const source = JSON.parse(await readFile(receiptPath, "utf8"))
  const outcome = await verifyTask20ALighthouseReceipt(
    source,
    resolve(receiptPath, "..")
  )
  console.log(JSON.stringify(outcome, null, 2))
  if (outcome.verdict !== "PASS") process.exitCode = 1
}

async function outputDirectoryFrom(argumentsList) {
  const configured = argumentsList[1]
  if (configured) return resolve(configured)
  const receiptPaths = await readdir("reports/task20a-lighthouse")
  if (receiptPaths.length !== 1)
    throw new Error("Task20A default output is ambiguous")
  return resolve("reports/task20a-lighthouse", receiptPaths[0])
}

async function writeLegacyConfig(outputDirectory) {
  const source = JSON.parse(await readFile(".lighthouserc.json", "utf8"))
  source.ci.upload.outputDir = resolve(outputDirectory, "legacy")
  source.ci.assert.assertMatrix = source.ci.assert.assertMatrix.map(
    (matrix) => {
      const assertions = { ...matrix.assertions }
      delete assertions["largest-contentful-paint"]
      return { ...matrix, assertions }
    }
  )
  const configPath = resolve(outputDirectory, "lhci.config.json")
  await writeFile(configPath, `${JSON.stringify(source, null, 2)}\n`)
  return configPath
}

async function collectLegacyEvidence(outputDirectory) {
  const legacyDirectory = resolve(outputDirectory, "legacy")
  const entries = (await readdir(legacyDirectory)).filter((entry) =>
    entry.endsWith(".report.json")
  )
  if (entries.length !== 12)
    throw new Error(
      "legacy Lighthouse proof requires exactly twelve JSON reports"
    )
  const rawReports = entries
    .sort()
    .map((entry) => relative(outputDirectory, resolve(legacyDirectory, entry)))
  const hashes = {}
  const config = JSON.parse(
    await readFile(resolve(outputDirectory, "lhci.config.json"), "utf8")
  )
  const results = []
  const serverOrigins = new Set()
  for (const reportPath of rawReports) {
    const source = await readFile(resolve(outputDirectory, reportPath), "utf8")
    hashes[reportPath] = sha256(source)
    const report = JSON.parse(source)
    serverOrigins.add(new URL(report.finalUrl).origin)
    results.push(
      assertionResults(report, config.ci.assert.assertMatrix, reportPath)
    )
  }
  if (serverOrigins.size !== 1)
    throw new Error("legacy reports must share one loopback server")
  const assertionSummary = "legacy/assertion-summary.json"
  const summary = { reportCount: rawReports.length, rawReports, results }
  const summaryText = `${JSON.stringify(summary, null, 2)}\n`
  await writeFile(resolve(outputDirectory, assertionSummary), summaryText)
  hashes[assertionSummary] = sha256(summaryText)
  return {
    assertionSummary,
    hashes,
    rawReports,
    serverOrigin: [...serverOrigins][0],
  }
}

function assertionResults(report, matrix, reportPath) {
  const selected = matrix.find((entry) =>
    new RegExp(entry.matchingUrlPattern).test(report.finalUrl)
  )
  if (!selected)
    throw new Error(`legacy report has no assertion matrix: ${reportPath}`)
  const results = Object.entries(selected.assertions).map(([name, rule]) => {
    const value = name.startsWith("categories:")
      ? report.categories[name.slice("categories:".length)].score
      : report.audits[name].numericValue
    const expected = rule[1]
    const passed =
      "minScore" in expected
        ? value >= expected.minScore
        : value <= expected.maxNumericValue
    return { name, passed, value }
  })
  if (!results.every((result) => result.passed))
    throw new Error(
      `legacy assertion summary found a failed result: ${reportPath}`
    )
  return { reportPath, results }
}

function sha256(source) {
  return createHash("sha256").update(source).digest("hex")
}
