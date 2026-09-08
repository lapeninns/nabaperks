#!/usr/bin/env node
/** Credential-free qualification; never publishes a check or changes routing. */
import { spawn } from "node:child_process"
import { randomBytes, randomUUID } from "node:crypto"
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
import { createRunner, createRuntimeEnvResolver } from "./agent/runner.mjs"
import {
  assertVmIsolation,
  parseLimaInstances,
  parseVmProbe,
  VM_PROBE_SCRIPT,
  buildWorkspacePreparationScript,
  buildLaneWorkspaceScript,
} from "./agent/main.mjs"
import { inventoryFromPlaywright } from "../../scripts/ci/browser-parity.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const quote = (value) => `'${String(value).replaceAll("'", "'\\''")}'`
const controller = new AbortController()
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => controller.abort())

function command(
  argv,
  { input, signal = controller.signal, timeoutMs = 600_000 } = {}
) {
  return new Promise((accept, reject) => {
    const child = spawn(argv[0], argv.slice(1), {
      cwd: root,
      signal,
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

async function main() {
  const [sha, count, output, mode = "pilot", ...extra] = process.argv.slice(2)
  if (
    !/^[a-f0-9]{40}$/.test(sha ?? "") ||
    !/^[1-6]$/.test(count ?? "") ||
    !output ||
    !["pilot", "full"].includes(mode) ||
    extra.length
  )
    throw new Error(
      "Usage: node ops/local-ci/benchmark.mjs <sha> <1-6> <new-output-directory> [pilot|full]"
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
  const contract = structuredClone(
    loadContract((path) => readFileSync(join(root, path), "utf8"))
  )
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
  const vm = contract.vm.name
  const shell = (script, options) =>
    command(["limactl", "shell", vm, "--", "/bin/sh", "-c", script], options)
  const lease = acquireControllerLease({
    path: join(homedir(), ".nabaperks-local-ci/controller.lock"),
  })
  const scratch = `/var/lib/nabaperks-ci/qualification/bench-${randomUUID()}`
  const workspace = `${scratch}/runs/${sha}`
  let sampling = true
  let sampler
  const startedAt = Date.now()
  try {
    const instances = parseLimaInstances(
      await command(["limactl", "list", "--json", vm])
    )
    const probe = parseVmProbe(await shell(VM_PROBE_SCRIPT))
    assertVmIsolation({ vm, instances, probe, contract })
    const names = await shell("docker ps --all --format '{{.Names}}'")
    if (names.split(/\r?\n/).some((name) => name.startsWith("nabaperks-ci-")))
      throw new Error(
        "Existing local CI containers must finish or be reconciled first"
      )
    const image = readFileSync(
      "/opt/nabaperks-local-ci/job-image",
      "utf8"
    ).trim()
    const imageId = (
      await shell(`docker image inspect --format '{{.Id}}' ${quote(image)}`)
    ).trim()
    const imageCachePin = process.env.LOCAL_CI_IMAGE_CACHE_PIN_FILE
      ? parseImageCachePin(
          readFileSync(process.env.LOCAL_CI_IMAGE_CACHE_PIN_FILE, "utf8")
        )
      : null
    await shell(
      buildWorkspacePreparationScript({
        root: scratch,
        remoteUrl: contract.remoteUrl,
        headSha: sha,
      })
    )
    const runtime = createContainerRuntime({ contract, vm, imageCachePin })
    const resolver = createRuntimeEnvResolver({
      contract,
      randomBytes,
      exec: (script) => command(["/bin/sh", "-c", script]),
    })
    sampler = (async () => {
      while (sampling) {
        try {
          const data = await shell(
            "docker stats --no-stream --format '{{json .}}'",
            { signal: null, timeoutMs: 15_000 }
          )
          appendFileSync(
            join(directory, "resources.jsonl"),
            JSON.stringify({
              at: Date.now(),
              containers: data.trim()
                ? data.trim().split(/\r?\n/).map(JSON.parse)
                : [],
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
      containerRuntime: runtime,
      resolveRuntimeEnv: resolver,
      arch: "arm64",
      image,
      daemonImage: "docker:27.5.1-dind",
      workspaceHostPath: workspace,
      prepareLaneWorkspace: async (lane) => {
        const prepared = buildLaneWorkspaceScript({
          workspace,
          laneId: lane.id,
          headSha: sha,
          remoteUrl: contract.remoteUrl,
        })
        await shell(prepared.script)
        return prepared.destination
      },
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
      writeEnvFile: async (lane, env) => {
        const path = `${workspace}/.env.${lane.id}`
        await shell(`umask 077; cat > ${quote(path)}`, {
          input:
            Object.entries(env)
              .map(([key, value]) => `${key}=${value}`)
              .join("\n") + "\n",
        })
        return path
      },
    })
    const tests = readdirSync(directory)
      .filter((name) => name.includes(".local-ci-") && name.endsWith(".json"))
      .flatMap((name) =>
        inventoryFromPlaywright(
          JSON.parse(readFileSync(join(directory, name), "utf8"))
        )
      )
    const result = {
      sha,
      mode,
      maxConcurrentLanes: Number(count),
      image,
      imageId,
      durationMs: Date.now() - startedAt,
      ...outcome,
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
      const leftovers = await shell(
        `docker ps --all --filter ${quote(`label=com.nabaperks.local-ci.head-sha=${sha}`)} --format '{{.Names}}'`,
        { signal: null }
      )
      if (leftovers.trim())
        throw new Error("Resources remain; benchmark workspace is quarantined")
      await shell(`rm -rf ${quote(scratch)}`, { signal: null })
    } finally {
      lease.release()
    }
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
