// GitHub attaches Actions checks to the PR head. Its run.pull_requests array
// is mutable, so use the run's fixed display title to bind the event's base.
export function bindWorkflowChecks(
  checks,
  { policy, number, headSha, baseSha, read }
) {
  const runs = new Map()
  return checks
    .filter((check) =>
      policy.requiredChecks.some(
        (expected) =>
          expected.name === check.name && expected.appId === check.app?.id
      )
    )
    .map((check) => {
      const expected = policy.requiredChecks.find(
        (entry) => entry.name === check.name && entry.appId === check.app?.id
      )
      let workflowBound = false
      const prefix = `https://github.com/${policy.repository}/actions/runs/`
      const suffix = check.details_url?.startsWith(prefix)
        ? check.details_url.slice(prefix.length)
        : ""
      const match = /^(\d+)\/job\/(\d+)$/.exec(suffix)
      if (
        match &&
        Number(match[2]) === check.id &&
        check.head_sha === headSha &&
        /^[a-f0-9]{40}$/.test(baseSha ?? "")
      ) {
        const runId = Number(match[1])
        if (!runs.has(runId))
          runs.set(
            runId,
            read(["api", `repos/${policy.repository}/actions/runs/${runId}`])
          )
        const run = runs.get(runId)
        workflowBound =
          run.id === runId &&
          run.repository?.full_name === policy.repository &&
          run.event === "pull_request" &&
          run.head_sha === headSha &&
          run.check_suite_id === check.check_suite?.id &&
          run.path === expected.workflowPath &&
          run.display_title ===
            `${expected.workflowName} head:${headSha} base:${baseSha}` &&
          run.pull_requests?.some((pr) => pr.number === number) === true
      }
      return {
        id: check.id,
        name: check.name,
        appId: check.app.id,
        sha: check.head_sha,
        baseSha: workflowBound ? baseSha : null,
        status: check.status,
        conclusion: check.conclusion,
        workflowBound,
      }
    })
}
