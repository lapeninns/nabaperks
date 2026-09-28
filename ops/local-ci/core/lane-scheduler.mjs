/**
 * Resource admission for lanes sharing one runtime. Policy comes from the host.
 *
 * Two runtimes exist. The Lima VM belongs to this plane alone, so its budget is
 * the VM's declared size less a reserve. The Docker Desktop VM is shared with
 * other worktrees' containers, so its budget is also reduced by what those
 * containers use right now - never by less than a floor - and a lane that
 * fits the static budget can still wait for memory another stack is holding.
 */
import { runtimeKind } from "./contract.mjs"

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

/**
 * The CPU and memory the active runtime offers, and what it keeps back.
 *
 * `externalMemoryFloorGb` is zero for Lima: nothing but this plane runs in
 * that VM. On Docker Desktop it is the minimum the scheduler assumes other
 * worktrees' containers hold, whatever a live sample says.
 */
export function runtimeBudget(contract) {
  if (runtimeKind(contract) === "docker-desktop") {
    const runtime = contract.runtime
    return {
      kind: "docker-desktop",
      cpus: runtime.cpus,
      memoryGb: runtime.memoryGb,
      reserveCpus: runtime.reserveCpus,
      reserveMemoryGb: runtime.reserveMemoryGb,
      externalMemoryFloorGb: runtime.externalMemoryFloorGb,
      daemonAvailable: false,
    }
  }
  return {
    kind: "lima",
    cpus: contract.vm.cpus,
    memoryGb: contract.vm.memoryGb,
    reserveCpus: contract.vm.reserveCpus,
    reserveMemoryGb: contract.vm.reserveMemoryGb,
    externalMemoryFloorGb: 0,
    daemonAvailable: true,
  }
}

/**
 * Whether these lanes may run together.
 *
 * `externalMemoryGb` is the memory other containers on a shared daemon hold
 * now. It is charged at no less than the runtime's floor, so a sample that
 * failed or read low can never admit more than the budget planned for.
 */
export function lanesFit(lanes, contract, { externalMemoryGb = 0 } = {}) {
  const budget = runtimeBudget(contract)
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
      if (lane.needsDaemon && budget.daemonAvailable)
        daemon[key] += contract.container.daemon[key]
    }
  }
  const external = Math.max(
    budget.externalMemoryFloorGb,
    Number.isFinite(externalMemoryGb) && externalMemoryGb > 0
      ? externalMemoryGb
      : 0
  )
  return (
    lanes.length <= contract.agent.maxConcurrentLanes &&
    worker.cpus <= contract.container.cpus &&
    worker.memoryGb <= contract.container.memoryGb &&
    worker.cpus + daemon.cpus + budget.reserveCpus <= budget.cpus &&
    worker.memoryGb + daemon.memoryGb + budget.reserveMemoryGb + external <=
      budget.memoryGb
  )
}

/** The median of the numbers given, or null for none. Pure. */
export function median(values) {
  const sorted = values
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((a, b) => a - b)
  if (sorted.length === 0) return null
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

/** How many recent host-local durations the longest-first estimate uses. */
export const DURATION_HISTORY = 5

/**
 * The expected duration of one lane, in seconds. Pure.
 *
 * `history` is newest first, and only this host's own lane-result records
 * belong in it - they are timed by the agent, never parsed from candidate
 * output. Without history the lane's own timeout stands in: a reviewed
 * profile value that orders the long browser lanes first even on a new host.
 */
export function expectedLaneSeconds(lane, history = []) {
  const recent = median(history.slice(0, DURATION_HISTORY))
  if (recent !== null) return recent
  return Number.isFinite(lane.timeoutMinutes) ? lane.timeoutMinutes * 60 : 0
}

/**
 * Pending lanes in admission order: longest expected first, profile order
 * among equals. Pure; returns `{ lane, index }` entries.
 */
export function longestFirst(lanes, expectedSeconds = () => null) {
  return lanes
    .map((lane, index) => ({
      lane,
      index,
      expected: expectedSeconds(lane) ?? expectedLaneSeconds(lane),
    }))
    .sort((a, b) => b.expected - a.expected || a.index - b.index)
    .map(({ lane, index }) => ({ lane, index }))
}

/** How long an idle scheduler waits before re-sampling external memory. */
export const ADMISSION_POLL_MS = 15_000

/** How long nothing may be admitted before the run gives up on the host. */
export const ADMISSION_WAIT_MS = 15 * 60_000

const defaultSleep = (ms) =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    timer.unref?.()
  })

/**
 * Admit only lanes whose CPU, memory and service groups fit. Pending lanes are
 * tried longest first, so the lanes that bound the run's wall time start
 * before the short ones; results retain profile order even when completion
 * order differs. On infrastructure errors, drain every started lane before
 * rejecting so workspace cleanup cannot race it.
 *
 * `externalMemoryGb` is sampled before each admission round. When nothing is
 * running and nothing fits because other containers hold the memory, the
 * scheduler waits and samples again, and gives up after `admissionWaitMs`
 * rather than spinning or overcommitting a VM other stacks depend on.
 */
export async function scheduleLanes({
  lanes,
  contract,
  run,
  externalMemoryGb = () => 0,
  expectedSeconds = () => null,
  admissionPollMs = ADMISSION_POLL_MS,
  admissionWaitMs = ADMISSION_WAIT_MS,
  sleep = defaultSleep,
  now = () => Date.now(),
}) {
  for (const lane of lanes)
    if (!lanesFit([lane], contract))
      throw new Error(`Lane ${lane.id} cannot fit the VM resource budget`)
  const pending = longestFirst(lanes, expectedSeconds)
  const running = new Map()
  const results = Array(lanes.length)
  let failure = null
  let peak = 0
  let idleSince = null
  const sample = async () => {
    try {
      const value = await externalMemoryGb()
      return Number.isFinite(value) && value > 0 ? value : 0
    } catch {
      // The floor still applies; an unreadable sample never widens admission.
      return 0
    }
  }
  while (pending.length || running.size) {
    if (pending.length && failure === null) {
      const external = await sample()
      while (pending.length && failure === null) {
        const index = pending.findIndex(({ lane }) =>
          lanesFit(
            [...running.values()].map((entry) => entry.lane).concat(lane),
            contract,
            { externalMemoryGb: external }
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
    }
    if (running.size) {
      idleSince = null
      await Promise.race([...running.values()].map((entry) => entry.promise))
    } else if (pending.length && failure === null) {
      idleSince ??= now()
      if (now() - idleSince >= admissionWaitMs)
        throw new Error(
          `No lane could be admitted for ${Math.round(admissionWaitMs / 60_000)} minutes: containers this agent does not own hold the memory lane ${pending[0].lane.id} needs`
        )
      await sleep(admissionPollMs)
    }
    if (failure !== null) {
      await Promise.all([...running.values()].map((entry) => entry.promise))
      throw failure
    }
  }
  return { results, peak }
}
