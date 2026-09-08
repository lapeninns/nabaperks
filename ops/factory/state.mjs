// This advisory state machine never grants merge or deployment authority.
// Input comes from provider metadata, never instructions in PR text or logs.
export function evaluatePullRequest(pr, policy, now = Date.now()) {
  const result = (state, owner, action, reason) => ({
    kind: "pull-request",
    number: pr.number,
    sha: pr.headSha,
    url: pr.url,
    state,
    owner,
    action,
    reason,
  })
  if (!pr.complete || !/^[a-f0-9]{40}$/.test(pr.headSha ?? ""))
    return result(
      "unknown",
      "coordinator",
      "refresh-evidence",
      "Provider evidence is incomplete; no readiness decision is possible."
    )
  if (pr.state !== "OPEN")
    return result(
      pr.state === "MERGED" ? "merged" : "closed",
      "coordinator",
      "observe-release",
      "PR status is separate from deployment verification."
    )
  if (pr.isDraft)
    return result(
      "implementing",
      "coding-agent",
      "continue-authorised-work",
      "Draft PR is not ready for review."
    )
  if (pr.headRepository !== policy.repository)
    return result(
      "external-review",
      "reviewer",
      "use-hosted-review",
      "External repository code is ineligible for local execution."
    )
  if (
    ["DIRTY", "BEHIND"].includes(pr.mergeStateStatus) ||
    !/^[a-f0-9]{40}$/.test(pr.candidateSha ?? "")
  )
    return result(
      "merge-blocked",
      "coordinator",
      "diagnose-merge-block",
      `GitHub reports ${pr.mergeStateStatus} or no usable merge candidate; refresh or repair the merge before waiting for checks.`
    )
  const required = policy.requiredChecks.map((expected) => {
    const candidates = pr.checks.filter(
      (check) =>
        check.name === expected.name &&
        check.appId === expected.appId &&
        check.sha === pr.headSha &&
        check.baseSha === pr.baseSha &&
        check.workflowBound === true
    )
    return candidates.sort((a, b) => b.id - a.id)[0]
  })
  const failed = required.filter(
    (check) => check?.status === "completed" && check.conclusion !== "success"
  )
  const pending = required.some(
    (check) => !check || check.status !== "completed"
  )
  const currentReviews = pr.reviews.filter(
    (review) =>
      review.userId === policy.reviewer.userId &&
      review.login === policy.reviewer.login &&
      review.sha === pr.headSha &&
      ["COMMENTED", "APPROVED", "CHANGES_REQUESTED"].includes(review.state)
  )
  const review = currentReviews.sort((a, b) => b.id - a.id)[0]
  const unresolved =
    pr.unresolvedThreads > 0 ||
    pr.reviewDecision === "CHANGES_REQUESTED" ||
    review?.state === "CHANGES_REQUESTED"
  if (failed.length || unresolved) {
    const exhausted = pr.repairCycles >= policy.maxRepairCycles
    return result(
      exhausted ? "decision-needed" : "fixing",
      exhausted ? "owner" : "coding-agent",
      exhausted ? "decide-next-step" : "investigate-and-fix",
      `${failed.length} required checks failed; ${pr.unresolvedThreads} review threads remain open. ${exhausted ? "Automatic repair budget exhausted." : "Validate findings before changing code."}`
    )
  }
  if (pending) {
    const stale =
      now - Date.parse(pr.headCommittedAt) > policy.checkWaitMinutes * 60_000
    return result(
      stale ? "check-stalled" : "testing",
      "coordinator",
      stale ? "diagnose-check-wait" : "observe-checks",
      "Required checks need expected-App workflow evidence stamped with the current PR head and base."
    )
  }
  if (!review) {
    const requested =
      pr.reviewRequestedAt && Number.isFinite(Date.parse(pr.reviewRequestedAt))
    const stalled =
      requested &&
      now - Date.parse(pr.reviewRequestedAt) > policy.reviewWaitMinutes * 60_000
    return result(
      stalled ? "review-stalled" : "reviewing",
      stalled ? "owner" : "coordinator",
      stalled
        ? "choose-review-recovery"
        : requested
          ? "observe-review"
          : "request-current-review",
      "No completed reviewer record covers the current head; an older review or reaction is not sufficient."
    )
  }
  if (pr.reviewDecision !== "APPROVED")
    return result(
      "approval-needed",
      "code-owner",
      "review-and-approve",
      "Checks and automated review coverage are current; GitHub still requires an eligible approval."
    )
  if (pr.mergeStateStatus !== "CLEAN")
    return result(
      "merge-blocked",
      "coordinator",
      "diagnose-merge-block",
      `GitHub reports ${pr.mergeStateStatus}; its merge rules remain authoritative.`
    )
  return result(
    "decision-needed",
    "owner",
    "accept-product-and-authorise-merge",
    "Checks, automated review coverage and GitHub approval are current. Inspect the product result before proceeding under release policy."
  )
}

export function evaluateRelease(run, mainSha, policy, now = Date.now()) {
  const active = !["completed"].includes(run.status)
  const outdated = run.sha !== mainSha
  const waiting = (run.environments ?? []).length > 0
  const stalled =
    active &&
    now - Date.parse(run.createdAt) > policy.releaseWaitMinutes * 60_000
  let state = "releasing",
    owner = "coordinator",
    action = "observe-release"
  let reason =
    "Release completion and customer-journey verification are separate evidence."
  if (!run.complete) {
    state = "unknown"
    action = "refresh-evidence"
    reason = "Release evidence is incomplete."
  } else if (active && outdated) {
    state = "superseded-release"
    owner = "release-operator"
    action = "inspect-before-cancelling"
    reason =
      "An older revision is still active. Inspect migration and promotion stages before cancellation; never approve an old run merely to free the queue."
  } else if (waiting) {
    state = "release-approval-needed"
    owner =
      run.environments.flatMap((env) => env.reviewers).join(", ") ||
      "environment-reviewer"
    action = "review-deployment-evidence"
    reason = `Protected approval is pending for ${run.environments.map((env) => env.name).join(", ")}.`
  } else if (run.status === "completed") {
    state =
      run.conclusion === "success" ? "verification-needed" : "release-failed"
    action =
      run.conclusion === "success" ? "verify-live-journey" : "diagnose-release"
  } else if (stalled) {
    state = "release-stalled"
    action = "diagnose-release-wait"
  }
  return {
    kind: "release",
    runId: run.id,
    sha: run.sha,
    url: run.url,
    state,
    owner,
    action,
    reason,
  }
}
