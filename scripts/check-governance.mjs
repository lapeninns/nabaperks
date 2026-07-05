#!/usr/bin/env node
import { appendFileSync } from "node:fs"

import { validateGovernance } from "./governance-rules.mjs"

const result = validateGovernance(process.cwd())

writeStepSummary(result)

if (!result.ok) {
  console.error("Governance check failed:")
  for (const failure of result.failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log(
  `Governance check passed: ${result.specs.length} Micro-Spec file(s), ${result.ciCommands.length} CI command(s), ${result.changedFiles.length} changed file(s).`
)

// GitHub Actions audit trail: a human-readable verdict on the run page.
// Every interpolated value is escaped — spec ids and file paths are
// author-controlled input and must not be able to inject markdown.
function writeStepSummary(validation) {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY
  if (!summaryFile) return

  const byStatus = new Map()
  for (const spec of validation.specs) {
    const status = spec.metadata.status ?? "unparsed"
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1)
  }

  const lines = [
    "## Governance check",
    "",
    validation.ok ? "**PASSED**" : `**FAILED** — ${validation.failures.length} issue(s)`,
    "",
    "| | |",
    "| --- | --- |",
    `| Specs | ${mdCell([...byStatus.entries()].map(([k, v]) => `${k}: ${v}`).join(", ") || "none")} |`,
    `| CI gate commands | ${validation.ciCommands.length} |`,
    `| Changed files checked | ${validation.changedFiles.length} |`,
    "",
  ]

  if (!validation.ok) {
    lines.push("### Failures", "")
    for (const failure of validation.failures) {
      lines.push(`- ${mdCell(failure)}`)
    }
    lines.push("")
  }

  const waivered = validation.specs.filter(
    (spec) => (spec.metadata.approved_exceptions ?? []).length > 0
  )
  if (waivered.length > 0) {
    lines.push("### Specs carrying approved exceptions", "")
    for (const spec of waivered) {
      for (const exception of spec.metadata.approved_exceptions) {
        lines.push(`- ${mdCell(spec.metadata.spec_id ?? spec.file)}: ${mdCell(exception)}`)
      }
    }
    lines.push("")
  }

  try {
    appendFileSync(summaryFile, `${lines.join("\n")}\n`)
  } catch {
    // The summary is best-effort; never fail the check over it.
  }
}

function mdCell(value) {
  return String(value)
    .replace(/\|/g, "\\|")
    .replace(/`/g, "'")
    .replace(/\r?\n/g, " ")
}
