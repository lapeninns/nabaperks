// Flaky-test detector — runs the Vitest suite repeatedly and fails if any run is
// non-deterministic (timers, randomness, unmocked network, shared mutable state
// that varies run to run). Runs are shuffled (`--sequence.shuffle`) by default,
// a stricter check that also surfaces order-coupling between tests — module-mock
// leakage that used to make shuffling fail is now auto-cleaned by
// `tests/helpers/reset-module-mocks.ts`, so the suite is order-independent.
//
// Default 3 runs; override with `--runs=N`. Pass `--no-shuffle` to run in the
// suite's configured order instead. Any other flags (e.g. `--sequence.seed=…`)
// are forwarded straight to Vitest.
import { spawnSync } from "node:child_process"

const runsArg = process.argv.find((value) => value.startsWith("--runs="))
const runs = runsArg ? Math.max(1, Number.parseInt(runsArg.slice(7), 10)) : 3
const shuffle = !process.argv.includes("--no-shuffle")

// Forward any remaining flags (seeds, reporters, etc.) straight to Vitest.
const passthrough = process.argv
  .slice(2)
  .filter(
    (value) =>
      value !== "--shuffle" &&
      value !== "--no-shuffle" &&
      !value.startsWith("--runs=")
  )

const args = ["vitest", "run", "--reporter=dot"]
if (shuffle && !passthrough.includes("--sequence.shuffle")) {
  args.push("--sequence.shuffle")
}
args.push(...passthrough)

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
