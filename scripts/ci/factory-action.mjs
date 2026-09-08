import { homedir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { spawnSync } from "node:child_process"
import { factoryPolicy } from "./factory-status.mjs"
import { githubJson, collectPullRequest } from "../../ops/factory/github.mjs"
import { evaluatePullRequest } from "../../ops/factory/state.mjs"
import { withJournal, reserveRepair } from "../../ops/factory/journal.mjs"

export function factoryAction({
  action,
  number,
  sha,
  directory,
  read = githubJson,
  post = spawnSync,
  policy = factoryPolicy,
  now = new Date().toISOString(),
}) {
  if (
    !["request-review", "reserve-repair", "finish-repair"].includes(action) ||
    !Number.isSafeInteger(number) ||
    number < 1 ||
    !/^[a-f0-9]{40}$/.test(sha ?? "")
  )
    throw new Error("Invalid factory action or exact PR revision")
  return withJournal(directory, (journal, save) => {
    const pr = collectPullRequest(number, policy, {
      read,
      repairCycles: journal.pullRequests[number]?.repairCycles ?? 0,
    })
    if (
      !pr.complete ||
      pr.state !== "OPEN" ||
      pr.isDraft ||
      pr.headRepository !== policy.repository ||
      pr.headSha !== sha
    )
      throw new Error(
        "PR is ineligible, incomplete or changed; no action taken"
      )
    const record = (journal.pullRequests[number] ??= {
      repairCycles: 0,
      reviews: {},
    })
    if (action === "finish-repair") {
      if (!record.activeRepair) throw new Error("No active repair exists")
      record.lastRepair = {
        ...record.activeRepair,
        resultSha: sha,
        finishedAt: now,
      }
      delete record.activeRepair
      save()
      return { action, number, sha }
    }
    const state = evaluatePullRequest(pr, policy, Date.parse(now))
    if (action === "reserve-repair") {
      if (state.action !== "investigate-and-fix")
        throw new Error(
          "Current evidence does not call for an automatic repair"
        )
      const repair = reserveRepair(journal, {
        number,
        sha,
        maxRepairCycles: policy.maxRepairCycles,
        now,
      })
      save()
      return { action, number, ...repair }
    }
    if (state.action !== "request-current-review")
      throw new Error("Current evidence does not call for a new review request")
    if (record.reviews[sha])
      throw new Error(
        "This revision already has a review request intent; inspect its outcome instead of duplicating it"
      )
    // Persist intent before the remote write. An uncertain response is never
    // retried blindly, even across process crashes or later polling cycles.
    record.reviews[sha] = { requestedAt: now, outcome: "uncertain" }
    save()
    const body = `@codex review\n\nReview the current head ${sha}. Recheck the current revision before reviewing; a later push invalidates this request's coverage.\n\n<!-- nabaperks-factory-review:${sha} -->`
    const result = post(
      "gh",
      [
        "api",
        `repos/${policy.repository}/issues/${number}/comments`,
        "--method",
        "POST",
        "--input",
        "-",
      ],
      {
        input: JSON.stringify({ body }),
        encoding: "utf8",
        timeout: 60_000,
        maxBuffer: 1024 * 1024,
      }
    )
    if (result.error || result.signal || result.status !== 0)
      throw new Error(
        "Review request outcome is uncertain; inspect GitHub before retrying"
      )
    const comment = JSON.parse(result.stdout)
    record.reviews[sha].outcome = "submitted"
    record.reviews[sha].commentId = comment.id
    save()
    return { action, number, sha, commentId: comment.id }
  })
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const [action, number, sha, ...extra] = process.argv
      .slice(2)
      .filter((arg) => arg !== "--")
    if (extra.length)
      throw new Error(
        "Usage: factory-action.mjs <request-review|reserve-repair|finish-repair> <pr> <full-head-sha>"
      )
    console.log(
      JSON.stringify(
        factoryAction({
          action,
          number: Number(number),
          sha,
          directory: join(homedir(), ".local", "state", "nabaperks-factory"),
        })
      )
    )
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
