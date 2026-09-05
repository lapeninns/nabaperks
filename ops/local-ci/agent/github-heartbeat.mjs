import { agentLivenessConfig } from "../core/agent-liveness.mjs"
import { shouldSendHeartbeat } from "./heartbeat.mjs"

// One run per process lifetime, updated at each cadence. The fixed merged
// anchor survives main advancing and never attaches an extra check to PRs.
export function createGitHubHeartbeat({
  github,
  contract,
  now = () => Date.now(),
  logger = null,
}) {
  const config = agentLivenessConfig(contract)
  let checkId = null
  let lastSentAt = null
  return Object.freeze({
    enabled: true,
    async ping() {
      const instant = now()
      if (!shouldSendHeartbeat({ lastSentAt, now: instant, contract }))
        return { sent: false, reason: "not due yet" }
      try {
        const completedAt = new Date(instant).toISOString()
        const fields = {
          status: "completed",
          conclusion: "success",
          completedAt,
          output: {
            title: "Agent poll loop is alive",
            summary:
              "This heartbeat proves polling only, not successful CI jobs or VM readiness.",
          },
        }
        if (checkId === null) {
          const run = await github.createCheckRun({
            ...fields,
            name: config.checkName,
            headSha: config.anchorSha,
            startedAt: completedAt,
          })
          if (!Number.isSafeInteger(run.id) || run.id <= 0)
            throw new Error("Invalid check response")
          checkId = run.id
        } else {
          await github.updateCheckRun(checkId, fields)
        }
        lastSentAt = instant
        return { sent: true, reason: "ok" }
      } catch {
        // The error may contain provider credentials. Log only our message.
        logger?.warn?.(
          "GitHub heartbeat publication failed; watchdog will observe stale evidence"
        )
        checkId = null
        return { sent: false, reason: "GitHub heartbeat publication failed" }
      }
    },
  })
}
