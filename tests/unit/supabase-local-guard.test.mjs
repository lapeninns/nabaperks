import assert from "node:assert/strict"
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { delimiter, join } from "node:path"
import { spawnSync } from "node:child_process"
import { test } from "node:test"

const ROOT = process.cwd()
const WRAPPER = join(ROOT, "scripts/supabase-local.mjs")

function withSupabaseSentinel(
  callback,
  { delaySeconds = 0, exitCode = 0 } = {}
) {
  const directory = mkdtempSync(join(tmpdir(), "nabaperks-supabase-guard-"))
  const marker = join(directory, "invocation.txt")
  const executable = join(directory, "supabase")
  const dockerExecutable = join(directory, "docker")
  const projectDirectory = join(directory, "project")
  mkdirSync(join(projectDirectory, "supabase"), { recursive: true })
  writeFileSync(
    join(projectDirectory, "supabase/config.toml"),
    'project_id = "nabaperks-task20-abcdef123"\n\n[db]\nport = 65432\n'
  )
  writeFileSync(
    executable,
    `#!/bin/sh\nsleep ${delaySeconds}\nprintf '%s\\n' "$@" > "${marker}"\nexit ${exitCode}\n`
  )
  writeFileSync(dockerExecutable, "#!/bin/sh\nexit 1\n")
  spawnSync("chmod", ["+x", executable, dockerExecutable])
  spawnSync("git", ["init", "-q"], { cwd: projectDirectory })
  spawnSync("git", ["add", "supabase/config.toml"], { cwd: projectDirectory })
  spawnSync(
    "git",
    [
      "-c",
      "user.name=Nabaperks Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "-qm",
      "test fixture",
    ],
    { cwd: projectDirectory }
  )

  const safeEnvironment = { ...process.env }
  for (const key of [
    "DATABASE_URL",
    "SUPABASE_ACCESS_TOKEN",
    "SUPABASE_DB_URL",
    "SUPABASE_PROJECT_ID",
    "SUPABASE_PROJECT_REF",
    "SUPABASE_URL",
  ]) {
    delete safeEnvironment[key]
  }

  try {
    callback({
      marker,
      run(args, env = {}, timeout = 5_000) {
        return spawnSync(process.execPath, [WRAPPER, ...args], {
          cwd: projectDirectory,
          encoding: "utf8",
          timeout,
          env: {
            ...safeEnvironment,
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

test(
  "Given a cold local start exceeds ten seconds When the wrapper runs Then it waits for the CLI result",
  { timeout: 35_000 },
  () => {
    withSupabaseSentinel(
      ({ marker, run }) => {
        // Given / When
        const result = run(["start"], {}, 30_000)

        // Then
        assert.equal(result.status, 7)
        assert.equal(result.signal, null)
        assert.equal(readFileSync(marker, "utf8"), "start\n")
      },
      { delaySeconds: 11, exitCode: 7 }
    )
  }
)
