type LaunchPilotCompletion = {
  readonly billingStatus: string | null
  readonly syncStatus: string
  readonly confirmedStripeTrialEnd: string | null
}

export function hasLaunchPilotEnded(
  state: LaunchPilotCompletion,
  now = new Date()
): boolean {
  if (state.billingStatus === "active") return true
  if (
    state.syncStatus !== "synchronised" ||
    state.confirmedStripeTrialEnd === null
  ) {
    return false
  }

  const confirmedEnd = Date.parse(state.confirmedStripeTrialEnd)
  return Number.isFinite(confirmedEnd) && confirmedEnd <= now.getTime()
}
