import { spawnSync } from "node:child_process"
import { appendFileSync, readFileSync, writeFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

const SEVERITIES = ["critical", "high", "moderate", "low", "info"]

// Classifies `pnpm audit --json` output. The verdict is decided from the
// parsed report as well as the exit status: when the advisory endpoint is
// unreachable pnpm 10.28.0 prints `{"error": ...}` (and exits 1), which must be
// reported as an unavailable audit rather than as findings or as clean. The
// hosted fast lane previously passed --ignore-registry-errors, which turned an
// unreachable service into a pass.
export function classifyAudit({ status, stdout }) {
  let report
  try {
    report = JSON.parse(stdout)
  } catch {
    return { state: "unavailable", reason: "audit output is not JSON" }
  }
  if (report?.error)
    return {
      state: "unavailable",
      reason: String(report.error.code ?? report.error.message ?? "error"),
    }
  const counts = report?.metadata?.vulnerabilities
  if (
    !counts ||
    SEVERITIES.some(
      (severity) => !Number.isInteger(counts[severity]) || counts[severity] < 0
    )
  )
    return { state: "unavailable", reason: "audit report has no counts" }
  const total = SEVERITIES.reduce((sum, severity) => sum + counts[severity], 0)
  if (total === 0 && status !== 0)
    return { state: "unavailable", reason: `audit exited ${status}` }
  return {
    state: total === 0 ? "clean" : "findings",
    counts: Object.fromEntries(SEVERITIES.map((s) => [s, counts[s]])),
    dependencies: report.metadata.dependencies ?? null,
    advisories: Object.values(report.advisories ?? {})
      .map((advisory) => ({
        id: advisory.github_advisory_id ?? String(advisory.id ?? ""),
        module: advisory.module_name,
        severity: advisory.severity,
        title: advisory.title,
        url: advisory.url,
      }))
      .slice(0, 50),
  }
}

export const EXCEPTIONS_PATH = "config/dependency-audit-exceptions.json"
const MAX_EXCEPTION_DAYS = 90
const DATE = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 24 * 60 * 60 * 1000

// Reviewed exceptions live in the repository, not in pnpm's auditConfig:
// pnpm 10.28.0 drops an ignored advisory from `advisories` but keeps it in
// `metadata.vulnerabilities`, so the counts above cannot tell an ignored
// advisory from a live one. An invalid entry voids the whole file.
export function parseExceptions(json) {
  const exceptions = json?.exceptions
  if (!Array.isArray(exceptions)) throw new Error("exceptions is not a list")
  for (const entry of exceptions) {
    const fields = ["advisory", "module", "owner", "reason", "approved"]
    if (
      fields.some(
        (field) => typeof entry?.[field] !== "string" || !entry[field].trim()
      )
    )
      throw new Error(`exception is missing one of ${fields.join(", ")}`)
    if (!/^GHSA(-[23456789cfghjmpqrvwx]{4}){3}$/.test(entry.advisory))
      throw new Error(`${entry.advisory} is not a GitHub advisory id`)
    if (entry.scope !== "development")
      throw new Error(`${entry.advisory} must be scoped to development`)
    if (!DATE.test(entry.approved) || !DATE.test(entry.reviewBy ?? ""))
      throw new Error(`${entry.advisory} needs ISO approved and reviewBy dates`)
    const days =
      (Date.parse(entry.reviewBy) - Date.parse(entry.approved)) / DAY_MS
    if (!(days >= 0 && days <= MAX_EXCEPTION_DAYS))
      throw new Error(
        `${entry.advisory} review is more than ${MAX_EXCEPTION_DAYS} days away`
      )
  }
  return exceptions
}

const tally = (advisories) =>
  Object.fromEntries(
    SEVERITIES.map((s) => [
      s,
      advisories.filter((a) => a.severity === s).length,
    ])
  )

// An exception applies only from its approval date until its review date and while
// the module is still unreachable from production dependencies. pnpm's counts
// still include excepted advisories, so they are subtracted only when the
// advisory list accounts for every counted finding; otherwise the verdict
// stays as findings.
export function applyExceptions(
  verdict,
  { exceptions, today, isProductionReachable }
) {
  if (verdict.state !== "findings") return verdict
  const covering = (advisory) =>
    exceptions.find(
      (e) =>
        e.advisory === advisory.id &&
        e.module === advisory.module &&
        e.approved <= today &&
        today <= e.reviewBy &&
        !isProductionReachable(advisory.module)
    )
  const excepted = verdict.advisories
    .map((advisory) => ({ advisory, exception: covering(advisory) }))
    .filter(({ exception }) => exception)
  if (excepted.length === 0) return verdict
  const counted = tally(verdict.advisories)
  if (SEVERITIES.some((s) => counted[s] !== verdict.counts[s]))
    return {
      ...verdict,
      exceptionsNotApplied: "severity counts do not match the advisory list",
    }
  const remaining = verdict.advisories.filter(
    (a) => !excepted.some(({ advisory }) => advisory === a)
  )
  return {
    ...verdict,
    state: remaining.length === 0 ? "excepted" : "findings",
    counts: tally(remaining),
    advisories: remaining,
    excepted: excepted.map(({ advisory, exception }) => ({
      ...advisory,
      owner: exception.owner,
      reviewBy: exception.reviewBy,
    })),
  }
}

// Any failure to prove a module is development-only counts as reachable.
export function productionReachability({ spawn = spawnSync } = {}) {
  const cache = new Map()
  return (module) => {
    if (!cache.has(module)) {
      const result = spawn("pnpm", ["why", module, "--prod", "--json"], {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        timeout: 2 * 60_000,
      })
      let reachable = true
      try {
        if (!result.error && result.status === 0)
          reachable = JSON.parse(result.stdout).some(
            (root) =>
              Object.keys(root.dependencies ?? {}).length > 0 ||
              Object.keys(root.optionalDependencies ?? {}).length > 0
          )
      } catch {}
      cache.set(module, reachable)
    }
    return cache.get(module)
  }
}

export function runDependencyAudit({
  spawn = spawnSync,
  readExceptions = () => JSON.parse(readFileSync(EXCEPTIONS_PATH, "utf8")),
  today = new Date().toISOString().slice(0, 10),
} = {}) {
  let exceptions
  try {
    exceptions = parseExceptions(readExceptions())
  } catch (error) {
    return { state: "unavailable", reason: `exceptions: ${error.message}` }
  }
  const result = spawn("pnpm", ["audit", "--json"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: 5 * 60_000,
  })
  if (result.error)
    return { state: "unavailable", reason: result.error.message }
  const verdict = classifyAudit({
    status: result.status,
    stdout: result.stdout ?? "",
  })
  return applyExceptions(verdict, {
    exceptions,
    today,
    isProductionReachable: productionReachability({ spawn }),
  })
}

const EXIT = { clean: 0, excepted: 0, findings: 1, unavailable: 2 }

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const verdict = runDependencyAudit()
  const [output] = process.argv.slice(2)
  if (output) writeFileSync(output, JSON.stringify(verdict, null, 2) + "\n")
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, `state=${verdict.state}\n`)
  console.log(JSON.stringify(verdict, null, 2))
  process.exitCode = EXIT[verdict.state] ?? 2
}
