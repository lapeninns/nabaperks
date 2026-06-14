import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { describe, expect, it } from "vitest"

const projectDir = process.cwd()

describe("production Vercel env guard", () => {
  it("rejects localhost app origins before pushing production env", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "nabaperks-vercel-env-"))
    const binDir = join(tempDir, "bin")
    const logPath = join(tempDir, "vercel.log")
    mkdirSync(join(tempDir, "config"), { recursive: true })
    mkdirSync(binDir)
    writeFileSync(
      join(tempDir, "config/env-contract.json"),
      JSON.stringify([
        {
          name: "NEXT_PUBLIC_APP_URL",
          visibility: "public",
          kind: "url",
          description: "Canonical app origin.",
        },
      ])
    )
    writeFileSync(
      join(tempDir, ".env.local"),
      "NEXT_PUBLIC_APP_URL=http://localhost:3000\n"
    )
    const fakePnpm = join(binDir, "pnpm")
    writeFileSync(
      fakePnpm,
      `#!/bin/sh\nprintf '%s\\n' "$*" >> "$FAKE_VERCEL_LOG"\nexit 0\n`
    )
    chmodSync(fakePnpm, 0o700)

    const result = spawnSync(
      process.execPath,
      [join(projectDir, "scripts/env-keys.mjs"), "push-vercel", "production"],
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

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain("NEXT_PUBLIC_APP_URL")
    expect(result.stderr).toContain("production")
    expect(existsSync(logPath)).toBe(false)
  })

  it("passes env values explicitly when adding Vercel variables", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "nabaperks-vercel-env-"))
    const binDir = join(tempDir, "bin")
    const logPath = join(tempDir, "vercel.log")
    mkdirSync(join(tempDir, "config"), { recursive: true })
    mkdirSync(binDir)
    writeFileSync(
      join(tempDir, "config/env-contract.json"),
      JSON.stringify([
        {
          name: "NEXT_PUBLIC_APP_URL",
          visibility: "public",
          kind: "url",
          description: "Canonical app origin.",
        },
        {
          name: "TWILIO_VERIFY_SERVICE_SID",
          visibility: "server",
          kind: "string",
          description: "Twilio Verify service.",
        },
      ])
    )
    writeFileSync(
      join(tempDir, ".env.local"),
      [
        "NEXT_PUBLIC_APP_URL=https://nabaperks.com",
        "TWILIO_VERIFY_SERVICE_SID=VA123",
        "",
      ].join("\n")
    )
    const fakePnpm = join(binDir, "pnpm")
    writeFileSync(
      fakePnpm,
      [
        "#!/bin/sh",
        "stdin_file=$(mktemp)",
        'cat > "$stdin_file"',
        "stdin_bytes=$(wc -c < \"$stdin_file\" | tr -d ' ')",
        'printf \'args=%s stdin_bytes=%s\\n\' "$*" "$stdin_bytes" >> "$FAKE_VERCEL_LOG"',
        'rm -f "$stdin_file"',
        "exit 0",
        "",
      ].join("\n")
    )
    chmodSync(fakePnpm, 0o700)

    const result = spawnSync(
      process.execPath,
      [join(projectDir, "scripts/env-keys.mjs"), "push-vercel", "production"],
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
    const log = readFileSync(logPath, "utf8")

    expect(log).toContain(
      "dlx vercel env add TWILIO_VERIFY_SERVICE_SID production --value VA123 --yes"
    )
    expect(log).toContain("stdin_bytes=0")
  })

  it("strips surrounding quotes from .env.local values before pushing", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "nabaperks-vercel-env-"))
    const binDir = join(tempDir, "bin")
    const logPath = join(tempDir, "vercel.log")
    mkdirSync(join(tempDir, "config"), { recursive: true })
    mkdirSync(binDir)
    writeFileSync(
      join(tempDir, "config/env-contract.json"),
      JSON.stringify([
        {
          name: "NEXT_PUBLIC_APP_URL",
          visibility: "public",
          kind: "url",
          description: "Canonical app origin.",
        },
        {
          name: "TWILIO_API_KEY_SID",
          visibility: "server",
          kind: "string",
          description: "Twilio API key SID.",
        },
      ])
    )
    writeFileSync(
      join(tempDir, ".env.local"),
      [
        "NEXT_PUBLIC_APP_URL=https://nabaperks.com",
        'TWILIO_API_KEY_SID="SK123"',
        "",
      ].join("\n")
    )
    const fakePnpm = join(binDir, "pnpm")
    writeFileSync(
      fakePnpm,
      `#!/bin/sh\nprintf '%s\\n' "$*" >> "$FAKE_VERCEL_LOG"\nexit 0\n`
    )
    chmodSync(fakePnpm, 0o700)

    const result = spawnSync(
      process.execPath,
      [join(projectDir, "scripts/env-keys.mjs"), "push-vercel", "production"],
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
    const log = readFileSync(logPath, "utf8")

    expect(log).toContain(
      "dlx vercel env add TWILIO_API_KEY_SID production --value SK123 --yes"
    )
    expect(log).not.toContain('"SK123"')
  })
})
