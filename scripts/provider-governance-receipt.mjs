import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

const RECEIPT_SCHEMA = "nabaperks.provider-governance-readback.v1"
const SHA1 = /^[a-f0-9]{40}$/
const SHA256 = /^[a-f0-9]{64}$/
const SAFE_IDENTIFIER = /^[a-z0-9][a-z0-9._:/-]*$/i
const PROMPT_KEYS = new Set([
  "aggregateReleaseGate",
  "instructions",
  "metadata",
  "prompt",
  "releaseGate",
])

export class ProviderReceiptError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

function reject(code) {
  throw new ProviderReceiptError(code)
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function record(value) {
  if (!isRecord(value)) reject("MALFORMED_RECEIPT")
  return value
}

function exactKeys(value, expected) {
  const target = record(value)
  const actual = Object.keys(target)
  if (actual.some((key) => PROMPT_KEYS.has(key))) {
    reject("PROMPT_LIKE_METADATA")
  }
  if (
    JSON.stringify([...actual].sort()) !== JSON.stringify([...expected].sort())
  ) {
    reject("MALFORMED_RECEIPT")
  }
  return target
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex")
}

function git(repositoryRoot, args) {
  try {
    return execFileSync("git", ["-C", repositoryRoot, ...args], {
      encoding: "utf8",
      timeout: 5_000,
    }).trimEnd()
  } catch (error) {
    if (error instanceof ProviderReceiptError) throw error
    reject("DIRTY_SOURCE")
  }
}

function validateContract(contract, provider) {
  exactKeys(contract, [
    "allowedReadEffects",
    "maximumAgeMinutes",
    "provider",
    "receiptProducerTask",
    "schema",
    "sourceRepository",
  ])
  if (
    contract.schema !== RECEIPT_SCHEMA ||
    contract.provider !== provider ||
    contract.receiptProducerTask !== 27 ||
    typeof contract.sourceRepository !== "string" ||
    !Number.isInteger(contract.maximumAgeMinutes) ||
    contract.maximumAgeMinutes <= 0 ||
    !Array.isArray(contract.allowedReadEffects) ||
    contract.allowedReadEffects.length === 0 ||
    contract.allowedReadEffects.some(
      (effect) => typeof effect !== "string" || !SAFE_IDENTIFIER.test(effect)
    )
  ) {
    reject("MALFORMED_CONTRACT")
  }
}

function validateSubject(contract, subject, repositoryRoot) {
  exactKeys(subject, ["repository", "sha", "statusSha256", "tree"])
  if (
    subject.repository !== contract.sourceRepository ||
    !SHA1.test(subject.sha) ||
    !SHA1.test(subject.tree) ||
    !SHA256.test(subject.statusSha256)
  ) {
    reject("MALFORMED_RECEIPT")
  }
  if (git(repositoryRoot, ["rev-parse", "HEAD"]) !== subject.sha) {
    reject("STALE_SUBJECT")
  }
  if (git(repositoryRoot, ["rev-parse", "HEAD^{tree}"]) !== subject.tree) {
    reject("STALE_SUBJECT")
  }
  const status = git(repositoryRoot, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ])
  if (status !== "" || subject.statusSha256 !== digest("")) {
    reject("DIRTY_SOURCE")
  }
}

function validateRun(contract, run, now) {
  exactKeys(run, ["attempt", "completedAt", "conclusion", "id", "startedAt"])
  const startedAt = Date.parse(run.startedAt)
  const completedAt = Date.parse(run.completedAt)
  if (
    typeof run.id !== "string" ||
    !SAFE_IDENTIFIER.test(run.id) ||
    run.attempt !== 1 ||
    run.conclusion !== "success" ||
    !Number.isFinite(startedAt) ||
    !Number.isFinite(completedAt) ||
    completedAt < startedAt
  ) {
    reject("MALFORMED_RECEIPT")
  }
  const ageMinutes = (now.getTime() - completedAt) / 60_000
  if (ageMinutes < 0 || ageMinutes > contract.maximumAgeMinutes) {
    reject("STALE_RUN")
  }
}

function validateCollector(collector) {
  exactKeys(collector, ["action", "actionRef", "mode"])
  if (
    typeof collector.action !== "string" ||
    !SAFE_IDENTIFIER.test(collector.action) ||
    collector.mode !== "read-only"
  ) {
    reject("MALFORMED_RECEIPT")
  }
  if (!SHA1.test(collector.actionRef)) reject("UNPINNED_ACTION")
}

function validateEffects(contract, effects) {
  exactKeys(effects, ["declaredCount", "reads", "writes"])
  if (!Array.isArray(effects.reads) || !Array.isArray(effects.writes)) {
    reject("MALFORMED_RECEIPT")
  }
  if (effects.writes.length > 0) reject("WRITE_EFFECT")
  if (
    !Number.isInteger(effects.declaredCount) ||
    effects.declaredCount !== effects.reads.length + effects.writes.length
  ) {
    reject("HIDDEN_EFFECT")
  }
  const allowed = new Set(contract.allowedReadEffects)
  for (const read of effects.reads) {
    exactKeys(read, ["kind", "resultSha256", "target"])
    if (
      !allowed.has(read.kind) ||
      typeof read.target !== "string" ||
      !SAFE_IDENTIFIER.test(read.target) ||
      !SHA256.test(read.resultSha256)
    ) {
      reject("UNDECLARED_EFFECT")
    }
  }
}

export function readProviderGovernanceReceipt(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch (error) {
    if (error instanceof ProviderReceiptError) throw error
    reject("MALFORMED_RECEIPT")
  }
}

export function validateProviderGovernanceReceipt(
  contract,
  receipt,
  { now = new Date(), repositoryRoot = process.cwd() } = {}
) {
  const candidate = exactKeys(receipt, [
    "collector",
    "effects",
    "evidence",
    "evidenceSha256",
    "provider",
    "run",
    "schema",
    "subject",
  ])
  validateContract(contract, candidate.provider)
  if (candidate.schema !== RECEIPT_SCHEMA) reject("MALFORMED_RECEIPT")
  validateSubject(contract, record(candidate.subject), repositoryRoot)
  validateRun(contract, record(candidate.run), now)
  validateCollector(record(candidate.collector))
  validateEffects(contract, record(candidate.effects))
  if (
    !isRecord(candidate.evidence) ||
    Object.keys(candidate.evidence).length === 0
  ) {
    reject("MALFORMED_RECEIPT")
  }
  if (
    !SHA256.test(candidate.evidenceSha256) ||
    candidate.evidenceSha256 !== digest(JSON.stringify(candidate.evidence))
  ) {
    reject("STALE_RECEIPT")
  }
  return candidate.evidence
}
