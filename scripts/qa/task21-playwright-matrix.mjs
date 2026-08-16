#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const PROJECT_ROOT = fileURLToPath(new URL("../../", import.meta.url))
const DEFAULT_RULES_PATH = fileURLToPath(
  new URL("./task21-playwright-matrix.json", import.meta.url)
)
const LIST_ROW = /^\s*(\[[^\]]+\])\s+›\s+([^›]+?):\d+:\d+\s+›\s+(.+)$/

export function parseListReporter(output) {
  const rows = []
  let listing = false
  for (const line of output.split(/\r?\n/)) {
    if (line.trim() === "Listing tests:") {
      listing = true
      continue
    }
    if (!listing || !line.trim()) continue
    if (line.trimStart().startsWith("Total:")) break
    if (!line.trimStart().startsWith("["))
      throw new Error(`TASK21_MALFORMED_DISCOVERY: ${line.trim()}`)
    const match = line.match(LIST_ROW)
    if (!match) throw new Error(`TASK21_MALFORMED_DISCOVERY: ${line.trim()}`)
    rows.push(`${match[1]} › ${match[2].trim()} › ${match[3].trim()}`)
  }
  if (rows.length === 0) throw new Error("TASK21_ZERO_DISCOVERY")
  if (new Set(rows).size !== rows.length)
    throw new Error("TASK21_DUPLICATE_DISCOVERY")
  return rows
}

export function renderTestList(rows) {
  return `${rows.join("\n")}\n`
}

export function classifyDiscoveredTests(discovered, rules) {
  const dbFree = []
  const live = []
  const unsupported = []
  const overlap = []
  for (const row of discovered) {
    const owners = []
    if (rules.live.some((prefix) => matchesPrefix(row, prefix)))
      owners.push("live")
    if (rules.unsupported.some((prefix) => matchesPrefix(row, prefix)))
      owners.push("unsupported")
    if (owners.length > 1) overlap.push(row)
    else if (owners[0] === "live") live.push(row)
    else if (owners[0] === "unsupported") unsupported.push(row)
    else dbFree.push(row)
  }
  return {
    dbFree,
    live,
    unsupported,
    overlap,
    unknown: [],
    total: discovered.length,
  }
}

export function reconcileProjectDiscoveries(projectRows, rules) {
  const ownersByTest = new Map()
  const rowOverlaps = []
  for (const rows of Object.values(projectRows)) {
    const classified = classifyDiscoveredTests(rows, rules)
    rowOverlaps.push(...classified.overlap)
    for (const [owner, ownedRows] of [
      ["db-free", classified.dbFree],
      ["live", classified.live],
      ["unsupported", classified.unsupported],
    ]) {
      for (const row of ownedRows) {
        const key = row.split("›").slice(1).join("›").trim()
        const owners = ownersByTest.get(key) ?? new Set()
        owners.add(owner)
        ownersByTest.set(key, owners)
      }
    }
  }
  const uncovered = []
  const overlap = [...rowOverlaps]
  for (const [testId, owners] of ownersByTest) {
    const executable = [...owners].filter((owner) => owner !== "unsupported")
    if (executable.length === 0) uncovered.push(testId)
    if (executable.length > 1) overlap.push(testId)
  }
  return { overlap, semanticTests: ownersByTest.size, uncovered }
}

function matchesPrefix(row, prefix) {
  const rowTokens = row.split("›").map((token) => token.trim())
  const prefixTokens = prefix.split("›").map((token) => token.trim())
  const offset = prefixTokens[0]?.startsWith("[") ? 0 : 1
  return prefixTokens.every(
    (token, index) => rowTokens[index + offset] === token
  )
}

function discover(project, visualMode) {
  const grepArgs =
    visualMode === "task22"
      ? ["--grep", "@visual"]
      : ["--grep-invert", "@visual"]
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "playwright",
      "test",
      "--list",
      "--reporter=list",
      `--project=${project}`,
      ...grepArgs,
    ],
    {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        PLAYWRIGHT_BASE_URL:
          process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3146",
      },
    }
  )
  if (result.error) throw result.error
  if (result.status !== 0)
    throw new Error(
      `TASK21_DISCOVERY_FAILED: ${result.stderr || result.stdout}`
    )
  return parseListReporter(result.stdout)
}

function parseArguments(argv) {
  const values = new Map()
  for (const argument of argv) {
    const match = argument.match(/^--([a-z0-9-]+)=(.+)$/)
    if (!match) throw new Error(`TASK21_INVALID_ARGUMENT: ${argument}`)
    if (values.has(match[1]))
      throw new Error(`TASK21_DUPLICATE_ARGUMENT: ${match[1]}`)
    values.set(match[1], match[2])
  }
  const partition = values.get("partition")
  const project = values.get("project")
  const output = values.get("output")
  const receipt = values.get("receipt")
  if (
    !partition ||
    !["db-free", "live", "task22", "verify"].includes(partition)
  )
    throw new Error("TASK21_INVALID_PARTITION")
  const projects = [
    "chromium",
    "desktop-firefox",
    "desktop-safari",
    "mobile-safari",
  ]
  if (
    !project ||
    !(
      projects.includes(project) ||
      (partition === "verify" && project === "all")
    )
  )
    throw new Error("TASK21_INVALID_PROJECT")
  if (partition !== "verify" && !output)
    throw new Error("TASK21_OUTPUT_REQUIRED")
  if (partition === "verify" && !receipt)
    throw new Error("TASK21_RECEIPT_REQUIRED")
  return {
    output: output ? resolve(output) : undefined,
    partition,
    project,
    receipt,
  }
}

