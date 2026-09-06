import { appendFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

// These are workload roots, not optional summaries or local shadow checks.
// Matrix results represent every shard; a failed or skipped root is not proof.
export const REQUIRED_HOSTED_JOBS = Object.freeze([
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

export function verifyRequiredEvidence(evidence) {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    throw new Error("Required evidence must be a GitHub needs object")
  }
  const expected = new Set(REQUIRED_HOSTED_JOBS)
  const unexpected = Object.keys(evidence).filter((job) => !expected.has(job))
  const failures = REQUIRED_HOSTED_JOBS.filter(
    (job) =>
      !Object.hasOwn(evidence, job) || evidence[job]?.result !== "success"
  )
  if (unexpected.length || failures.length) {
    throw new Error(
      `Incomplete hosted proof: non-success or missing [${failures.join(", ")}]; unexpected dependencies [${unexpected.join(", ")}]`
    )
  }
  return REQUIRED_HOSTED_JOBS.map((job) => `${job}: success`).join("\n")
}

export function runRequiredEvidenceCheck(env = process.env) {
  const summary = verifyRequiredEvidence(
    JSON.parse(env.CI_REQUIRED_EVIDENCE || "null")
  )
  if (env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      env.GITHUB_STEP_SUMMARY,
      `### Complete hosted validation\n\n\`\`\`text\n${summary}\n\`\`\`\n`
    )
  }
  return summary
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    console.log(runRequiredEvidenceCheck())
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
