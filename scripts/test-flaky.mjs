// Flaky-test detector — runs the Vitest suite repeatedly and fails if any run is
// non-deterministic (timers, randomness, unmocked network, shared mutable state
// that varies run to run). Default 3 runs in the suite's configured order, which
// is the order CI uses.
//
// Pass `--shuffle` to additionally randomise test order — a stricter check that
// surfaces order-coupling between tests. The suite has known pre-existing
// order-coupling (global fetch / module-mock assumptions), so `--shuffle` is
// opt-in rather than the default gate. Override the count with `--runs=N`.
import { spawnSync } from "node:child_process"

const runsArg = process.argv.find((value) => value.startsWith("--runs="))
const runs = runsArg ? Math.max(1, Number.parseInt(runsArg.slice(7), 10)) : 3
const shuffle = process.argv.includes("--shuffle")

const args = ["vitest", "run", "--reporter=dot"]
if (shuffle) args.push("--sequence.shuffle")

let failedRun = 0

for (let i = 1; i <= runs; i += 1) {
  console.log(
    `\n=== Flaky check: run ${i}/${runs}${shuffle ? " (shuffled)" : ""} ===`
  )
  const result = spawnSync("pnpm", args, { stdio: "inherit" })
  if (result.status !== 0) {
    failedRun = i
    break
  }
}

if (failedRun > 0) {
  console.error(
    `\nSuite failed on run ${failedRun}/${runs}. Investigate non-determinism (shared state, ordering, timers).`
  )
  process.exit(1)
}

console.log(`\nAll ${runs} runs passed — no flakiness detected.`)
