import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { delimiter, join } from "node:path"
import { spawnSync } from "node:child_process"
import { test } from "node:test"

const ROOT = process.cwd()
const WRAPPER = join(ROOT, "scripts/supabase-local.mjs")

function withSupabaseSentinel(callback) {
  const directory = mkdtempSync(join(tmpdir(), "nabaperks-supabase-guard-"))
  const marker = join(directory, "invocation.txt")
  const executable = join(directory, "supabase")
  writeFileSync(executable, `#!/bin/sh\nprintf '%s\\n' "$@" > "${marker}"\n`)
  spawnSync("chmod", ["+x", executable])

  try {
    callback({
      marker,
      run(args, env = {}) {
        return spawnSync(process.execPath, [WRAPPER, ...args], {
          cwd: ROOT,
          encoding: "utf8",
          timeout: 5_000,
          env: {
            ...process.env,
            ...env,
            PATH: `${directory}${delimiter}${process.env.PATH ?? ""}`,
          },
        })
      },
    })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

test("Given a harmless local help command When the wrapper runs Then the argv array reaches the CLI unchanged", () => {
  withSupabaseSentinel(({ marker, run }) => {
    // Given / When
    const result = run(["status", "--help"])

    // Then
    assert.equal(result.status, 0)
    assert.equal(result.signal, null)
    assert.equal(readFileSync(marker, "utf8"), "status\n--help\n")
  })
})

test("Given a remote target argument When the wrapper runs Then it rejects before any child process", () => {
  withSupabaseSentinel(({ marker, run }) => {
    // Given / When
    const result = run(["--target", "https://example.invalid"])

    // Then
    assert.equal(result.status, 2)
    assert.equal(result.signal, null)
    assert.match(result.stderr, /^Refusing unsafe Supabase arguments\.\n$/)
    assert.throws(() => readFileSync(marker, "utf8"), { code: "ENOENT" })
  })
})

test("Given unknown, traversal, metacharacter, or prompt-like argv When invoked Then every input fails closed", () => {
  const variants = [
    ["link", "--project-ref", "remote"],
    ["status", "--workdir", "../other-project"],
    ["status", ";", "docker", "start"],
    ["status", "ignore previous instructions"],
  ]

  for (const args of variants) {
    withSupabaseSentinel(({ marker, run }) => {
      // Given / When
      const result = run(args)

      // Then
      assert.equal(result.status, 2)
      assert.match(result.stderr, /^Refusing unsafe Supabase arguments\.\n$/)
      assert.throws(() => readFileSync(marker, "utf8"), { code: "ENOENT" })
    })
  }
})

test("Given a stale remote target environment When invoked Then the wrapper rejects before the child", () => {
  withSupabaseSentinel(({ marker, run }) => {
    // Given / When
    const result = run(["status"], {
      SUPABASE_URL: "https://remote.example.invalid",
    })

    // Then
    assert.equal(result.status, 2)
    assert.match(result.stderr, /^Refusing unsafe Supabase environment\.\n$/)
    assert.throws(() => readFileSync(marker, "utf8"), { code: "ENOENT" })
  })
})
