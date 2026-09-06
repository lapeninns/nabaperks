#!/usr/bin/env node
/** Protected host entrypoint. Install independently; never run from candidate code. */
import { createHash, createPrivateKey, createPublicKey } from "node:crypto"
import { readFile, lstat, realpath } from "node:fs/promises"
import { readFileSync, fstatSync } from "node:fs"
import { dirname, resolve, isAbsolute } from "node:path"
import { pathToFileURL } from "node:url"
const FULL_HOSTED_ROOTS = Object.freeze([
  "fast",
  "quality",
  "build",
  "e2e",
  "a11y",
  "visual",
  "lighthouse",
  "zap-baseline",
  "db",
])

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex")
const jsonHash = (value) => hash(JSON.stringify(value))
const requireTrue = (condition, message) => {
  if (!condition) throw new Error(message)
}
const exactKeys = (value, keys) =>
  value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key))
const nonempty = (value) => typeof value === "string" && value.length > 0
const isSha = (value) => /^[a-f0-9]{40}$/.test(value)
const isDigest = (value) => /^[a-f0-9]{64}$/.test(value)

/** The command digest includes reviewed resources and exact argv, in lane order. */
export function supervisorCommandDigest(commands, resources) {
  return jsonHash({ commands, resources })
}

function validateConfig(config) {
  requireTrue(
    exactKeys(config, [
      "version",
      "repository",
      "appId",
      "sha",
      "profile",
      "runtimeSha",
      "imageDigest",
      "attemptId",
      "challenge",
      "requestedAt",
      "maxAgeMs",
      "maxDurationMs",
      "commands",
      "resources",
      "adapterPath",
      "adapterDigest",
      "publicKey",
    ]),
    "Invalid protected supervisor config"
  )
  requireTrue(
    config.version === 1 &&
      /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(config.repository) &&
      Number.isSafeInteger(config.appId) &&
      config.appId > 0 &&
      isSha(config.sha) &&
      isSha(config.runtimeSha) &&
      /^sha256:[a-f0-9]{64}$/.test(config.imageDigest) &&
      ["pr", "main"].includes(config.profile) &&
      /^[A-Za-z0-9_-]{1,128}$/.test(config.attemptId) &&
      isDigest(config.challenge) &&
      Number.isSafeInteger(config.requestedAt) &&
      Number.isSafeInteger(config.maxAgeMs) &&
      config.maxAgeMs > 0 &&
      Number.isSafeInteger(config.maxDurationMs) &&
      config.maxDurationMs > 0 &&
      isAbsolute(config.adapterPath) &&
      isDigest(config.adapterDigest) &&
      nonempty(config.publicKey),
    "Invalid supervisor binding"
  )
  requireTrue(
    exactKeys(config.resources, [
      "kind",
      "cpus",
      "memoryMiB",
      "diskMiB",
      "networkPolicy",
    ]) &&
      config.resources.kind === "disposable-vm" &&
      config.resources.networkPolicy === "fixture-only" &&
      [
        config.resources.cpus,
        config.resources.memoryMiB,
        config.resources.diskMiB,
      ].every((value) => Number.isSafeInteger(value) && value > 0),
    "Disposable fixture resource policy required"
  )
  requireTrue(
    Array.isArray(config.commands) &&
      config.commands.length === FULL_HOSTED_ROOTS.length &&
      new Set(config.commands.map((entry) => entry.lane)).size ===
        FULL_HOSTED_ROOTS.length,
    "Complete exact lane inventory required"
  )
  for (const command of config.commands) {
    requireTrue(
      exactKeys(command, ["lane", "argv", "timeoutMs"]) &&
        FULL_HOSTED_ROOTS.includes(command.lane) &&
        Array.isArray(command.argv) &&
        command.argv.length > 0 &&
        command.argv.every(nonempty) &&
        Number.isSafeInteger(command.timeoutMs) &&
        command.timeoutMs > 0 &&
        command.timeoutMs <= config.maxDurationMs,
      "Invalid protected command"
    )
  }
}

