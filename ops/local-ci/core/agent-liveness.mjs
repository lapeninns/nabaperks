import { checkRunIdentityViolations } from "./app-identity.mjs"

export function agentLivenessConfig(contract) {
  const config = contract.agentLiveness
  if (
    config?.provider !== "github-check" ||
    config.gating !== false ||
    !/^[a-f0-9]{40}$/.test(config.anchorSha ?? "") ||
    typeof config.checkName !== "string" ||
    !config.checkName.trim() ||
    !Number.isSafeInteger(contract.githubApp?.appId) ||
    contract.githubApp.appId <= 0 ||
    !Number.isFinite(config.maxAgeMinutes) ||
    config.maxAgeMinutes <= 0
  )
    throw new Error("Invalid pinned GitHub agent-liveness configuration")
  return config
}

export function decideAgentLiveness({ runs, contract, now = Date.now() }) {
  const config = agentLivenessConfig(contract)
  if (!Array.isArray(runs) || !Number.isFinite(now))
    throw new Error("Invalid liveness response or clock")
  const trusted = runs.filter(
    (run) =>
      checkRunIdentityViolations(run, contract, {
        requestedSha: config.anchorSha,
        checkName: config.checkName,
      }).length === 0
  )
  const fresh = trusted.some((run) => {
    const completed = Date.parse(run.completed_at)
    return (
      run.status === "completed" &&
      run.conclusion === "success" &&
      Number.isFinite(completed) &&
      completed <= now + 60_000 &&
      now - completed <= config.maxAgeMinutes * 60_000
    )
  })
  return {
    fresh,
    reason: fresh
      ? "Agent heartbeat is fresh"
      : "No fresh successful heartbeat from the pinned App",
  }
}
