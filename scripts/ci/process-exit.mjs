import { constants } from "node:os"

/** Preserve a child's signal through wrappers using shell exit conventions. */
export function processExitCode({ status = null, signal = null } = {}) {
  if (signal && constants.signals[signal])
    return 128 + constants.signals[signal]
  return status ?? 1
}