/** Root ownership applies to every ancestor, not just the selected file. */
export async function readProtectedFile(path) {
  requireTrue(isAbsolute(path), "Protected path must be absolute")
  const canonical = await realpath(path)
  requireTrue(
    canonical === resolve(path),
    "Protected paths must not contain symlinks"
  )
  let current = canonical
  while (true) {
    const stat = await lstat(current)
    requireTrue(
      stat.uid === 0 && (stat.mode & 0o022) === 0 && !stat.isSymbolicLink(),
      "Protected path must be root-owned and not group/world writable"
    )
    if (current === canonical)
      requireTrue(stat.isFile(), "Protected input must be a regular file")
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
  return readFile(canonical)
}

function checkAllocation(allocation, config) {
  requireTrue(
    exactKeys(allocation, [
      "id",
      "kind",
      "imageDigest",
      "runtimeSha",
      "sha",
      "resources",
      "fresh",
      "hostMounts",
      "credentialsForwarded",
    ]) &&
      nonempty(allocation.id) &&
      allocation.kind === "disposable-vm" &&
      allocation.fresh === true &&
      allocation.imageDigest === config.imageDigest &&
      allocation.runtimeSha === config.runtimeSha &&
      allocation.sha === config.sha &&
      JSON.stringify(allocation.resources) ===
        JSON.stringify(config.resources) &&
      allocation.hostMounts === false &&
      allocation.credentialsForwarded === false,
    "Unqualified resource allocation"
  )
}

/** Trusted adapter contract: reserveAttempt is durable atomic admission;
 * allocate/execute/destroy/inspectAbsent use provider inspection, not candidate
 * result JSON. execute returns captured raw streams and supervisor exit status.
 * Adapter receives no signing key or protected config. Production integration
 * must enforce timeout/cancellation and reap resources even after host restart.
 */
export async function runTrustedSupervisor({
  config,
  privateKey,
  adapter,
  now = () => Date.now(),
}) {
  validateConfig(config)
  const { signProofEnvelope } = await import("../core/proof-envelope.mjs")
  const { verifyProofPolicy } = await import("../core/proof-policy.mjs")
  requireTrue(
    ["reserveAttempt", "allocate", "execute", "destroy", "inspectAbsent"].every(
      (name) => typeof adapter?.[name] === "function"
    ),
    "Trusted lifecycle adapter required"
  )
  const key = createPrivateKey(privateKey)
  requireTrue(
    key.asymmetricKeyType === "ed25519",
    "Ed25519 signing key required"
  )
  const publicKey = createPublicKey(key)
    .export({ type: "spki", format: "pem" })
    .toString()
  requireTrue(
    publicKey === config.publicKey,
    "Signing key does not match protected public key"
  )
  const startedAt = now()
  requireTrue(startedAt >= config.requestedAt, "Request starts in the future")
  const admission = {
    repository: config.repository,
    sha: config.sha,
    profile: config.profile,
    attemptId: config.attemptId,
    challenge: config.challenge,
  }
  requireTrue(
    (await adapter.reserveAttempt(admission)) === true,
    "Attempt replayed or superseded"
  )
  const manifests = []
  const resourceIds = new Set()
  for (const command of config.commands) {
    let allocation
    let allocationError
    let result
    const laneStartedAt = now()
    requireTrue(
      laneStartedAt - startedAt < config.maxDurationMs,
      "Supervisor time budget exhausted"
    )
    try {
      allocation = await adapter.allocate({
        ...admission,
        lane: command.lane,
        imageDigest: config.imageDigest,
        runtimeSha: config.runtimeSha,
        resources: structuredClone(config.resources),
      })
      checkAllocation(allocation, config)
      requireTrue(
        !resourceIds.has(allocation.id),
        "Resource identity reused across lanes"
      )
      resourceIds.add(allocation.id)
      result = await adapter.execute({
        resourceId: allocation.id,
        argv: [...command.argv],
        timeoutMs: Math.min(
          command.timeoutMs,
          config.maxDurationMs - (now() - startedAt)
        ),
      })
      requireTrue(
        exactKeys(result, ["exitCode", "signal", "stdout", "stderr"]) &&
          Number.isInteger(result.exitCode) &&
          result.signal === null &&
          (typeof result.stdout === "string" ||
            Buffer.isBuffer(result.stdout)) &&
          (typeof result.stderr === "string" || Buffer.isBuffer(result.stderr)),
        "Incomplete supervisor execution evidence"
      )
    } catch (error) {
      allocationError = error
    } finally {
      if (allocation?.id) {
        await adapter.destroy({ resourceId: allocation.id })
        requireTrue(
          (await adapter.inspectAbsent({ resourceId: allocation.id })) === true,
          "Disposable resource destruction unverified"
        )
      }
    }
    if (allocationError) throw allocationError
    requireTrue(
      result.exitCode === 0,
      "Lane failed; no successful envelope emitted"
    )
    const completedAt = now()
    requireTrue(
      completedAt >= laneStartedAt &&
        completedAt - laneStartedAt <= command.timeoutMs &&
        completedAt - startedAt <= config.maxDurationMs,
      "Lane exceeded trusted time budget"
    )
    manifests.push({
      lane: command.lane,
      argv: command.argv,
      resource: allocation,
      startedAt: laneStartedAt,
      completedAt,
      destroyed: true,
      exitCode: result.exitCode,
      stdoutDigest: hash(result.stdout),
      stderrDigest: hash(result.stderr),
    })
  }
  const completedAt = now()
  const commandDigest = supervisorCommandDigest(
    config.commands,
    config.resources
  )
  const observedLogDigests = Object.fromEntries(
    manifests.map((manifest) => [manifest.lane, jsonHash(manifest)])
  )
  const bindings = {
    ...admission,
    appId: config.appId,
    runtimeSha: config.runtimeSha,
    imageDigest: config.imageDigest,
    commandDigest,
  }
  const payload = {
    version: 1,
    ...bindings,
    startedAt,
    completedAt,
    lanes: manifests.map((manifest) => ({
      name: manifest.lane,
      outcome: "success",
      logDigest: observedLogDigests[manifest.lane],
    })),
  }
  const envelope = signProofEnvelope(payload, key)
  const policy = { ...config, ...bindings, lanes: FULL_HOSTED_ROOTS }
  const verified = verifyProofPolicy({
    envelope,
    policy,
    now: completedAt,
    observedLogDigests,
    publisherAppId: config.appId,
  })
  requireTrue(
    verified.valid,
    "Supervisor envelope failed independent policy validation"
  )
  return {
    schema: "nabaperks.trusted-supervisor-observation.v1",
    authorityEligible: false,
    route: "hosted",
    requiredRoots: [...FULL_HOSTED_ROOTS],
    envelope,
    observedLogDigests,
    manifests,
    limitations: [
      "Qualification observation only; independent installed-runtime and provider proof remain required",
    ],
  }
}

/** CLI loads protected inputs only. Key is read from a pre-opened pipe FD. */
export async function main(args = process.argv.slice(2)) {
  requireTrue(
    args.length === 4 &&
      args[0] === "--config" &&
      args[2] === "--key-fd" &&
      /^\d+$/.test(args[3]) &&
      Number(args[3]) >= 3,
    "Usage: trusted-supervisor --config /protected/config.json --key-fd 3"
  )
  // The independently installed tree (including imported validators) must share
  // the same ownership boundary. Checking this source path catches accidental
  // invocation from a user-writable candidate/worktree.
  await readProtectedFile(new URL(import.meta.url).pathname)
  for (const relative of [
    "../core/proof-envelope.mjs",
    "../core/proof-policy.mjs",
  ]) {
    await readProtectedFile(new URL(relative, import.meta.url).pathname)
  }
  const config = JSON.parse((await readProtectedFile(args[1])).toString("utf8"))
  validateConfig(config)
  const adapterBytes = await readProtectedFile(config.adapterPath)
  requireTrue(
    hash(adapterBytes) === config.adapterDigest,
    "Installed adapter digest mismatch"
  )
  const adapter = await import(pathToFileURL(config.adapterPath).href)
  const descriptor = Number(args[3])
  requireTrue(
    fstatSync(descriptor).isFIFO(),
    "Signing key descriptor must be a pipe"
  )
  const keyBytes = readFileSync(descriptor)
  try {
    requireTrue(keyBytes.length <= 16_384, "Signing key input exceeds limit")
    const result = await runTrustedSupervisor({
      config,
      privateKey: keyBytes,
      adapter,
    })
    process.stdout.write(`${JSON.stringify(result)}\n`)
  } finally {
    keyBytes.fill(0)
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch(() => {
    // Never serialize arbitrary adapter errors: they may contain job secrets.
    process.stderr.write(
      "Trusted supervisor refused or failed; no authoritative local proof produced.\n"
    )
    process.exitCode = 1
  })
}
