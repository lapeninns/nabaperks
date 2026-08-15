import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

const PROJECT_ID_PATTERN = /^nabaperks-task20-[a-f0-9]{9}$/
const LOOPBACK_HOST = "127.0.0.1"
const DATABASE_NAME = "postgres"
const DATABASE_USER = "postgres"
const RECEIPT_FILE = "supabase/.temp/disposable-runtime.json"
const RECEIPT_KEY_GIT_PATH = "nabaperks-disposable-runtime.key"
const RECEIPT_SCHEMA_VERSION = 2
const LINKED_ENV_KEYS = [
  "DATABASE_URL",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_PROJECT_ID",
  "SUPABASE_PROJECT_REF",
  "SUPABASE_URL",
]

export class NonDisposableTargetError extends Error {
  constructor(reasons) {
    super(`NON_DISPOSABLE_TARGET: ${reasons.join(", ")}`)
    this.name = "NonDisposableTargetError"
    this.code = "NON_DISPOSABLE_TARGET"
    this.reasons = reasons
  }
}

export function readDisposableProject(projectDir = process.cwd()) {
  const source = readFileSync(join(projectDir, "supabase/config.toml"), "utf8")
  const projectId = source.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1] ?? ""
  const dbPort = source.match(/^\[db\]\s*[\s\S]*?^port\s*=\s*(\d+)/m)?.[1] ?? ""

  if (!PROJECT_ID_PATTERN.test(projectId) || !dbPort) {
    throw new NonDisposableTargetError(["unsealed-project-config"])
  }

  return { projectId, dbPort }
}

export function assertDisposableDbTarget(
  rawUrl,
  {
    projectDir = process.cwd(),
    env = process.env,
    allowedDatabases = [DATABASE_NAME],
    requireClean = true,
    requireRuntime = true,
  } = {}
) {
  const project = readDisposableProject(projectDir)
  const reasons = []
  let url

  try {
    url = new URL(rawUrl)
  } catch {
    throw new NonDisposableTargetError(["malformed-url"])
  }

  if (!new Set(["postgres:", "postgresql:"]).has(url.protocol)) {
    reasons.push("unexpected-protocol")
  }
  if (url.hostname !== LOOPBACK_HOST) reasons.push("unexpected-host")
  if (url.port !== project.dbPort) reasons.push("unexpected-port")
  if (!allowedDatabases.includes(url.pathname.slice(1))) {
    reasons.push("unexpected-database")
  }
  if (url.username !== DATABASE_USER) reasons.push("unexpected-user")
  if (!url.password) reasons.push("missing-password")
  if (url.search || url.hash) reasons.push("unexpected-url-suffix")

  const linkedEnv = LINKED_ENV_KEYS.filter((key) => env[key]?.trim())
  if (linkedEnv.length) reasons.push("linked-environment")
  if (
    existsSync(join(projectDir, "supabase/.temp/project-ref")) ||
    existsSync(join(projectDir, "supabase/.temp/pooler-url"))
  ) {
    reasons.push("linked-state")
  }
  if (
    requireClean &&
    git(projectDir, ["status", "--porcelain", "--untracked-files=no"])
  ) {
    reasons.push("dirty-source")
  }
  if (reasons.length) throw new NonDisposableTargetError(reasons)
  if (requireRuntime) assertRuntimeReceipt(projectDir, project)

  return project
}

export function createDisposableDbClient(rawUrl, connectionFactory, options) {
  assertDisposableDbTarget(rawUrl, options)
  return connectionFactory(rawUrl)
}

export function assertLocalStackInvocation(
  command,
  { projectDir = process.cwd(), env = process.env } = {}
) {
  const project = readDisposableProject(projectDir)
  const linkedEnv = LINKED_ENV_KEYS.filter((key) => env[key]?.trim())
  if (env.SUPABASE_DB_URL?.trim() || linkedEnv.length) {
    throw new NonDisposableTargetError(["unsafe-supabase-environment"])
  }
  if (git(projectDir, ["status", "--porcelain", "--untracked-files=no"])) {
    throw new NonDisposableTargetError(["dirty-source"])
  }

  const containerId = dockerContainerId(project.projectId)
  const receipt = readRuntimeReceipt(projectDir)
  if (
    command === "start" &&
    containerId &&
    !runtimeMatches(receipt, projectDir, project, containerId)
  ) {
    throw new NonDisposableTargetError(["namespace-collision"])
  }
  if (command === "stop") {
    if (
      !containerId ||
      !runtimeMatches(receipt, projectDir, project, containerId)
    ) {
      throw new NonDisposableTargetError(["runtime-receipt-mismatch"])
    }
  }
  if (command === "status" && containerId) {
    if (!runtimeMatches(receipt, projectDir, project, containerId)) {
      throw new NonDisposableTargetError(["runtime-receipt-mismatch"])
    }
  }
  return project
}

