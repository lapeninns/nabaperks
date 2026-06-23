#!/usr/bin/env node
import { spawn } from "node:child_process"
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import {
  DEFAULT_SHARED_SCENARIO_ENV,
  MAJOR_CAPABILITY_SCENARIOS,
  SCENARIO_SUCCESS_CRITERIA,
} from "./major-capability-scenario-manifest.mjs"

export {
  DEFAULT_SHARED_SCENARIO_ENV,
  MAJOR_CAPABILITY_SCENARIOS,
  SCENARIO_SUCCESS_CRITERIA,
}

const DEFAULT_EVIDENCE_ROOT = ".omo/evidence/major-capability-scenarios"

export function assertLocalDisposableTarget(env) {
  if (!isLocalUrl(env.SUPABASE_DB_URL) || !isLocalUrl(env.NEXT_PUBLIC_SUPABASE_URL)) {
    throw new Error(
      "Scenario suite requires local disposable Supabase targets for DB/browser scenarios."
    )
  }
}

export async function runScenarioSuite({
  scenarioId,
  evidenceRoot = DEFAULT_EVIDENCE_ROOT,
  rootDir = process.cwd(),
} = {}) {
  const scenarios = scenarioId
    ? MAJOR_CAPABILITY_SCENARIOS.filter((scenario) => scenario.id === scenarioId)
    : MAJOR_CAPABILITY_SCENARIOS

  if (scenarioId && scenarios.length === 0) {
    throw new Error(`Unknown scenario id: ${scenarioId}`)
  }

  const env = scenarioEnvironment(rootDir)
  const runDir = join(evidenceRoot, runId())
  mkdirSync(runDir, { recursive: true })

  const results = []
  for (const scenario of scenarios) {
    if (scenario.requiresLocalDisposableTarget) assertLocalDisposableTarget(env)
    results.push(await runScenario(scenario, env, runDir, rootDir))
  }

  const summary = {
    runDir,
    successCriteria: SCENARIO_SUCCESS_CRITERIA,
    total: results.length,
    passed: results.filter((result) => result.status === "pass").length,
    failed: results.filter((result) => result.status === "fail").length,
    results,
  }
  writeFileSync(join(runDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`)
  writeFileSync(join(evidenceRoot, "latest-run.txt"), `${runDir}\n`)
  return summary
}

export function scenarioEnvironment(rootDir = process.cwd()) {
  const env = {
    ...readEnvFile(join(rootDir, ".env")),
    ...readEnvFile(join(rootDir, ".env.local")),
    ...process.env,
    ...DEFAULT_SHARED_SCENARIO_ENV,
  }
  delete env.CUSTOMER_OTP_BYPASS_MODE
  delete env.CUSTOMER_DEV_OTP_CODE
  return env
}

function runScenario(scenario, env, runDir, rootDir) {
  return new Promise((resolveScenario) => {
    const evidencePath = join(runDir, `${scenario.id}.log`)
    const startedAt = new Date().toISOString()
    writeFileSync(
      evidencePath,
      [
        `scenario: ${scenario.id}`,
        `title: ${scenario.title}`,
        `capability: ${scenario.capability}`,
        `evidenceKind: ${scenario.evidenceKind}`,
        `startedAt: ${startedAt}`,
        `successCriteria:`,
        ...scenario.successCriteria.map((criterion) => `- ${criterion}`),
        "",
      ].join("\n")
    )

    runCommandsSequentially({
      commands: scenario.commands,
      env,
      evidencePath,
      rootDir,
    }).then((commandResults) => {
      const endedAt = new Date().toISOString()
      const status = commandResults.every((result) => result.exitCode === 0)
        ? "pass"
        : "fail"
      appendFileSync(
        evidencePath,
        [
          "",
          `endedAt: ${endedAt}`,
          `outcome: ${status}`,
          `exitCodes: ${commandResults.map((result) => result.exitCode).join(", ")}`,
          "",
        ].join("\n")
      )
      resolveScenario({
        id: scenario.id,
        title: scenario.title,
        capability: scenario.capability,
        status,
        evidencePath,
        commandResults,
        startedAt,
        endedAt,
      })
    })
  })
}

async function runCommandsSequentially({ commands, env, evidencePath, rootDir }) {
  const results = []
  for (const command of commands) {
    results.push(await runCommand({ command, env, evidencePath, rootDir }))
  }
  return results
}

function runCommand({ command, env, evidencePath, rootDir }) {
  return new Promise((resolveCommand) => {
    const startedAt = new Date().toISOString()
    appendFileSync(
      evidencePath,
      [
        "",
        `--- command start ${startedAt}`,
        `$ ${command}`,
        "",
      ].join("\n")
    )

    const child = spawn(command, {
      cwd: rootDir,
      env,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    })
    child.stdout.on("data", (chunk) => appendFileSync(evidencePath, chunk))
    child.stderr.on("data", (chunk) => appendFileSync(evidencePath, chunk))
    child.on("close", (code) => {
      const exitCode = code ?? 1
      appendFileSync(
        evidencePath,
        [
          "",
          `--- command end ${new Date().toISOString()}`,
          `exitCode: ${exitCode}`,
          "",
        ].join("\n")
      )
      resolveCommand({ command, exitCode, startedAt })
    })
  })
}

function readEnvFile(path) {
  if (!existsSync(path)) return {}

  const parsed = {}
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const equalsIndex = trimmed.indexOf("=")
    if (equalsIndex === -1) continue

    const key = trimmed.slice(0, equalsIndex).trim()
    let value = trimmed.slice(equalsIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    parsed[key] = value
  }
  return parsed
}

function isLocalUrl(value) {
  if (!value) return false
  try {
    const host = new URL(value).hostname.toLowerCase()
    return ["localhost", "127.0.0.1", "::1"].includes(host)
  } catch {
    return false
  }
}

function runId() {
  return new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z")
}

function parseArgs(args) {
  const parsed = { list: false }
  for (const arg of args) {
    if (arg === "--list") parsed.list = true
    else if (arg.startsWith("--scenario=")) parsed.scenarioId = arg.slice(11)
    else if (arg.startsWith("--evidence-root=")) parsed.evidenceRoot = arg.slice(16)
  }
  return parsed
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.list) {
    for (const scenario of MAJOR_CAPABILITY_SCENARIOS) {
      console.log(`${scenario.id}\t${scenario.title}`)
    }
    return
  }

  const summary = await runScenarioSuite(args)
  console.log(JSON.stringify(summary, null, 2))
  if (summary.failed > 0) process.exitCode = 1
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
