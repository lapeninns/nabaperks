import { readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { readJournal } from "../../ops/factory/journal.mjs"
import { pathToFileURL } from "node:url"
import {
  githubJson,
  githubPages,
  collectPullRequest,
  collectReleases,
} from "../../ops/factory/github.mjs"
import {
  evaluatePullRequest,
  evaluateRelease,
} from "../../ops/factory/state.mjs"
import { renderFactoryReport } from "../../ops/factory/report.mjs"

export const factoryPolicy = JSON.parse(
  readFileSync(
    new URL("../../config/software-factory.json", import.meta.url),
    "utf8"
  )
)

export function collectFactoryStatus({
  policy = factoryPolicy,
  read = githubJson,
  journal = { pullRequests: {} },
  now = Date.now(),
} = {}) {
  if (
    policy.repository !== "lapeninns/nabaperks" ||
    policy.schema !== "nabaperks.software-factory.v1"
  )
    throw new Error("Unrecognised factory policy")
  const main = read([
    "api",
    `repos/${policy.repository}/commits/${policy.baseBranch}`,
    "--jq",
    "{sha}",
  ])
  const prs = githubPages(
    `repos/${policy.repository}/pulls?state=open&base=${policy.baseBranch}&per_page=100`,
    read
  ).flat()
  const items = []
  for (const pr of prs) {
    try {
      const record = journal.pullRequests[pr.number]
      const evidence = collectPullRequest(pr.number, policy, {
        read,
        repairCycles: record?.repairCycles ?? 0,
      })
      evidence.reviewRequestedAt =
        record?.reviews?.[evidence.headSha]?.requestedAt
      items.push(evaluatePullRequest(evidence, policy, now))
    } catch {
      items.push({
        kind: "pull-request",
        number: pr.number,
        sha: pr.head.sha,
        state: "unknown",
        owner: "coordinator",
        action: "refresh-evidence",
        reason:
          "Evidence collection failed or the candidate changed; retry before acting.",
      })
    }
  }
  for (const release of collectReleases(policy, read))
    items.push(evaluateRelease(release, main.sha, policy, now))
  return {
    schema: "nabaperks.factory-status.v1",
    checkedAt: new Date(now).toISOString(),
    mainSha: main.sha,
    items,
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const args = process.argv.slice(2).filter((arg) => arg !== "--")
    if (args.some((arg) => !["--json", "--summary"].includes(arg)))
      throw new Error("Usage: factory-status.mjs [--json] [--summary]")
    const snapshot = collectFactoryStatus({
      journal: readJournal(
        join(homedir(), ".local", "state", "nabaperks-factory")
      ),
    })
    const markdown = renderFactoryReport(snapshot)
    console.log(
      args.includes("--json") ? JSON.stringify(snapshot, null, 2) : markdown
    )
    if (args.includes("--summary")) {
      if (!process.env.GITHUB_STEP_SUMMARY)
        throw new Error("GitHub step summary path is unavailable")
      writeFileSync(process.env.GITHUB_STEP_SUMMARY, markdown, { flag: "a" })
    }
    if (snapshot.items.some((item) => item.state === "unknown"))
      process.exitCode = 1
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
