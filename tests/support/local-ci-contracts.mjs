/**
 * The contract shapes the local CI unit tests exercise.
 *
 * The committed contract selects the Docker Desktop runtime. The Lima runtime
 * is the dormant rollback path, and rolling back means selecting it again
 * with the job budget it was sized for: 10 CPUs and 32 GiB for job
 * containers, the Docker-in-Docker sidecar the database lanes need, and at
 * most six lanes. Tests of the Lima path use this shape, so they keep proving
 * the behaviour a rollback would restore.
 */
import { readFileSync } from "node:fs"

import { loadContract } from "../../ops/local-ci/core/contract.mjs"

export const CONTRACT_TEXT = readFileSync(
  new URL("../../config/local-ci-contract.json", import.meta.url),
  "utf8"
)

/** The committed contract, validated. */
export function committedContract() {
  return loadContract(() => CONTRACT_TEXT)
}

/** A mutable Lima rollback copy of a parsed contract. */
export function limaRollback(contract) {
  const lima = structuredClone(contract)
  lima.runtime = { kind: "lima" }
  lima.container.cpus = 10
  lima.container.memoryGb = 32
  lima.container.dockerInDocker = true
  lima.agent.maxConcurrentLanes = 6
  return lima
}

/** The Lima rollback contract, validated like the committed one. */
export function limaContract() {
  return loadContract(() =>
    JSON.stringify(limaRollback(JSON.parse(CONTRACT_TEXT)))
  )
}
