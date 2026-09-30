import { spawnSync } from "node:child_process"
import { appendFileSync, writeFileSync } from "node:fs"
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

export function runDependencyAudit({ spawn = spawnSync } = {}) {
  const result = spawn("pnpm", ["audit", "--json"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: 5 * 60_000,
  })
  if (result.error)
    return { state: "unavailable", reason: result.error.message }
  return classifyAudit({ status: result.status, stdout: result.stdout ?? "" })
}

const EXIT = { clean: 0, findings: 1, unavailable: 2 }

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
