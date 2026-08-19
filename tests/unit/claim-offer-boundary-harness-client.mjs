import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export async function runClaimOfferBoundaryHarness(kind, scenario) {
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "--experimental-test-module-mocks",
      "--import",
      "./tests/support/register-alias.mjs",
      "./tests/unit/claim-offer-boundary-harness.fixture.mjs",
      kind,
      scenario,
    ],
    { timeout: 5_000 }
  )

  return JSON.parse(stdout)
}
