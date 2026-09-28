/** Recover an ambiguous check creation using a durable attempt identity. */
import { checkRunIdentityViolations } from "../core/app-identity.mjs"
import {
  TITLE_MAX_LENGTH,
  assertPublishable,
  escapeCell,
  formatDuration,
  redactSummaryText,
} from "../core/summary.mjs"

export async function publishDurableCheck({
  github,
  contract,
  journal,
  attempt,
  payload,
  stillOwned = () => true,
}) {
  const name =
    attempt.profile === "nightly"
      ? contract.nightlyCheckName
      : contract.checkName
  const externalId = `nabaperks-attempt:${attempt.id}`
  let current = journal.entries.find((entry) => entry.id === attempt.id)
  if (!stillOwned()) return false
  if (current.checkRunId === null && current.creationAttempted) {
    const checks = await github.getCheckRunsForRef(attempt.sha, {
      checkName: name,
      filter: "all",
    })
    if (!stillOwned()) return false
    const matches = checks.filter((check) => check.external_id === externalId)
    if (
      matches.length !== 1 ||
      checkRunIdentityViolations(matches[0], contract, {
        requestedSha: attempt.sha,
        checkName: name,
      }).length
    )
      throw new Error("Ambiguous local CI check creation remains unreconciled")
    journal.attachCheck(attempt.id, matches[0].id)
    current = journal.entries.find((entry) => entry.id === attempt.id)
  }
  if (current.checkRunId !== null) {
    await github.updateCheckRun(current.checkRunId, payload)
    return stillOwned()
  }
  // This write precedes the only POST. A timeout, lost response or crash must
  // reconcile the provider result; absence is not permission to post again.
  journal.markCreationAttempted(attempt.id)
  const created = await github.createCheckRun({
    name,
    headSha: attempt.sha,
    externalId,
    ...payload,
  })
  if (!stillOwned()) return false
  journal.attachCheck(attempt.id, created?.id)
  return true
}

const count = (value) => (typeof value === "number" ? String(value) : "—")

/**
 * The in-progress check output after some lanes have finished. **Pure.**
 *
 * It says only what has happened: finished lanes with their own counts, the
 * lanes still pending by name, and the lanes left to the hosted plane. There
 * is no conclusion and no evidence digest here - both belong to the final
 * summary, which replaces this text when the run ends - so nothing in it can
 * read as a result for the commit. The same redaction and proof pass as the
 * final summary run over it, because it goes to the same place.
 */
export function renderProgressOutput(progress, contract) {
  const finished = progress.lanes.filter((lane) => lane !== null)
  const pending = progress.laneIds.filter(
    (_, index) => progress.lanes[index] === null
  )
  const passed = finished.filter((lane) => lane.status === "success").length
  const rawTitle = `${progress.profile} — running: ${finished.length}/${progress.laneIds.length} lanes finished, ${passed} passed`
  const title =
    rawTitle.length > TITLE_MAX_LENGTH
      ? `${rawTitle.slice(0, TITLE_MAX_LENGTH - 1)}…`
      : rawTitle
  const summary = [
    `**Profile:** \`${escapeCell(progress.profile)}\``,
    `**Head SHA:** \`${escapeCell(progress.headSha)}\``,
    "",
    `${finished.length} of ${progress.laneIds.length} local lanes have finished; ${passed} passed. This check updates as each lane finishes, and the conclusion is published only when every lane has.`,
  ].join("\n")
  const rows = finished.map(
    (lane) =>
      `| ${escapeCell(lane.laneId)} | ${escapeCell(lane.status)} | ${formatDuration(lane.durationSeconds)} | ${count(lane.testsRun)} | ${count(lane.testsPassed)} | ${count(lane.testsFailed)} | ${count(lane.testsSkipped)} | ${count(lane.flaky)} |`
  )
  const text = [
    "## Finished lanes",
    "",
    "| Lane | Status | Duration | Run | Passed | Failed | Skipped | Flaky |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...rows,
    "",
    "## Still running or queued",
    "",
    pending.length === 0
      ? "None."
      : pending.map((id) => `- \`${escapeCell(id)}\``).join("\n"),
    ...(progress.hostedOnly.length === 0
      ? []
      : [
          "",
          "## Lanes left to the GitHub-hosted plane",
          "",
          ...progress.hostedOnly.map(
            (entry) =>
              `- \`${escapeCell(entry.laneId)}\`${entry.reason ? ` — ${escapeCell(entry.reason)}` : ""}`
          ),
        ]),
  ].join("\n")
  const parts = {
    title: redactSummaryText(title, contract),
    summary: redactSummaryText(summary, contract),
    text: redactSummaryText(text, contract),
  }
  assertPublishable(parts, contract)
  return Object.freeze(parts)
}

/**
 * Update an open check with lane progress. Best effort by design: a progress
 * update that fails is logged by the caller and the run carries on, and the
 * final result is published through the durable path regardless.
 */
export async function publishLaneProgress({
  github,
  contract,
  checkRunId,
  progress,
}) {
  if (checkRunId === null || checkRunId === undefined) return false
  await github.updateCheckRun(checkRunId, {
    status: "in_progress",
    output: renderProgressOutput(progress, contract),
  })
  return true
}
