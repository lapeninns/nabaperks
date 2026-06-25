import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const EXPECTED_CAPABILITIES = [
  "governance-traceability",
  "foundation-health",
  "customer-qr-join",
  "customer-stamp-reward",
  "merchant-onboarding-launch",
  "merchant-console-value",
  "admin-support-fraud",
  "billing-webhooks",
  "privacy-consent-pii",
  "observability-analytics",
  "security-rate-limits",
  "db-rls-ledger",
  "design-accessibility-pwa",
  "performance-build",
] as const

describe("major capability scenario suite", () => {
  it("defines an N-max scenario set with one consistent pass/fail rubric", async () => {
    const { MAJOR_CAPABILITY_SCENARIOS, SCENARIO_SUCCESS_CRITERIA } =
      await import("../../scripts/run-major-capability-scenarios.mjs")

    expect(MAJOR_CAPABILITY_SCENARIOS.map((scenario) => scenario.id)).toEqual(
      EXPECTED_CAPABILITIES
    )
    expect(new Set(MAJOR_CAPABILITY_SCENARIOS.map((scenario) => scenario.id))).toHaveProperty(
      "size",
      EXPECTED_CAPABILITIES.length
    )
    expect(SCENARIO_SUCCESS_CRITERIA).toEqual([
      "All commands exit 0 under the shared scenario environment.",
      "Each command writes a non-empty evidence log.",
      "Scenario evidence includes command, start/end time, exit code, and outcome.",
    ])

    for (const scenario of MAJOR_CAPABILITY_SCENARIOS) {
      expect(scenario.title).toMatch(/\S/)
      expect(scenario.capability).toMatch(/\S/)
      expect(scenario.evidenceKind).toMatch(/^(cli|db|browser|http)$/)
      expect(scenario.commands.length).toBeGreaterThan(0)
      expect(scenario.successCriteria).toEqual(SCENARIO_SUCCESS_CRITERIA)
    }
  })

  it("refuses DB and browser scenarios unless the target is local disposable infrastructure", async () => {
    const { assertLocalDisposableTarget } = await import(
      "../../scripts/run-major-capability-scenarios.mjs"
    )

    expect(() =>
      assertLocalDisposableTarget({
        NEXT_PUBLIC_SUPABASE_URL: "https://hosted-project.supabase.co",
        SUPABASE_DB_URL:
          "postgresql://postgres:secret@db.hosted-project.supabase.co:5432/postgres",
      })
    ).toThrow(/local disposable/)

    expect(() =>
      assertLocalDisposableTarget({
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_DB_URL:
          "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      })
    ).not.toThrow()
  })

  it("clears OTP bypass controls from the shared scenario environment", async () => {
    const { scenarioEnvironment } = await import(
      "../../scripts/run-major-capability-scenarios.mjs"
    )
    const rootDir = mkdtempSync(join(tmpdir(), "nabaperks-scenarios-"))
    const previousDevOtp = process.env.CUSTOMER_DEV_OTP_CODE
    const previousBypassMode = process.env.CUSTOMER_OTP_BYPASS_MODE

    writeFileSync(
      join(rootDir, ".env.local"),
      [
        "CUSTOMER_DEV_OTP_CODE=from-env-local",
        "CUSTOMER_OTP_BYPASS_MODE=any-4-digits",
        "",
      ].join("\n")
    )
    process.env.CUSTOMER_DEV_OTP_CODE = "from-process-env"
    process.env.CUSTOMER_OTP_BYPASS_MODE = "any-4-digits"

    try {
      const env = scenarioEnvironment(rootDir) as Record<string, string | undefined>

      expect(env.CUSTOMER_DEV_OTP_CODE).toBeUndefined()
      expect(env.CUSTOMER_OTP_BYPASS_MODE).toBeUndefined()
    } finally {
      if (previousDevOtp === undefined) delete process.env.CUSTOMER_DEV_OTP_CODE
      else process.env.CUSTOMER_DEV_OTP_CODE = previousDevOtp

      if (previousBypassMode === undefined)
        delete process.env.CUSTOMER_OTP_BYPASS_MODE
      else process.env.CUSTOMER_OTP_BYPASS_MODE = previousBypassMode

      rmSync(rootDir, { recursive: true, force: true })
    }
  })
})
