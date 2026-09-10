/** Planning headroom within the hard cgroup cap; old-space is not an RSS cap. */
export function assertBrowserMemoryBudget(lane, contract) {
  if (!/^(e2e|a11y)-/.test(lane.id)) return
  const budget = contract.browserMemory
  if (!budget) throw new Error("Browser memory budget is missing")
  for (const key of [
    "oldSpaceMb",
    "browserReserveMb",
    "nativeAndToolsReserveMb",
  ]) {
    if (!Number.isInteger(budget[key]) || budget[key] <= 0)
      throw new Error(`Browser memory ${key} must be a positive integer`)
  }
  if (lane.env?.PLAYWRIGHT_NODE_HEAP_MB !== String(budget.oldSpaceMb))
    throw new Error(
      `Browser lane ${lane.id} heap differs from the reviewed memory budget`
    )
  const required =
    budget.oldSpaceMb + budget.browserReserveMb + budget.nativeAndToolsReserveMb
  if (!lane.resources || lane.resources.memoryGb * 1024 < required)
    throw new Error(
      `Browser lane ${lane.id} leaves insufficient browser/native/tool headroom`
    )
}
