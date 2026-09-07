/** Recover an ambiguous check creation using a durable attempt identity. */
import { checkRunIdentityViolations } from "../core/app-identity.mjs"

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
