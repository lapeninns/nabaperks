export function previousScheduledRunSucceeded({
  currentRun,
  workflowRuns,
  repository,
}) {
  if (
    currentRun.event !== "schedule" ||
    currentRun.run_attempt !== 1 ||
    currentRun.repository?.full_name !== repository
  ) {
    return false
  }

  const previousRuns = workflowRuns
    .filter(
      (run) =>
        run.id !== currentRun.id &&
        run.workflow_id === currentRun.workflow_id &&
        run.run_number < currentRun.run_number
    )
    .sort((left, right) => right.run_number - left.run_number)
  const previousScheduled = previousRuns.find((run) => run.event === "schedule")

  if (
    !previousScheduled ||
    previousScheduled.status !== "completed" ||
    previousScheduled.conclusion !== "success" ||
    previousScheduled.run_attempt !== 1 ||
    previousScheduled.repository?.full_name !== repository
  ) {
    return false
  }

  return !previousRuns.some(
    (run) =>
      run.run_number > previousScheduled.run_number &&
      (run.run_attempt !== 1 ||
        run.status !== "completed" ||
        run.conclusion !== "success")
  )
}
