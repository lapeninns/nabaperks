import { spawnSync } from "node:child_process"
import { bindWorkflowChecks } from "./workflow-checks.mjs"
import { reviewSummaryCommit } from "./review-summary.mjs"

export function githubJson(args) {
  const result = spawnSync("gh", args, {
    encoding: "utf8",
    timeout: 60_000,
    maxBuffer: 32 * 1024 * 1024,
  })
  // Never echo arbitrary provider errors, review bodies or credential material.
  if (result.error || result.signal || result.status !== 0)
    throw new Error(
      "GitHub metadata request failed; check authentication and provider availability."
    )
  const parsed = JSON.parse(result.stdout)
  if (parsed?.errors?.length)
    throw new Error("GitHub returned incomplete GraphQL evidence.")
  return parsed
}

export function githubPages(path, read = githubJson) {
  const pages = read(["api", "--paginate", "--slurp", path])
  if (!Array.isArray(pages))
    throw new Error("Expected paginated GitHub response")
  return pages
}

export function collectPullRequest(
  number,
  policy,
  { read = githubJson, repairCycles = 0 } = {}
) {
  if (!Number.isSafeInteger(number) || number < 1)
    throw new Error("Invalid PR number")
  const repo = policy.repository
  const pr = read([
    "pr",
    "view",
    String(number),
    "--repo",
    repo,
    "--json",
    "number,url,state,headRefOid,headRepository,headRepositoryOwner,isDraft,reviewDecision,mergeStateStatus",
  ])
  const raw = read(["api", `repos/${repo}/pulls/${number}`])
  if (raw.head.sha !== pr.headRefOid)
    throw new Error("PR changed during collection; retry")
  const candidateSha = raw.merge_commit_sha
  const reviews = githubPages(
    `repos/${repo}/pulls/${number}/reviews?per_page=100`,
    read
  ).flat()
  const coverageReviews = reviews.map((entry) => ({
    id: entry.id,
    userId: entry.user.id,
    login: entry.user.login,
    state: entry.state,
    sha: entry.commit_id,
  }))
  if (
    !coverageReviews.some(
      (entry) =>
        entry.userId === policy.reviewer.userId &&
        entry.sha === pr.headRefOid &&
        ["COMMENTED", "APPROVED", "CHANGES_REQUESTED"].includes(entry.state)
    )
  ) {
    const comments = githubPages(
      `repos/${repo}/issues/${number}/comments?per_page=100`,
      read
    ).flat()
    for (const comment of comments) {
      const shortSha = reviewSummaryCommit(comment, policy.reviewer)
      if (!shortSha) continue
      const resolved = read([
        "api",
        `repos/${repo}/commits/${shortSha}`,
        "--jq",
        "{sha}",
      ])
      if (resolved.sha === pr.headRefOid)
        coverageReviews.push({
          id: comment.id,
          userId: comment.user.id,
          login: comment.user.login,
          state: "COMMENTED",
          sha: resolved.sha,
          source: "completed-bot-summary",
        })
    }
  }
  const checks = candidateSha
    ? githubPages(
        `repos/${repo}/commits/${pr.headRefOid}/check-runs?per_page=100&filter=latest`,
        read
      ).flatMap((page) => page.check_runs ?? [])
    : []
  const boundChecks = bindWorkflowChecks(checks, {
    policy,
    number,
    headSha: pr.headRefOid,
    baseSha: raw.base.sha,
    read,
  })
  const [owner, name] = repo.split("/")
  const query = `query($owner:String!,$name:String!,$number:Int!,$endCursor:String){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:100,after:$endCursor){nodes{isResolved} pageInfo{hasNextPage endCursor}}}}}`
  const threads = read([
    "api",
    "graphql",
    "--paginate",
    "--slurp",
    "-f",
    `query=${query}`,
    "-f",
    `owner=${owner}`,
    "-f",
    `name=${name}`,
    "-F",
    `number=${number}`,
  ])
  if (
    !Array.isArray(threads) ||
    !threads.length ||
    threads.some(
      (page) =>
        page.errors || !page.data?.repository?.pullRequest?.reviewThreads
    )
  )
    throw new Error("Review-thread evidence incomplete")
  const headCommit = read(["api", `repos/${repo}/commits/${pr.headRefOid}`])
  const finalHead = read([
    "api",
    `repos/${repo}/pulls/${number}`,
    "--jq",
    "{sha:.head.sha,base:.base.sha,merge:.merge_commit_sha}",
  ])
  if (
    finalHead.sha !== pr.headRefOid ||
    finalHead.base !== raw.base.sha ||
    finalHead.merge !== candidateSha
  )
    throw new Error("PR candidate changed during collection; retry")
  return {
    number,
    url: pr.url,
    state: pr.state,
    headSha: pr.headRefOid,
    candidateSha,
    baseSha: raw.base.sha,
    headRepository: raw.head.repo?.full_name,
    isDraft: pr.isDraft,
    reviewDecision: pr.reviewDecision,
    mergeStateStatus: pr.mergeStateStatus,
    headCommittedAt: headCommit.commit.committer.date,
    repairCycles,
    complete:
      threads.at(-1).data.repository.pullRequest.reviewThreads.pageInfo
        .hasNextPage === false,
    unresolvedThreads: threads
      .flatMap((page) => page.data.repository.pullRequest.reviewThreads.nodes)
      .filter((thread) => !thread.isResolved).length,
    reviews: coverageReviews,
    checks: boundChecks,
  }
}

export function collectReleases(policy, read = githubJson) {
  // Fetch each active status separately so historical completed runs cannot
  // hide an old approval wait holding the shared release concurrency group.
  const runs = new Map()
  for (const status of [
    "waiting",
    "pending",
    "queued",
    "in_progress",
    "requested",
  ]) {
    for (const page of githubPages(
      `repos/${policy.repository}/actions/workflows/${policy.releaseWorkflow}/runs?status=${status}&per_page=100`,
      read
    ))
      for (const run of page.workflow_runs ?? []) runs.set(run.id, run)
  }
  const latest = read([
    "api",
    `repos/${policy.repository}/actions/workflows/${policy.releaseWorkflow}/runs?per_page=1`,
  ])
  for (const run of latest.workflow_runs ?? []) runs.set(run.id, run)
  return [...runs.values()].map((run) => {
    const environments =
      run.status === "completed"
        ? []
        : read([
            "api",
            `repos/${policy.repository}/actions/runs/${run.id}/pending_deployments`,
          ])
    return {
      id: run.id,
      sha: run.head_sha,
      url: run.html_url,
      createdAt: run.created_at,
      status: run.status,
      conclusion: run.conclusion,
      complete: true,
      environments: environments.map((entry) => ({
        name: entry.environment.name,
        reviewers: entry.reviewers.map(
          ({ reviewer }) =>
            reviewer.login ?? reviewer.slug ?? "eligible reviewer"
        ),
      })),
    }
  })
}
