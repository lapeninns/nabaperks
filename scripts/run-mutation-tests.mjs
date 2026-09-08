import { spawnSync } from "node:child_process"
import { readdirSync } from "node:fs"
import { pathToFileURL } from "node:url"

// These tests directly exercise the mutation targets. Failure here already
// detects the active mutant; every survivor still faces the entire unit suite.
const FOCUSED_TESTS = [
  "block-reasons",
  "customer-otp-rate-limit-core",
  "customer-qr-scanner",
  "customer-session-cookie-core",
  "merchant-auth-rate-limit-core",
  "phone-pii",
  "phone-pii.property",
  "qr-rate-limit-core",
  "rate-limit-core",
  "reward-scanner",
  "scanner.property",
  "session-cookie-core.property",
  "uk-calendar",
  "uk-date",
].map((name) => `tests/unit/${name}.test.mjs`)

export function runMutationTests({
  run = spawnSync,
  list = readdirSync,
  env = process.env,
} = {}) {
  // Stryker supplies NODE_PATH for its sandbox. The unit suite includes a
  // compiler boundary that intentionally rejects ambient resolution overrides.
  // Remove them only from the test child; production compiler guards stay strict.
  const testEnv = { ...env }
  for (const key of ["NODE_PATH", "NODE_OPTIONS", "ESBUILD_BINARY_PATH"])
    delete testEnv[key]
  const allTests = list("tests/unit")
    .filter((name) => name.endsWith(".test.mjs"))
    .sort()
    .map((name) => `tests/unit/${name}`)
  if (
    !allTests.length ||
    FOCUSED_TESTS.some((file) => !allTests.includes(file))
  ) {
    throw new Error(
      "Mutation test inventory is empty or missing a focused test"
    )
  }
  for (const files of [FOCUSED_TESTS, allTests]) {
    const result = run(
      process.execPath,
      [
        "--import",
        "./tests/support/register-alias.mjs",
        "--test",
        "--test-concurrency=1",
        ...files,
      ],
      { stdio: "inherit", env: testEnv }
    )
    if (result.error) throw result.error
    if (result.status !== 0) return result.status ?? 1
  }
  return 0
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = runMutationTests()
}
