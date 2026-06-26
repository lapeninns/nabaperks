export type LaunchChecklistHref = {
  id: string
  tab: string
  href: string
}

export function isLaunchStepSaveSuccess(
  tab: string,
  params: {
    saved?: string
    created?: string
    enabled?: string
    disabled?: string
  }
): boolean {
  switch (tab) {
    case "card":
      return params.saved === "1"
    case "rewards":
      return params.saved === "pool"
    case "qr":
      return params.created === "1" || params.enabled === "1"
    default:
      return false
  }
}

export function getLaunchContinueHrefAfterStep(
  checklist: LaunchChecklistHref[],
  completedTab: string
): string | null {
  const index = checklist.findIndex(
    (step) => step.tab === completedTab || step.id === completedTab
  )

  if (index === -1) {
    return null
  }

  return checklist[index + 1]?.href ?? null
}

export function resolveLaunchContinueHref(
  activeTab: string,
  params: {
    saved?: string
    created?: string
    enabled?: string
  },
  checklist: LaunchChecklistHref[],
  options?: {
    rewardsReady?: boolean
  }
): string | null {
  if (!isLaunchStepSaveSuccess(activeTab, params)) {
    return null
  }

  if (activeTab === "rewards" && !options?.rewardsReady) {
    return null
  }

  return getLaunchContinueHrefAfterStep(checklist, activeTab)
}

export function launchContinueCopy(nextStepLabel: string | null) {
  if (!nextStepLabel) {
    return "Saved. Review this step or continue when you are ready."
  }

  return `Saved. Continue to ${nextStepLabel} when you are ready.`
}
