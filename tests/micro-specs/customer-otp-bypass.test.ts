import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { afterEach, describe, expect, it, vi } from "vitest"

const projectDir = process.cwd()

describe("customer OTP temporary bypass", () => {
  afterEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    delete process.env.CUSTOMER_OTP_BYPASS_MODE
    delete process.env.CUSTOMER_DEV_OTP_CODE
    delete process.env.TWILIO_ACCOUNT_SID
    delete process.env.TWILIO_AUTH_TOKEN
    delete process.env.TWILIO_API_KEY_SID
    delete process.env.TWILIO_API_KEY_SECRET
    delete process.env.TWILIO_VERIFY_SERVICE_SID
  })

  it("approves any four-digit code without calling Twilio when explicitly enabled", async () => {
    process.env.CUSTOMER_OTP_BYPASS_MODE = "any-4-digits"
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal("fetch", fetchMock)
    const { checkCustomerPhoneVerification, startCustomerPhoneVerification } =
      await import("@/lib/customer/verification")

    await expect(
      startCustomerPhoneVerification("+447467586751")
    ).resolves.toEqual({ status: "sent" })
    await expect(
      checkCustomerPhoneVerification("+447467586751", "1234")
    ).resolves.toEqual({ status: "approved" })
    await expect(
      checkCustomerPhoneVerification("+447467586751", "12345")
    ).resolves.toEqual({ status: "rejected" })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("does not approve the any-four-digit bypass in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("CUSTOMER_OTP_BYPASS_MODE", "any-4-digits")
    vi.stubEnv("TWILIO_ACCOUNT_SID", "AC123")
    vi.stubEnv("TWILIO_AUTH_TOKEN", "token")
    vi.stubEnv("TWILIO_VERIFY_SERVICE_SID", "VA123")
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ status: "pending" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
    )
    vi.stubGlobal("fetch", fetchMock)
    const { checkCustomerPhoneVerification } =
      await import("@/lib/customer/verification")

    await expect(
      checkCustomerPhoneVerification("+447467586751", "1234")
    ).resolves.toEqual({ status: "rejected" })
    expect(fetchMock).toHaveBeenCalled()
  })

  it("redacts Twilio failure bodies from thrown errors", async () => {
    vi.stubEnv("TWILIO_ACCOUNT_SID", "AC123")
    vi.stubEnv("TWILIO_AUTH_TOKEN", "token")
    vi.stubEnv("TWILIO_VERIFY_SERVICE_SID", "VA123")
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(
        async () =>
          new Response("raw provider phone +447467586751", { status: 500 })
      )
    )
    const { startCustomerPhoneVerification } =
      await import("@/lib/customer/verification")

    await expect(
      startCustomerPhoneVerification("+447467586751")
    ).rejects.toThrow("<redacted body:")
    await expect(
      startCustomerPhoneVerification("+447467586751")
    ).rejects.not.toThrow("+447467586751")
  })
})

describe("customer OTP bypass env guard", () => {
  it("allows server env validation without Twilio Verify config when bypass mode is explicit", async () => {
    const { assertValidEnv } = await import("@/lib/env/validate")

    expect(() =>
      assertValidEnv(bypassEnvContract(), {
        NEXT_PUBLIC_APP_URL: "https://nabaperks.com",
        CUSTOMER_OTP_BYPASS_MODE: "any-4-digits",
      })
    ).not.toThrow()
  })

  it("allows env check without Twilio Verify config when bypass mode is explicit", () => {
    const tempDir = createBypassEnvProject()
    const result = spawnSync(process.execPath, [script("check-env.mjs")], {
      cwd: tempDir,
      encoding: "utf8",
      env: { ...process.env, NODE_ENV: "production" },
    })

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain(
      "Nabaperks environment configuration is valid."
    )
  })

  it("allows Vercel env push without Twilio Verify config when bypass mode is explicit", () => {
    const tempDir = createBypassEnvProject()
    const binDir = join(tempDir, "bin")
    const logPath = join(tempDir, "vercel.log")
    mkdirSync(binDir)
    writeFileSync(
      join(binDir, "pnpm"),
      `#!/bin/sh\nprintf '%s\\n' "$*" >> "$FAKE_VERCEL_LOG"\nexit 0\n`
    )
    chmodSync(join(binDir, "pnpm"), 0o700)

    const result = spawnSync(
      process.execPath,
      [script("env-keys.mjs"), "push-vercel", "production"],
      {
        cwd: tempDir,
        encoding: "utf8",
        env: {
          ...process.env,
          FAKE_VERCEL_LOG: logPath,
          PATH: `${binDir}:${process.env.PATH ?? ""}`,
        },
      }
    )

    expect(result.status, result.stderr).toBe(0)
  })
})

function createBypassEnvProject(): string {
  const tempDir = mkdtempSync(join(tmpdir(), "nabaperks-otp-bypass-"))
  mkdirSync(join(tempDir, "config"), { recursive: true })
  writeFileSync(
    join(tempDir, "config/env-contract.json"),
    JSON.stringify(bypassEnvContract())
  )
  writeFileSync(
    join(tempDir, ".env.local"),
    [
      "NEXT_PUBLIC_APP_URL=https://nabaperks.com",
      "CUSTOMER_OTP_BYPASS_MODE=any-4-digits",
      "",
    ].join("\n")
  )

  return tempDir
}

function bypassEnvContract() {
  return [
    {
      name: "NEXT_PUBLIC_APP_URL",
      visibility: "public",
      kind: "url",
      description: "Canonical app origin.",
    },
    {
      name: "TWILIO_ACCOUNT_SID",
      visibility: "server",
      kind: "string",
      description: "Twilio Account SID.",
    },
    {
      name: "TWILIO_VERIFY_SERVICE_SID",
      visibility: "server",
      kind: "string",
      description: "Twilio Verify Service SID.",
    },
    {
      name: "CUSTOMER_OTP_BYPASS_MODE",
      visibility: "server",
      kind: "string",
      description: "Temporary customer OTP bypass mode.",
      optional: true,
    },
  ] as const
}

function script(name: "check-env.mjs" | "env-keys.mjs"): string {
  return join(projectDir, "scripts", name)
}