function loadRules(path = DEFAULT_RULES_PATH) {
  const parsed = JSON.parse(readFileSync(path, "utf8"))
  if (!Array.isArray(parsed.live) || !Array.isArray(parsed.unsupported))
    throw new Error("TASK21_INVALID_RULES")
  return parsed
}

function assertRulesMatched(rows, rules) {
  const stale = [...rules.live, ...rules.unsupported].filter(
    (prefix) =>
      rows.some((row) => sameProjectFile(row, prefix)) &&
      !rows.some((row) => matchesPrefix(row, prefix))
  )
  if (stale.length > 0)
    throw new Error(`TASK21_STALE_RULES: ${stale.join(" | ")}`)
}

function sameProjectFile(row, prefix) {
  const rowTokens = row.split("›").map((token) => token.trim())
  const prefixTokens = prefix.split("›").map((token) => token.trim())
  if (prefixTokens[0]?.startsWith("["))
    return rowTokens[0] === prefixTokens[0] && rowTokens[1] === prefixTokens[1]
  return rowTokens[1] === prefixTokens[0]
}

function main() {
  const options = parseArguments(process.argv.slice(2))
  const rules = loadRules()
  if (options.partition === "verify") {
    verifyMatrix(rules, options.receipt)
    return
  }
  const nonVisual = discover(options.project, "task21")
  const task22 = discover(options.project, "task22")
  const classified = classifyDiscoveredTests(nonVisual, rules)
  assertRulesMatched([...nonVisual, ...task22], {
    live: rules.live.filter((rule) => !rule.startsWith("[")),
    unsupported: rules.unsupported.filter(
      (rule) => !rule.startsWith("[") || rule.startsWith(`[${options.project}]`)
    ),
  })
  if (classified.overlap.length > 0)
    throw new Error(`TASK21_MATRIX_OVERLAP: ${classified.overlap.join(" | ")}`)
  const selected =
    options.partition === "db-free"
      ? classified.dbFree
      : options.partition === "live"
        ? classified.live
        : task22
  if (selected.length === 0) throw new Error("TASK21_ZERO_PARTITION")
  if (!options.output) throw new Error("TASK21_OUTPUT_REQUIRED")
  writeFileSync(options.output, renderTestList(selected), { mode: 0o600 })
  const receipt = {
    project: options.project,
    partition: options.partition,
    totals: {
      discovered: nonVisual.length + task22.length,
      dbFree: classified.dbFree.length,
      live: classified.live.length,
      task22: task22.length,
      unsupported: classified.unsupported.length,
      selected: selected.length,
    },
    output: options.output,
  }
  if (options.receipt)
    writeFileSync(
      resolve(options.receipt),
      `${JSON.stringify(receipt, null, 2)}\n`
    )
  process.stdout.write(`${JSON.stringify(receipt)}\n`)
}

function verifyMatrix(rules, receiptPath) {
  const projects = [
    "chromium",
    "mobile-safari",
    "desktop-firefox",
    "desktop-safari",
  ]
  const nonVisualByProject = {}
  const task22ByProject = {}
  for (const project of projects) {
    nonVisualByProject[project] = discover(project, "task21")
    task22ByProject[project] = discover(project, "task22")
  }
  const allRows = [
    ...Object.values(nonVisualByProject).flat(),
    ...Object.values(task22ByProject).flat(),
  ]
  assertRulesMatched(allRows, rules)
  const reconciliation = reconcileProjectDiscoveries(nonVisualByProject, rules)
  if (reconciliation.overlap.length > 0)
    throw new Error(
      `TASK21_MATRIX_OVERLAP: ${reconciliation.overlap.join(" | ")}`
    )
  if (reconciliation.uncovered.length > 0)
    throw new Error(
      `TASK21_MATRIX_UNCOVERED: ${reconciliation.uncovered.join(" | ")}`
    )
  const nonVisualKeys = new Set(
    Object.values(nonVisualByProject)
      .flat()
      .map((row) => row.split("›").slice(1).join("›").trim())
  )
  const task22Keys = new Set(
    Object.values(task22ByProject)
      .flat()
      .map((row) => row.split("›").slice(1).join("›").trim())
  )
  const crossPartitionOverlap = [...task22Keys].filter((key) =>
    nonVisualKeys.has(key)
  )
  if (crossPartitionOverlap.length > 0)
    throw new Error(
      `TASK21_TASK22_OVERLAP: ${crossPartitionOverlap.join(" | ")}`
    )
  const receipt = {
    projects,
    semanticNonVisualTests: reconciliation.semanticTests,
    semanticTask22Tests: task22Keys.size,
    rowTotals: Object.fromEntries(
      projects.map((project) => {
        const classified = classifyDiscoveredTests(
          nonVisualByProject[project],
          rules
        )
        return [
          project,
          {
            dbFree: classified.dbFree.length,
            live: classified.live.length,
            task22: task22ByProject[project].length,
            unsupported: classified.unsupported.length,
          },
        ]
      })
    ),
    overlap: 0,
    uncovered: 0,
  }
  writeFileSync(resolve(receiptPath), `${JSON.stringify(receipt, null, 2)}\n`)
  process.stdout.write(`${JSON.stringify(receipt)}\n`)
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 64
  }
}
