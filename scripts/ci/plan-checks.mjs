import { appendFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { calculateImpact } from "./change-impact.mjs"
import { git, requireCommit } from "./impact-git.mjs"
import {
  expectedIdentity,
  fullPlan,
  validatePlan,
  FULL_WORKLOADS,
} from "./impact-plan-contract.mjs"

export function needsSelectionComparison(path) {
  return (
    path === ".github/workflows/ci.yml" ||
    ["config/ci-impact-policy.json", "config/ci-workloads.json"].includes(
      path
    ) ||
    /^scripts\/ci\/(impact-|change-impact|plan-checks|verify-impact|run-targeted|compare-targeted)/.test(
      path
    ) ||
    path === "playwright.config.ts" ||
    /^tests\/e2e\/(a11y|visual|helpers\/a11y)/.test(path) ||
    /^scripts\/ci\/(browser-|run-browser|run-bounded)/.test(path) ||
    path === "scripts/run-playwright.mjs" ||
    path.startsWith(".github/actions/playwright/")
  )
}

export function planChecks(env, { cwd } = {}) {
  const identity = expectedIdentity(env)
  for (const sha of [identity.baseSha, identity.headSha, identity.candidateSha])
    requireCommit(sha, cwd)
  const policySha =
    identity.event === "pull_request" ? identity.baseSha : identity.candidateSha
  if (git(["rev-parse", "HEAD"], { cwd }).trim() !== policySha)
    throw new Error("Selection must execute from the trusted policy revision")
  if (identity.event === "pull_request") {
    const parents = git(["show", "-s", "--format=%P", identity.candidateSha], {
      cwd,
    })
      .trim()
      .split(" ")
    if (
      parents.length !== 2 ||
      parents[0] !== identity.baseSha ||
      parents[1] !== identity.headSha
    )
      throw new Error(
        "Pull request merge candidate does not match its base and head"
      )
  }
  let impact
  try {
    impact = calculateImpact(identity.baseSha, identity.candidateSha, { cwd })
  } catch {
    return fullPlan(
      identity,
      "Change inventory unavailable; all checks remain required"
    )
  }
  const comparisonRequired = impact.changes.some((change) =>
    needsSelectionComparison(change.path)
  )
  let profile = impact.profile
  let reason = impact.reason
  if (identity.event === "push") {
    profile = "full"
    reason = "Exact-main release qualification always runs every workload"
  } else if (
    env.CI_HEAD_REPOSITORY !== identity.repository ||
    comparisonRequired
  ) {
    profile = "full"
    reason = comparisonRequired
      ? "CI selection changes require full and targeted comparison"
      : "Fork changes retain full hosted validation"
  }
  const plan = {
    schema: "nabaperks.ci-impact-plan.v1",
    identity,
    ...impact,
    profile,
    reason,
    comparisonRequired,
    pages: profile === "public-pages" ? impact.pages : [],
    required: profile === "full" ? [...FULL_WORKLOADS] : impact.required,
  }
  return validatePlan(plan, identity)
}

export function publishPlan(plan, env) {
  validatePlan(plan, expectedIdentity(env))
  const json = JSON.stringify(plan)
  if (env.GITHUB_OUTPUT)
    appendFileSync(
      env.GITHUB_OUTPUT,
      `plan=${json}\nprofile=${plan.profile}\ncomparison=${plan.comparisonRequired}\n`
    )
  if (env.GITHUB_STEP_SUMMARY)
    appendFileSync(
      env.GITHUB_STEP_SUMMARY,
      `### CI selection\n\nProfile: **${plan.profile}**. ${plan.reason}.\n\n` +
        `Candidate: \`${plan.identity.candidateSha}\`. Required: ${plan.required.map((name) => `\`${name}\``).join(", ")}.\n\n` +
        "Unselected checks are not required for this change; they have not passed. Main release qualification remains complete.\n"
    )
  return json
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    console.log(publishPlan(planChecks(process.env), process.env))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
