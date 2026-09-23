const MONITORS = Object.freeze({
  heartbeat: "Local CI agent heartbeat cannot be verified",
  publicHealth: "Public production health probe failed",
  nightly: "Nightly QA hardening failed",
  mutation: "Weekly mutation testing failed",
})

// Where each incident's observations come from and what an operator follows.
// Every observer reports all monitors; the ones it does not watch are `null`.
const LOCAL_CI_GUIDE = Object.freeze({
  workflow: "agent-watchdog.yml",
  guidance:
    "This issue remains open while the outage persists and closes after a healthy observation. Repeated failures do not add comments. The agent heartbeat measures polling, not successful CI execution; intentional Mac sleep also stops heartbeats. GitHub scheduling or outages can delay detection.",
  runbook: "docs/operations/local-ci-watchdog.md",
})
const GUIDES = Object.freeze({
  heartbeat: LOCAL_CI_GUIDE,
  publicHealth: LOCAL_CI_GUIDE,
  nightly: Object.freeze({
    workflow: "nightly.yml",
    guidance:
      "Nightly QA hardening is advisory and blocks no merge or release. This issue covers the cross-browser gate, the k6 load checks and the ZAP full scan. It remains open while any of them fails and closes on the first scheduled or dispatched run in which all three succeed. Repeated failures do not add comments, and a superseded (cancelled) run is not an observation.",
    runbook: "docs/operations/nightly.md",
  }),
  mutation: Object.freeze({
    workflow: "nightly.yml",
    guidance:
      "Mutation testing runs in the Monday nightly run and on manual dispatch. This issue remains open while it fails and closes on the next run in which it succeeds. Runs that skip mutation testing neither open nor close it, and repeated failures do not add comments.",
    runbook: "docs/operations/nightly.md",
  }),
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
    if (typeof healthy[kind] !== "boolean" && healthy[kind] !== null)
      throw new Error("Every watchdog observation is required")
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
    // `null` is "nobody looked", which is neither health nor an outage. A
    // deliberately paused agent must not open an incident, and it must not
    // close a standing one either - closing would assert a recovery no
    // observation supports. Say so instead, and leave whatever is open alone.
    if (healthy[kind] === null) {
      results.push({
        monitor: kind,
        state: "not monitored",
        action: "none",
        ...(incidents.length ? { issue: incidents[0].number } : {}),
      })
    } else if (healthy[kind]) {
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
        body: `${marker(kind)}\n\n${MONITORS[kind]}.\n\nFirst observed: ${runUrl}\nLatest observations: https://github.com/${owner}/${repo}/actions/workflows/${GUIDES[kind].workflow}\n\n${GUIDES[kind].guidance}\n\nFollow ${GUIDES[kind].runbook}.`,
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
