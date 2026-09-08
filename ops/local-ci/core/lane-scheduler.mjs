/** Resource admission for lanes sharing one VM. Policy comes from the host. */
export function laneResources(lane, contract) {
  const resources = lane.resources ?? contract.container
  const result = { cpus: resources.cpus, memoryGb: resources.memoryGb }
  for (const key of ["cpus", "memoryGb"]) {
    if (
      !Number.isFinite(result[key]) ||
      result[key] <= 0 ||
      result[key] > contract.container[key]
    )
      throw new Error(`Invalid ${key} budget for lane ${lane.id}`)
  }
  return result
}

export function lanesFit(lanes, contract) {
  const worker = { cpus: 0, memoryGb: 0 }
  const daemon = { cpus: 0, memoryGb: 0 }
  const groups = new Set()
  for (const lane of lanes) {
    const resources = laneResources(lane, contract)
    if (lane.concurrencyGroup) {
      if (groups.has(lane.concurrencyGroup)) return false
      groups.add(lane.concurrencyGroup)
    }
    for (const key of ["cpus", "memoryGb"]) {
      worker[key] += resources[key]
      if (lane.needsDaemon) daemon[key] += contract.container.daemon[key]
    }
  }
  return (
    lanes.length <= contract.agent.maxConcurrentLanes &&
    worker.cpus <= contract.container.cpus &&
    worker.memoryGb <= contract.container.memoryGb &&
    worker.cpus + daemon.cpus + contract.vm.reserveCpus <= contract.vm.cpus &&
    worker.memoryGb + daemon.memoryGb + contract.vm.reserveMemoryGb <=
      contract.vm.memoryGb
  )
}

/**
 * Admit only lanes whose CPU, memory and service groups fit. Results retain
 * profile order even when completion order differs. On infrastructure errors,
 * drain every started lane before rejecting so workspace cleanup cannot race it.
 */
export async function scheduleLanes({ lanes, contract, run }) {
  for (const lane of lanes)
    if (!lanesFit([lane], contract))
      throw new Error(`Lane ${lane.id} cannot fit the VM resource budget`)
  const pending = lanes.map((lane, index) => ({ lane, index }))
  const running = new Map()
  const results = Array(lanes.length)
  let failure = null
  let peak = 0
  while (pending.length || running.size) {
    while (pending.length && failure === null) {
      const index = pending.findIndex(({ lane }) =>
        lanesFit(
          [...running.values()].map((entry) => entry.lane).concat(lane),
          contract
        )
      )
      if (index < 0) break
      const entry = pending.splice(index, 1)[0]
      const promise = Promise.resolve()
        .then(() => run(entry.lane, entry.index))
        .then((result) => {
          results[entry.index] = result
        })
        .catch((error) => {
          failure ??= error
        })
        .finally(() => running.delete(entry.index))
      running.set(entry.index, { lane: entry.lane, promise })
      peak = Math.max(peak, running.size)
    }
    if (running.size)
      await Promise.race([...running.values()].map((entry) => entry.promise))
    if (failure !== null) {
      await Promise.all([...running.values()].map((entry) => entry.promise))
      throw failure
    }
  }
  return { results, peak }
}
