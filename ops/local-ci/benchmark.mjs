#!/usr/bin/env node
/**
 * Credential-free qualification; never publishes a check or changes routing.
 *
 * It runs the same runtime a dispatch runs - the one config/local-ci-contract.json
 * selects - through the same isolation verdict, workspace preparation, env
 * files and release, so a benchmark measures what the agent would do rather
 * than a Lima-only copy of it.
 */
import { spawn } from "node:child_process"
import { randomBytes } from "node:crypto"
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { loadContract } from "./core/contract.mjs"
import { loadProfile } from "./core/profiles.mjs"
import { parseImageCachePin } from "./core/image-cache.mjs"
import { createContainerRuntime } from "./agent/container.mjs"
import { acquireControllerLease } from "./agent/lease.mjs"
import {
  createRunner,
  createRuntimeEnvResolver,
  laneBrowserReports,
} from "./agent/runner.mjs"
import { createHostRuntime } from "./agent/main.mjs"
import { inventoryFromPlaywright } from "../../scripts/ci/browser-parity.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const controller = new AbortController()
export function command(
  argv,
  { input, signal = controller.signal, timeoutMs = 600_000 } = {}
) {
  return new Promise((accept, reject) => {
    const child = spawn(argv[0], argv.slice(1), {
      cwd: root,
      signal: signal ?? undefined,
      timeout: timeoutMs,
    })
    let stdout = "",
      stderr = ""
    child.stdout.on("data", (chunk) => {
      stdout += chunk
    })
    child.stderr.on("data", (chunk) => {
      stderr += chunk
    })
    child.on("error", reject)
    child.on("close", (code) =>
      code === 0
        ? accept(stdout)
        : reject(new Error(`${argv[0]} exited ${code}: ${stderr.slice(-3000)}`))
    )
    child.stdin.end(input)
  })
}

export function resourceSamplingSummary(samples, laneIds) {
  const names = new Set(
    samples.flatMap((sample) =>
      (sample.containers ?? []).map((container) => container.Name)
    )
  )
  const errors = samples.filter((sample) => sample.error).length
  const missingLanes = laneIds.filter(
    (id) => ![...names].some((name) => name?.includes(`-${id}-`))
  )
  return {
    samples: samples.length,
    errors,
    missingLanes,
    valid: samples.length > 0 && errors === 0 && missingLanes.length === 0,
  }
}

export function collectBrowserEvidence({ lanes, names, read }) {
  const expected = lanes.flatMap(laneBrowserReports).map((part) => part.stored)
  const received = names.filter(
    (name) => name.includes(".local-ci-") && name.endsWith(".json")
  )
  const missing = expected.filter((name) => !received.includes(name))
  const unexpected = received.filter((name) => !expected.includes(name))
  const errors = []
  const tests = expected
    .filter((name) => received.includes(name))
    .flatMap((name) => {
      try {
        return inventoryFromPlaywright(JSON.parse(read(name)))
      } catch (error) {
        errors.push({ name, message: error.message })
        return []
      }
    })
  return {
    tests,
    reportEvidence: {
      expected: expected.length,
      received: received.length,
      missing,
      unexpected,
      errors,
      valid:
        expected.length > 0 &&
        new Set(expected).size === expected.length &&
        missing.length === 0 &&
        unexpected.length === 0 &&
        errors.length === 0 &&
        tests.length > 0,
    },
  }
}

