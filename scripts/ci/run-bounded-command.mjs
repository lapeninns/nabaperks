import { spawn } from "node:child_process"
import { setTimeout as delay } from "node:timers/promises"
import {
  PROCESS_TREE_OPTIONS,
  signalProcessTree,
} from "../../ops/local-ci/core/process-tree.mjs"

function groupExists(child) {
  if (!Number.isInteger(child.pid)) return false
  try {
    process.kill(PROCESS_TREE_OPTIONS.detached ? -child.pid : child.pid, 0)
    return true
  } catch (error) {
    if (error.code === "ESRCH") return false
    throw error
  }
}

export async function runBoundedCommand(
  command,
  args,
  { timeout, ...options }
) {
  if (!Number.isSafeInteger(timeout) || timeout <= 0)
    throw new Error("A positive process deadline is required")
  const child = spawn(command, args, { ...options, ...PROCESS_TREE_OPTIONS })
  let interrupted = null
  let forced
  const stop = (signal) => {
    interrupted = signal
    signalProcessTree(child, "SIGTERM")
    forced ??= setTimeout(() => signalProcessTree(child, "SIGKILL"), 2000)
  }
  const onTerm = () => stop("SIGTERM"),
    onInt = () => stop("SIGINT")
  process.on("SIGTERM", onTerm)
  process.on("SIGINT", onInt)
  const deadline = setTimeout(() => stop("TIMEOUT"), timeout)
  let result
  try {
    result = await new Promise((resolve) => {
      child.once("error", (error) => resolve({ status: null, error }))
      child.once("exit", (status, signal) => resolve({ status, signal }))
    })
  } finally {
    clearTimeout(deadline)
    clearTimeout(forced)
    process.off("SIGTERM", onTerm)
    process.off("SIGINT", onInt)
  }
  const unexpectedSurvivors = groupExists(child)
  if (unexpectedSurvivors) {
    signalProcessTree(child, "SIGKILL")
    for (let attempt = 0; attempt < 20 && groupExists(child); attempt++)
      await delay(100)
  }
  return {
    ...result,
    signal: interrupted ?? result.signal,
    unexpectedSurvivors,
    cleanupVerified: !groupExists(child),
  }
}
