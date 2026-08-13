#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { lstatSync, readFileSync, realpathSync } from "node:fs"
import { dirname, relative, resolve } from "node:path"

const SCHEMA = "nabaperks.task15.test-infrastructure-map.v1"
const RECEIPT_SCHEMA = "nabaperks.task15.direct-receipt.v1"
const STATUS = new Set(["fixed", "failed", "blocked"])
const SHA256 = /^[a-f0-9]{64}$/
const GIT_OBJECT_ID = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/
const PNPM_SCRIPT_COMMANDS = new Map([
  [
    "pnpm deadcode:check",
    ["deadcode:check", "knip --include files,dependencies,unresolved"],
  ],
  [
    "pnpm duplicates:check",
    ["duplicates:check", "jscpd app components lib --config jscpd.json"],
  ],
  ["pnpm lint", ["lint", "eslint --max-warnings=0"]],
])

class ValidationError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

function reject(code) {
  throw new ValidationError(code)
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function record(value, code) {
  if (!isRecord(value)) reject(code)
  return value
}

function array(value, code) {
  if (!Array.isArray(value)) reject(code)
  return value
}

function exactKeys(value, expected, code) {
  const actual = Object.keys(record(value, code)).sort()
  const sortedExpected = [...expected].sort()
  if (JSON.stringify(actual) !== JSON.stringify(sortedExpected)) reject(code)
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

function valueSha256(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

function sha256Value(value) {
  return createHash("sha256").update(value).digest("hex")
}

function json(path, code) {
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch {
    reject(code)
  }
}

function trustedPath(path, root, code) {
  try {
    if (path.split("/").includes("..")) reject(code)
    const target = resolve(path)
    const governedRoot = resolve(root)
    const pathFromRoot = relative(governedRoot, target)
    if (pathFromRoot === "" || pathFromRoot.startsWith("..")) reject(code)
    let current = governedRoot
    if (lstatSync(current).isSymbolicLink()) reject(code)
    for (const segment of pathFromRoot.split("/")) {
      current = resolve(current, segment)
      if (lstatSync(current).isSymbolicLink()) reject(code)
    }
    if (!realpathSync(target).startsWith(`${realpathSync(governedRoot)}/`)) {
      reject(code)
    }
    return target
  } catch {
    reject(code)
  }
}

function regularFile(path, root, code) {
  const trusted = trustedPath(path, root, code)
  if (!lstatSync(trusted).isFile()) reject(code)
  return trusted
}

function trustedEvidenceRoot(path, code) {
  const target = resolve(path)
  const marker = "/.omo/evidence/"
  const markerIndex = target.indexOf(marker)
  if (markerIndex <= 0) reject(code)
  const root = target.slice(0, markerIndex + marker.length - 1)
  try {
    let current = "/"
    for (const segment of root.split("/").filter(Boolean)) {
      current = resolve(current, segment)
      if (lstatSync(current).isSymbolicLink()) reject(code)
    }
    return root
  } catch {
    reject(code)
  }
}

/**
 * Structural TAP read.
 *
 * Reading only the `# label N` summary lines made the file tamper-evident in
 * its totals but blind everywhere else: trailing bytes are never compared, so a
 * fabricated `ok 2 - …` assertion or an arbitrary payload could be appended to
 * a green or red TAP and the register still reported success. Receipts carry no
 * hash for TAP files, so the grammar has to carry the integrity.
 *
 * A `node --test --test-reporter=tap` file ends with exactly one plan line,
 * one summary line per label, and a `# duration_ms` terminator, with one
 * top-level `ok`/`not ok` per planned assertion. All four are now required, so
 * appended content has nowhere to hide.
 */
function tapTotals(path, root, code) {
  const trusted = regularFile(path, root, code)
  const lines = readFileSync(trusted, "utf8").split("\n")
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop()
  if (lines.shift() !== "TAP version 13") reject(code)

  let assertions = 0
  let failures = 0
  let index = 0
  while (index < lines.length && !/^1\.\.\d+$/.test(lines[index])) {
    if (assertions === 0 && lines[index].startsWith("# node:")) {
      do {
        index += 1
      } while (lines[index]?.startsWith("#") === true)
    }
    if (lines[index]?.startsWith("# Subtest: ")) index += 1
    const assertion = lines[index]?.match(/^(ok|not ok) (\d+) - .+$/)
    if (assertion === undefined || assertion === null) reject(code)
    if (Number(assertion[2]) !== assertions + 1) reject(code)
    assertions += 1
    if (assertion[1] === "not ok") failures += 1
    index += 1
    if (lines[index] === "  ---") {
      index += 1
      while (index < lines.length && lines[index] !== "  ...") {
        if (!/^  .*$/.test(lines[index])) reject(code)
        index += 1
      }
      if (lines[index] !== "  ...") reject(code)
      index += 1
    }
  }

  const plan = lines[index]?.match(/^1\.\.(\d+)$/)
  if (plan === undefined || plan === null || Number(plan[1]) !== assertions)
    reject(code)
  index += 1
  const labels =
    lines[index + 1]?.startsWith("# suites ") === true
      ? ["tests", "suites", "pass", "fail", "cancelled", "skipped", "todo"]
      : ["tests", "pass", "fail", "skipped"]
  const summary = labels.map((label) => {
    const line = lines[index]
    index += 1
    return line?.match(new RegExp(`^# ${label} (\\d+)$`))
  })
  const duration = lines[index]
  if (
    summary.some((line) => line === undefined || line === null) ||
    !/^# duration_ms \d+(?:\.\d+)?$/.test(duration ?? "") ||
    index + 1 !== lines.length
  ) {
    reject(code)
  }
  const standard = labels.length === 7
  const totals = {
    tests: Number(summary[0][1]),
    passed: Number(summary[standard ? 2 : 1][1]),
    failed: Number(summary[standard ? 3 : 2][1]),
    skipped: Number(summary[standard ? 5 : 3][1]),
  }
  if (
    totals.tests !== assertions ||
    totals.failed !== failures ||
    totals.passed !== assertions - failures
  ) {
    reject(code)
  }
  return totals
}

function expectedExit(path, root, expected, code) {
  const trusted = regularFile(path, root, code)
  if (readFileSync(trusted, "utf8") !== `${expected}\n`) reject(code)
}

function evidenceStem(path) {
  const match = path.match(/\/receipts\/([a-z0-9-]+)-direct-receipt\.json$/)
  if (match === null) reject("UNTRUSTED_EXECUTION_EVIDENCE")
  return match[1]
}

function commandTarget(command) {
  const node = command.match(
    /^node(?: --import \.\/tests\/support\/register-alias\.mjs)? --test(?: --test-concurrency=[1-9]\d*)?(?: --import \.\/tests\/support\/register-alias\.mjs)? (tests\/(?:unit|e2e)\/[a-z0-9][a-z0-9._/-]*\.(?:test|spec)\.mjs)$/
  )
  if (node !== null) return node[1]
  const playwright = command.match(
    /^PLAYWRIGHT_WORKERS=[1-9]\d* PLAYWRIGHT_RETRIES=0 pnpm exec playwright test (tests\/e2e\/[a-z0-9][a-z0-9._/-]*\.spec\.ts) --project=chromium --reporter=(?:line|tests\/support\/playwright-tap-reporter\.mjs)$/
  )
  if (playwright !== null) return playwright[1]
  if (PNPM_SCRIPT_COMMANDS.has(command)) return "package.json"
  reject("UNTRUSTED_EXECUTION_EVIDENCE")
}

function trustedPnpmScript(command, packageBytes) {
  const script = PNPM_SCRIPT_COMMANDS.get(command)
  if (script === undefined) return
  try {
    const manifest = JSON.parse(packageBytes)
    if (
      !isRecord(manifest.scripts) ||
      manifest.scripts[script[0]] !== script[1]
    ) {
      reject("UNTRUSTED_EXECUTION_EVIDENCE")
    }
  } catch {
    reject("UNTRUSTED_EXECUTION_EVIDENCE")
  }
}

function validateExecutionEvidence(receipt, artifact, governedRoot) {
  const source = record(artifact.source, "MALFORMED_SOURCE_IDENTITY")
  const evidenceRoot = `${governedRoot}/.omo/evidence`
  const artifactPath = regularFile(
    receipt.artifact.path,
    evidenceRoot,
    "UNTRUSTED_EXECUTION_EVIDENCE"
  )
  const sourcePath = trustedPath(
    source.path,
    evidenceRoot,
    "UNTRUSTED_EXECUTION_EVIDENCE"
  )
  const ownedPath = commandTarget(artifact.command)
  let committed
  try {
    committed = execFileSync(
      "git",
      ["-C", sourcePath, "show", `HEAD:${ownedPath}`],
      {
        encoding: "buffer",
        timeout: 5_000,
      }
    )
    if (
      sha256Value(committed) !==
      sha256(
        trustedPath(
          `${sourcePath}/${ownedPath}`,
          sourcePath,
          "STALE_OWNED_INVENTORY"
        )
      )
    ) {
      reject("STALE_OWNED_INVENTORY")
    }
  } catch {
    reject("STALE_OWNED_INVENTORY")
  }
  trustedPnpmScript(artifact.command, committed)
  const receiptDirectory = dirname(artifactPath)
  const stem = evidenceStem(artifactPath)
  const green = tapTotals(
    `${receiptDirectory}/${stem}-direct.tap`,
    evidenceRoot,
    "UNTRUSTED_EXECUTION_EVIDENCE"
  )
  expectedExit(
    `${receiptDirectory}/${stem}-direct.exit`,
    evidenceRoot,
    0,
    "UNTRUSTED_EXECUTION_EVIDENCE"
  )
  if (JSON.stringify(green) !== JSON.stringify(receipt.totals)) {
    reject("DIRECT_RECEIPT_MISMATCH")
  }
  const lane = dirname(receiptDirectory)
  const red = tapTotals(
    `${lane}/red/${stem}.tap`,
    evidenceRoot,
    "UNTRUSTED_EXECUTION_EVIDENCE"
  )
  if (red.tests <= 0 || red.failed <= 0 || red.passed >= red.tests) {
    reject("UNTRUSTED_EXECUTION_EVIDENCE")
  }
  expectedExit(
    `${lane}/red/${stem}.exit`,
    evidenceRoot,
    1,
    "UNTRUSTED_EXECUTION_EVIDENCE"
  )
}

function task37Rows(task37) {
  return array(record(task37, "MALFORMED_TASK37").rows, "MALFORMED_TASK37")
    .filter((row) => row.category === "test-infrastructure")
    .map((row) => ({
      stableId: row.stable_id,
      title: row.title,
      sourceRowSha256: valueSha256(row),
    }))
}

function task5Rows(task5) {
  return array(
    record(record(task5, "MALFORMED_TASK5").registers, "MALFORMED_TASK5")
      .defects.rows,
    "MALFORMED_TASK5"
  )
    .filter((row) => row.category === "test-infrastructure")
    .map((row) => ({
      stableId: row.stable_id,
      title: row.title,
      sourceRowSha256: row.source_row_sha256,
    }))
}

function equalRowSets(left, right) {
  const toKey = (row) =>
    JSON.stringify([row.stableId, row.title, row.sourceRowSha256])
  return (
    JSON.stringify(left.map(toKey).sort()) ===
    JSON.stringify(right.map(toKey).sort())
  )
}

function verifyAuthority(authority) {
  exactKeys(authority, ["task5Map", "task37Defects"], "MALFORMED_AUTHORITY")
  const authorityFiles = {}
  const authorityRoots = []
  for (const key of ["task5Map", "task37Defects"]) {
    exactKeys(authority[key], ["path", "sha256"], "MALFORMED_AUTHORITY")
    if (
      typeof authority[key].path !== "string" ||
      !SHA256.test(authority[key].sha256)
    ) {
      reject("MALFORMED_AUTHORITY")
    }
    const root = trustedEvidenceRoot(
      authority[key].path,
      "UNTRUSTED_AUTHORITY_INPUT"
    )
    const path = regularFile(
      authority[key].path,
      root,
      "UNTRUSTED_AUTHORITY_INPUT"
    )
    try {
      if (sha256(path) !== authority[key].sha256) {
        reject("STALE_AUTHORITY")
      }
    } catch {
      reject("STALE_AUTHORITY")
    }
    authorityRoots.push(root)
    authorityFiles[key] = path
  }
  if (new Set(authorityRoots).size !== 1) reject("UNTRUSTED_AUTHORITY_INPUT")
  const task5 = task5Rows(json(authorityFiles.task5Map, "MALFORMED_TASK5"))
  const task37 = task37Rows(
    json(authorityFiles.task37Defects, "MALFORMED_TASK37")
  )
  if (
    task5.length !== 65 ||
    task37.length !== 65 ||
    !equalRowSets(task5, task37)
  ) {
    reject("AUTHORITY_ROW_PARITY")
  }
  return {
    governedRoot: authorityRoots[0].slice(0, -"/.omo/evidence".length),
    rows: task37,
  }
}

function terminalRow(row, authorityById) {
  const allowedKeys =
    row.status === "fixed"
      ? ["stableId", "title", "sourceRowSha256", "status", "reason", "receipt"]
      : ["stableId", "title", "sourceRowSha256", "status", "reason"]
  exactKeys(row, allowedKeys, "MALFORMED_ROW")
  if (
    typeof row.stableId !== "string" ||
    typeof row.title !== "string" ||
    !SHA256.test(row.sourceRowSha256) ||
    !STATUS.has(row.status) ||
    typeof row.reason !== "string" ||
    row.reason.length === 0
  ) {
    reject("MALFORMED_ROW")
  }
  const authority = authorityById.get(row.stableId)
  if (authority === undefined) reject("ORPHAN_STABLE_ID")
  if (
    authority.title !== row.title ||
    authority.sourceRowSha256 !== row.sourceRowSha256
  ) {
    reject("ROW_IDENTITY_MISMATCH")
  }
  return row
}

function cleanGitSource(source) {
  exactKeys(
    source,
    ["head", "path", "statusSha256", "tree"],
    "MALFORMED_SOURCE_IDENTITY"
  )
  if (
    typeof source.path !== "string" ||
    !GIT_OBJECT_ID.test(source.head) ||
    !GIT_OBJECT_ID.test(source.tree) ||
    !SHA256.test(source.statusSha256)
  ) {
    reject("MALFORMED_SOURCE_IDENTITY")
  }
  try {
    const head = execFileSync("git", ["-C", source.path, "rev-parse", "HEAD"], {
      encoding: "utf8",
      timeout: 5_000,
    }).trim()
    const status = execFileSync(
      "git",
      ["-C", source.path, "status", "--porcelain=v1", "--untracked-files=all"],
      { encoding: "utf8", timeout: 5_000 }
    )
    const tree = execFileSync(
      "git",
      ["-C", source.path, "rev-parse", "HEAD^{tree}"],
      { encoding: "utf8", timeout: 5_000 }
    ).trim()
    if (
      head !== source.head ||
      tree !== source.tree ||
      sha256Value(status) !== source.statusSha256 ||
      status !== ""
    ) {
      reject("DIRTY_SOURCE")
    }
  } catch {
    reject("DIRTY_SOURCE")
  }
}

function fixedReceipt(row, governedRoot) {
  exactKeys(
    row,
    ["stableId", "title", "sourceRowSha256", "status", "reason", "receipt"],
    "MALFORMED_ROW"
  )
  const receipt = record(row.receipt, "MALFORMED_RECEIPT")
  if ("logText" in receipt || "prompt" in receipt) reject("PROMPT_LIKE_LOG")
  exactKeys(
    receipt,
    [
      "assertions",
      "artifact",
      "attempt",
      "command",
      "exitCode",
      "outcome",
      "retryCount",
      "source",
      "totals",
    ],
    "MALFORMED_RECEIPT"
  )
  if (receipt.outcome === "hung" || receipt.outcome === "interrupted") {
    reject("INTERRUPTED_OR_HUNG_RECEIPT")
  }
  if (receipt.outcome !== "passed" || receipt.exitCode !== 0) {
    reject("FIXED_RECEIPT_NOT_PASSED")
  }
  if (receipt.attempt !== 1 || receipt.retryCount !== 0) {
    reject("RETRY_ONLY_GREEN")
  }
  if (typeof receipt.command !== "string" || receipt.command.length === 0) {
    reject("MALFORMED_RECEIPT")
  }
  // An assertion count cannot be recomputed from TAP, which records tests and
  // not `assert.*` calls, so its value is self-reported and deliberately not
  // execution authority. Its *type* still has to hold: leaving it unconstrained
  // admitted strings, negatives, fractions, null and objects alike.
  if (!Number.isInteger(receipt.assertions) || receipt.assertions < 0) {
    reject("MALFORMED_RECEIPT")
  }
  exactKeys(
    receipt.totals,
    ["failed", "passed", "skipped", "tests"],
    "MALFORMED_TOTALS"
  )
  const { tests, passed, failed, skipped } = receipt.totals
  if (
    !Number.isInteger(tests) ||
    !Number.isInteger(passed) ||
    !Number.isInteger(failed) ||
    !Number.isInteger(skipped)
  ) {
    reject("MALFORMED_TOTALS")
  }
  if (tests <= 0 || passed !== tests || failed !== 0 || skipped !== 0) {
    reject("MISLEADING_SUCCESS_OUTPUT")
  }
  exactKeys(receipt.artifact, ["path", "sha256"], "MALFORMED_RECEIPT")
  if (
    typeof receipt.artifact.path !== "string" ||
    !SHA256.test(receipt.artifact.sha256)
  ) {
    reject("MALFORMED_RECEIPT")
  }
  try {
    const stat = lstatSync(resolve(receipt.artifact.path))
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      sha256(receipt.artifact.path) !== receipt.artifact.sha256
    ) {
      reject("STALE_RECEIPT")
    }
  } catch {
    reject("STALE_RECEIPT")
  }
  const artifact = json(receipt.artifact.path, "OPAQUE_RECEIPT_ARTIFACT")
  exactKeys(
    artifact,
    [
      "assertions",
      "attempt",
      "candidate",
      "command",
      "exitCode",
      "outcome",
      "retryCount",
      "schema",
      "source",
      "totals",
    ],
    "OPAQUE_RECEIPT_ARTIFACT"
  )
  if (artifact.schema !== RECEIPT_SCHEMA) reject("OPAQUE_RECEIPT_ARTIFACT")
  if (!Number.isInteger(artifact.assertions) || artifact.assertions < 0) {
    reject("OPAQUE_RECEIPT_ARTIFACT")
  }
  exactKeys(
    artifact.candidate,
    ["sourceRowSha256", "stableId"],
    "OPAQUE_RECEIPT_ARTIFACT"
  )
  if (
    artifact.candidate.stableId !== row.stableId ||
    artifact.candidate.sourceRowSha256 !== row.sourceRowSha256 ||
    artifact.command !== receipt.command ||
    artifact.attempt !== receipt.attempt ||
    artifact.exitCode !== receipt.exitCode ||
    artifact.outcome !== receipt.outcome ||
    artifact.retryCount !== receipt.retryCount ||
    JSON.stringify(artifact.source) !== JSON.stringify(receipt.source) ||
    JSON.stringify(artifact.totals) !== JSON.stringify(receipt.totals)
  ) {
    reject("DIRECT_RECEIPT_MISMATCH")
  }
  cleanGitSource(record(artifact.source, "MALFORMED_SOURCE_IDENTITY"))
  validateExecutionEvidence(receipt, artifact, governedRoot)
}

function validate(map) {
  exactKeys(map, ["authority", "rows", "schema", "summary"], "MALFORMED_MAP")
  if (map.schema !== SCHEMA) reject("MALFORMED_MAP")
  const authority = verifyAuthority(
    record(map.authority, "MALFORMED_AUTHORITY")
  )
  const authorityRows = authority.rows
  const authorityById = new Map(authorityRows.map((row) => [row.stableId, row]))
  const rows = array(map.rows, "MALFORMED_ROWS")
  const ids = rows.map((row) => record(row, "MALFORMED_ROW").stableId)
  if (new Set(ids).size !== ids.length) reject("DUPLICATE_STABLE_ID")
  if (rows.length !== 65) reject("ROW_COUNT_MISMATCH")

  let fixed = 0
  let failed = 0
  let blocked = 0
  for (const row of rows) {
    const terminal = terminalRow(row, authorityById)
    if (terminal.status === "fixed") {
      fixed += 1
      fixedReceipt(terminal, authority.governedRoot)
    } else if (terminal.status === "failed") {
      failed += 1
    } else {
      blocked += 1
    }
  }
  if (authorityRows.some((row) => !new Set(ids).has(row.stableId))) {
    reject("MISSING_STABLE_ID")
  }
  exactKeys(
    map.summary,
    ["duplicates", "orphans", "owned", "terminal"],
    "MALFORMED_TOTALS"
  )
  const expectedSummary = { owned: 65, terminal: 65, duplicates: 0, orphans: 0 }
  if (JSON.stringify(map.summary) !== JSON.stringify(expectedSummary)) {
    reject("MALFORMED_TOTALS")
  }
  return { fixed, failed, blocked, open: failed + blocked }
}

function main() {
  const mapPath = process.argv[2]
  if (typeof mapPath !== "string" || process.argv.length !== 3) reject("USAGE")
  const summary = validate(json(mapPath, "MALFORMED_JSON"))
  process.stdout.write(
    `owned=65 terminal=65 duplicateIds=0 orphanIds=0 fixed=${summary.fixed} failed=${summary.failed} blocked=${summary.blocked} open=${summary.open}\n`
  )
  if (summary.failed > 0) reject("OPEN_EXECUTED_DEFECTS")
}

try {
  main()
} catch (error) {
  process.stderr.write(
    `${error instanceof ValidationError ? error.code : "MALFORMED_JSON"}\n`
  )
  process.exitCode = 2
}
