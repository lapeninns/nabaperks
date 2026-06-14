import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
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
})