async function main() {
  const [sha, count, output, mode = "pilot", ...extra] = process.argv.slice(2)
  const contract = structuredClone(
    loadContract((path) => readFileSync(join(root, path), "utf8"))
  )
  const maximum = contract.agent.maxConcurrentLanes
  if (
    !/^[a-f0-9]{40}$/.test(sha ?? "") ||
    !/^[1-9][0-9]*$/.test(count ?? "") ||
    Number(count) > maximum ||
    !output ||
    !["pilot", "full"].includes(mode) ||
    extra.length
  )
    throw new Error(
      `Usage: node ops/local-ci/benchmark.mjs <sha> <1-${maximum}> <new-output-directory> [pilot|full]`
    )
  if ((await command(["git", "rev-parse", "HEAD"])).trim() !== sha)
    throw new Error("Benchmark runtime must match the requested commit")
  await command([
    "git",
    "diff",
    "--exit-code",
    "HEAD",
    "--",
    "ops/local-ci",
    "scripts/ci",
    "config/local-ci-contract.json",
    "package.json",
  ])
  const directory = resolve(output)
  if (existsSync(directory))
    throw new Error("Benchmark evidence directory must be new")
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  contract.agent.maxConcurrentLanes = Number(count)
  const profile = structuredClone(
    loadProfile("pr", contract, (path) =>
      readFileSync(join(root, path), "utf8")
    )
  )
  if (mode === "pilot") {
    profile.lanes = profile.lanes.filter((lane) => lane.id.startsWith("e2e-"))
    for (const lane of profile.lanes) lane.commands = lane.commands.slice(0, 3)
  }
  const stateRoot = join(homedir(), ".nabaperks-local-ci")
  const image = readFileSync("/opt/nabaperks-local-ci/job-image", "utf8").trim()
  const config = {
    stateRoot,
    jobImage: image,
    vm: contract.vm.name,
    vmWorkspaceRoot: "/var/lib/nabaperks-ci",
  }
  const logger = {
    info: (message) => console.error(message),
    warn: (message) => console.error(message),
    error: (message) => console.error(message),
  }
  const runtime = createHostRuntime({ contract, config, logger })
  const lease = acquireControllerLease({
    path: join(stateRoot, "controller.lock"),
  })
  let sampling = true
  let sampler
  let workspace = null
  const startedAt = Date.now()
  try {
    // The runtime probe: the same verdict a dispatch must pass.
    const isolation = await runtime.assertIsolationLive()
    if ((await runtime.ownedContainerNames()).length > 0)
      throw new Error(
        "Existing local CI containers must finish or be reconciled first"
      )
    const imageId = await runtime.imageId(image)
    const imageCachePin = process.env.LOCAL_CI_IMAGE_CACHE_PIN_FILE
      ? parseImageCachePin(
          readFileSync(process.env.LOCAL_CI_IMAGE_CACHE_PIN_FILE, "utf8")
        )
      : null
    workspace = await runtime.prepareWorkspace({
      headSha: sha,
      signal: controller.signal,
    })
    const containerRuntime = createContainerRuntime({
      contract,
      imageCachePin,
      ...runtime.containerRuntimeOptions(),
    })
    const resolver = createRuntimeEnvResolver({
      contract,
      randomBytes,
      exec: (script) => command(["/bin/sh", "-c", script]),
    })
    sampler = (async () => {
      while (sampling) {
        try {
          appendFileSync(
            join(directory, "resources.jsonl"),
            JSON.stringify({
              at: Date.now(),
              containers: await runtime.containerStats(),
            }) + "\n"
          )
        } catch (error) {
          appendFileSync(
            join(directory, "resources.jsonl"),
            JSON.stringify({ at: Date.now(), error: error.message }) + "\n"
          )
        }
        if (sampling) await new Promise((done) => setTimeout(done, 2000))
      }
    })()
    const runner = createRunner({
      contract,
      containerRuntime,
      resolveRuntimeEnv: resolver,
      arch: "arm64",
      image,
      daemonImage: "docker:27.5.1-dind",
      workspaceHostPath: workspace,
      prepareLaneWorkspace: (lane, options) =>
        runtime.prepareLaneWorkspace(lane, {
          ...options,
          workspace,
          headSha: sha,
        }),
      hostedOnlyRequirements: runtime.hostedOnlyRequirements,
      laneScriptPrelude: runtime.laneScriptPrelude,
      externalMemoryGb: () => runtime.externalMemoryGb(),
      openLaneLog: (name) => {
        const path = join(directory, name)
        writeFileSync(path, "", { flag: "wx", mode: 0o600 })
        return { write: (text) => appendFileSync(path, text), close() {} }
      },
    })
    const outcome = await runner.runProfile({
      profile,
      headSha: sha,
      signal: controller.signal,
      writeEnvFile: runtime.envFileWriter({
        headSha: sha,
        signal: controller.signal,
      }),
    })
    sampling = false
    await sampler
    const resourceEvidence = resourceSamplingSummary(
      readFileSync(join(directory, "resources.jsonl"), "utf8")
        .trim()
        .split(/\r?\n/)
        .filter(Boolean)
        .map(JSON.parse),
      outcome.laneResults
        .filter((lane) => lane.status !== "skipped")
        .map((lane) => lane.laneId)
    )
    const { tests, reportEvidence } = collectBrowserEvidence({
      lanes: profile.lanes,
      names: readdirSync(directory),
      read: (name) => readFileSync(join(directory, name), "utf8"),
    })
    const result = {
      sha,
      mode,
      runtime: runtime.kind,
      isolation,
      maxConcurrentLanes: Number(count),
      image,
      imageId,
      durationMs: Date.now() - startedAt,
      ...outcome,
      resourceEvidence,
      reportEvidence,
      tests,
    }
    writeFileSync(
      join(directory, "result.json"),
      JSON.stringify(result, null, 2) + "\n"
    )
    console.log(
      JSON.stringify({
        sha,
        mode,
        runtime: runtime.kind,
        concurrency: Number(count),
        peak: outcome.peakConcurrentLanes,
        durationSeconds: outcome.record.durationSeconds,
        conclusion: outcome.record.conclusion,
        tests: tests.length,
        directory,
      })
    )
    if (
      outcome.record.conclusion !== "success" ||
      !resourceEvidence.valid ||
      !reportEvidence.valid ||
      tests.some(
        (test) =>
          test.flaky ||
          test.retries ||
          !["passed", "skipped"].includes(test.status)
      )
    )
      process.exitCode = 1
  } finally {
    sampling = false
    await sampler
    try {
      if (workspace !== null) await runtime.releaseWorkspace({ headSha: sha })
    } finally {
      lease.release()
    }
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () => controller.abort())
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
