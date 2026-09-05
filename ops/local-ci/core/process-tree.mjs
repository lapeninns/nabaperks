// Lima launches an SSH child which inherits its output pipes. Killing only
// Lima leaves those pipes open and prevents the runner from reaching cleanup.
export const PROCESS_TREE_OPTIONS = Object.freeze({
  detached: process.platform !== "win32",
})

export function signalProcessTree(child, signal) {
  if (PROCESS_TREE_OPTIONS.detached && Number.isInteger(child.pid)) {
    try {
      process.kill(-child.pid, signal)
    } catch (error) {
      if (error.code !== "ESRCH") throw error
    }
    return
  }
  child.kill(signal)
}
