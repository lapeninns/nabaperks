#!/usr/bin/env node
/**
 * Copy-paste gate with a non-vacuity floor.
 *
 * `jscpd app components lib --config jscpd.json` is a filter over a path list,
 * and it reports success when the filter keeps nothing: pointed at directories
 * that do not exist it prints "Found 0 clones", analyses 0 files and exits 0.
 * That is the `bundle:check` failure — a budget enforced on 0 of 150 routes —
 * and it is the reason this wrapper exists rather than the bare binary.
 *
 * jscpd itself still owns the verdict (threshold 4% in jscpd.json); this only
 * refuses to believe a pass that measured nothing. 808 sources / 108,568 lines
 * are analysed today, so the floors sit well below ordinary churn.
 *
 * Run: node scripts/check-duplicates.mjs   (pnpm duplicates:check)
 */
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync, rmSync } from "node:fs"
import { join } from "node:path"

const REPORT = join(process.cwd(), "reports/jscpd/jscpd-report.json")
const MIN_SOURCES = 500
const MIN_LINES = 50_000

// A stale report from an earlier run must not be able to vouch for this one.
if (existsSync(REPORT)) rmSync(REPORT)

const jscpd = spawnSync(
  "pnpm",
  ["exec", "jscpd", "app", "components", "lib", "--config", "jscpd.json"],
  { stdio: "inherit" }
)

if (jscpd.status !== 0) {
  process.exit(jscpd.status ?? 1)
}

if (!existsSync(REPORT)) {
  console.error(
    `jscpd exited 0 but wrote no report at ${REPORT}. The reporter or the output ` +
      "path in jscpd.json has changed, so the duplication gate cannot be verified."
  )
  process.exit(1)
}

const { statistics } = JSON.parse(readFileSync(REPORT, "utf8"))
const total = statistics?.total ?? {}
const sources = total.sources ?? 0
const lines = total.lines ?? 0

if (sources < MIN_SOURCES || lines < MIN_LINES) {
  console.error(
    `\u2717 jscpd analysed ${sources} source(s) / ${lines} line(s), floors ` +
      `${MIN_SOURCES}/${MIN_LINES}. The scan paths or the pattern in jscpd.json no ` +
      "longer select this codebase, so a pass here means nothing."
  )
  process.exit(1)
}

console.log(
  `\u2713 duplication within budget: ${total.clones ?? 0} clone(s), ` +
    `${(total.percentage ?? 0).toFixed(2)}% of ${lines} line(s) across ${sources} source(s)`
)
