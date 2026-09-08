import { selectDeploymentMetadata } from "./project-metadata.mjs"

export function collectDeploymentObservation(contract, read) {
  const checkedAt = new Date().toISOString()
  const since = new Date(
    Date.parse(checkedAt) - 24 * 60 * 60 * 1000
  ).toISOString()
  const deployments = []
  const seen = new Set()
  let until
  for (let page = 0; page < 100; page++) {
    const params = new URLSearchParams({
      projectId: contract.project.id,
      limit: "100",
      since: String(Date.parse(since)),
    })
    if (until) params.set("until", String(until))
    const result = read([
      "api",
      `/v6/deployments?${params}`,
      "--scope",
      contract.scope,
      "--raw",
    ])
    if (
      !Array.isArray(result?.deployments) ||
      !result.pagination ||
      !(
        result.pagination.next === null ||
        (Number.isSafeInteger(result.pagination.next) &&
          result.pagination.next > 0)
      )
    )
      throw new Error("Incomplete deployment-list response")
    for (const raw of result.deployments) {
      if (
        !raw ||
        typeof (raw.uid ?? raw.id) !== "string" ||
        !(raw.uid ?? raw.id).length ||
        typeof raw.source !== "string" ||
        !Number.isFinite(raw.created)
      )
        throw new Error("Invalid deployment evidence")
      const entry = selectDeploymentMetadata(raw)
      if (!seen.has(entry.id)) {
        seen.add(entry.id)
        deployments.push(entry)
      }
    }
    if (result.pagination.next === null)
      return { checkedAt, since, complete: true, deployments }
    if (until && result.pagination.next >= until)
      throw new Error("Deployment pagination did not advance")
    until = result.pagination.next
  }
  throw new Error("Deployment observation exceeded its pagination bound")
}
