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

  const previous = workflowRuns
    .filter(
      (run) =>
        run.id !== currentRun.id &&
        run.workflow_id === currentRun.workflow_id &&
        run.run_number < currentRun.run_number
    )
    .sort((left, right) => right.run_number - left.run_number)[0]

  return Boolean(
    previous &&
    previous.event === "schedule" &&
    previous.status === "completed" &&
    previous.conclusion === "success" &&
    previous.run_attempt === 1 &&
    previous.repository?.full_name === repository
  )
}
