import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { loadContract } from "../ops/local-ci/core/contract.mjs"
import {
  agentLivenessConfig,
  decideAgentLiveness,
} from "../ops/local-ci/core/agent-liveness.mjs"
import { requireRepositoryFullName } from "../ops/local-ci/agent/github.mjs"

export async function checkAgentLiveness({
  contract,
  token,
  fetchImpl = fetch,
  now = Date.now(),
}) {
  const config = agentLivenessConfig(contract)
  const repository = requireRepositoryFullName(contract.repository).fullName
  if (!token) throw new Error("GITHUB_TOKEN is required")
  const runs = []
  // Bound provider work. Runs are newest-first; a page limit fails closed.
  for (let page = 1; page <= 10; page += 1) {
    const url = new URL(
      `https://api.github.com/repos/${repository}/commits/${config.anchorSha}/check-runs`
    )
    url.search = new URLSearchParams({
      check_name: config.checkName,
      filter: "all",
      per_page: "100",
      page: String(page),
    }).toString()
    const response = await fetchImpl(url, {
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
      },
    })
    if (!response.ok)
      throw new Error(`Heartbeat read failed (HTTP ${response.status})`)
    const payload = await response.json()
    if (!Array.isArray(payload.check_runs))
      throw new Error("Invalid heartbeat response")
    runs.push(...payload.check_runs)
    const decision = decideAgentLiveness({ runs, contract, now })
    if (decision.fresh || payload.check_runs.length < 100) return decision
  }
  return {
    fresh: false,
    reason: "Heartbeat scan limit reached without fresh trusted evidence",
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const result = await checkAgentLiveness({
      contract: loadContract((path) => readFileSync(path, "utf8")),
      token: process.env.GITHUB_TOKEN,
    })
    console.log(result.reason)
    process.exitCode = result.fresh ? 0 : 1
  } catch {
    console.error(
      "Unable to verify agent heartbeat; inspect GitHub availability and pinned configuration"
    )
    process.exitCode = 1
  }
}
