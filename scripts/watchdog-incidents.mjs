const MONITORS = Object.freeze({
  heartbeat: "Local CI agent heartbeat cannot be verified",
  publicHealth: "Public production health probe failed",
})

function marker(kind) {
  return `<!-- nabaperks-watchdog:${kind}:v1 -->`
}

function isOurIncident(issue, kind) {
  return (
    !issue.pull_request &&
    issue.user?.login === "github-actions[bot]" &&
    issue.user?.type === "Bot" &&
    issue.title === `[Watchdog] ${MONITORS[kind]}` &&
    typeof issue.body === "string" &&
    issue.body.includes(marker(kind))
  )
}

// The workflow is a successful observer even when a monitored component is
// down. Its summary and incident state carry that distinction explicitly.
// Only outage transitions write: repeated failed observations stay quiet.
export async function reconcileWatchdogIncidents({
  github,
  repository,
  healthy,
  runUrl,
  assignee,
}) {
  const { owner, repo } = repository
  if (
    typeof owner !== "string" ||
    typeof repo !== "string" ||
    typeof assignee !== "string" ||
    !/^[A-Za-z0-9-]+$/.test(owner) ||
    !/^[A-Za-z0-9_.-]+$/.test(repo) ||
    !/^[A-Za-z0-9-]+$/.test(assignee)
  )
    throw new Error("Invalid watchdog repository or assignee")
  const url = new URL(runUrl)
  if (
    url.origin !== "https://github.com" ||
    !url.pathname.startsWith(`/${owner}/${repo}/actions/runs/`) ||
    !/^[0-9]+$/.test(url.pathname.split("/").at(-1)) ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error("Invalid watchdog run URL")
  }
  for (const kind of Object.keys(MONITORS)) {
    if (typeof healthy[kind] !== "boolean")
      throw new Error("Both watchdog observations are required")
  }
  const open = []
  for (let page = 1; page <= 10; page += 1) {
    const { data } = await github.rest.issues.listForRepo({
      owner,
      repo,
      state: "open",
      per_page: 100,
      page,
    })
    if (!Array.isArray(data)) throw new Error("Invalid incident listing")
    open.push(...data)
    if (data.length < 100) break
    if (page === 10)
      throw new Error("Incident scan limit reached; refusing duplicate alerts")
  }
  const results = []
  for (const kind of Object.keys(MONITORS)) {
    const incidents = open.filter((issue) => isOurIncident(issue, kind))
    if (healthy[kind]) {
      for (const issue of incidents) {
        await github.rest.issues.update({
          owner,
          repo,
          issue_number: issue.number,
          state: "closed",
          state_reason: "completed",
          body: `${issue.body}\n\nRecovery observed: ${runUrl}`,
        })
      }
      results.push({
        monitor: kind,
        state: "healthy",
        action: incidents.length ? "closed" : "none",
      })
    } else if (incidents.length) {
      results.push({
        monitor: kind,
        state: "attention",
        action: "unchanged",
        issue: incidents[0].number,
      })
    } else {
      const { data } = await github.rest.issues.create({
        owner,
        repo,
        title: `[Watchdog] ${MONITORS[kind]}`,
        assignees: [assignee],
        body: `${marker(kind)}\n\n${MONITORS[kind]}.\n\nFirst observed: ${runUrl}\nLatest observations: https://github.com/${owner}/${repo}/actions/workflows/agent-watchdog.yml\n\nThis issue remains open while the outage persists and closes after a healthy observation. Repeated failures do not add comments. The agent heartbeat measures polling, not successful CI execution; intentional Mac sleep also stops heartbeats. GitHub scheduling or outages can delay detection.\n\nFollow docs/operations/local-ci-watchdog.md.`,
      })
      results.push({
        monitor: kind,
        state: "attention",
        action: "opened",
        issue: data.number,
      })
    }
  }
  return results
}