export function recordRuntimeReceipt(projectDir, project) {
  const containerId = dockerContainerId(project.projectId)
  if (!containerId)
    throw new NonDisposableTargetError(["database-container-missing"])
  const payload = {
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    projectId: project.projectId,
    dbPort: project.dbPort,
    sourceSha: git(projectDir, ["rev-parse", "HEAD"]),
    containerId,
  }
  const receipt = {
    ...payload,
    signature: signRuntimeReceipt(payload, receiptKey(projectDir, true)),
  }
  writeFileSync(
    join(projectDir, RECEIPT_FILE),
    `${JSON.stringify(receipt, null, 2)}\n`,
    { mode: 0o600 }
  )
}

export function removeRuntimeReceipt(projectDir = process.cwd()) {
  const path = join(projectDir, RECEIPT_FILE)
  if (existsSync(path)) unlinkSync(path)
}

function assertRuntimeReceipt(projectDir, project) {
  const containerId = dockerContainerId(project.projectId)
  const receipt = readRuntimeReceipt(projectDir)
  if (
    !containerId ||
    !runtimeMatches(receipt, projectDir, project, containerId)
  ) {
    throw new NonDisposableTargetError(["runtime-receipt-mismatch"])
  }
}

function runtimeMatches(receipt, projectDir, project, containerId) {
  if (
    !receipt ||
    receipt.schemaVersion !== RECEIPT_SCHEMA_VERSION ||
    receipt.projectId !== project.projectId ||
    receipt.dbPort !== project.dbPort ||
    receipt.sourceSha !== git(projectDir, ["rev-parse", "HEAD"]) ||
    receipt.containerId !== containerId ||
    typeof receipt.signature !== "string" ||
    !/^[a-f0-9]{64}$/.test(receipt.signature)
  ) {
    return false
  }

  const key = receiptKey(projectDir, false)
  if (!key) return false
  const expected = signRuntimeReceipt(
    {
      schemaVersion: receipt.schemaVersion,
      projectId: receipt.projectId,
      dbPort: receipt.dbPort,
      sourceSha: receipt.sourceSha,
      containerId: receipt.containerId,
    },
    key
  )
  return timingSafeEqual(
    Buffer.from(receipt.signature, "hex"),
    Buffer.from(expected, "hex")
  )
}

function signRuntimeReceipt(payload, key) {
  return createHmac("sha256", key)
    .update(
      JSON.stringify([
        payload.schemaVersion,
        payload.projectId,
        payload.dbPort,
        payload.sourceSha,
        payload.containerId,
      ])
    )
    .digest("hex")
}

function receiptKey(projectDir, create) {
  const rawPath = git(projectDir, [
    "rev-parse",
    "--git-path",
    RECEIPT_KEY_GIT_PATH,
  ])
  const path = rawPath.startsWith("/") ? rawPath : join(projectDir, rawPath)

  if (!existsSync(path)) {
    if (!create) return ""
    writeFileSync(path, `${randomBytes(32).toString("hex")}\n`, {
      flag: "wx",
      mode: 0o600,
    })
  }

  const key = readFileSync(path, "utf8").trim()
  if (!/^[a-f0-9]{64}$/.test(key)) {
    throw new NonDisposableTargetError(["runtime-receipt-key-invalid"])
  }
  return key
}

function readRuntimeReceipt(projectDir) {
  try {
    return JSON.parse(readFileSync(join(projectDir, RECEIPT_FILE), "utf8"))
  } catch {
    return null
  }
}

function dockerContainerId(projectId) {
  const result = spawnSync(
    "docker",
    ["inspect", "--format", "{{.Id}}", `supabase_db_${projectId}`],
    {
      encoding: "utf8",
      timeout: 5_000,
    }
  )
  return result.status === 0 ? result.stdout.trim() : ""
}

function git(projectDir, args) {
  const result = spawnSync("git", args, {
    cwd: projectDir,
    encoding: "utf8",
    timeout: 5_000,
  })
  if (result.status !== 0)
    throw new NonDisposableTargetError(["source-identity-unavailable"])
  return result.stdout.trim()
}
