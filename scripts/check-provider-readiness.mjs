import { createReport, loadProjectEnv, printReport } from "./provider-readiness/runtime.mjs"
import { runReadinessChecks } from "./provider-readiness/checks.mjs"

const offline = new Set(process.argv.slice(2)).has("--offline")
const env = loadProjectEnv(process.cwd())
const report = createReport()

await runReadinessChecks({ env, offline, report })
printReport(report.results)

if (report.results.some((result) => result.status !== "PASS")) {
  console.error(
    `\nProvider readiness is not proven: ${report.results.filter((result) => result.status !== "PASS").length} gate(s) need evidence.`
  )
  process.exit(1)
}

console.log("\nProvider readiness checks passed.")
