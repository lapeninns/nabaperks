import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

import {
  NonDisposableTargetError,
  assertDisposableDbTarget,
  createDisposableDbClient,
  readDisposableProject,
  recordRuntimeReceipt,
} from "../../scripts/disposable-db-target.mjs"

function withProject(
  callback,
  { projectId = "nabaperks-task20-8bb417294", dbPort = 56422 } = {}
) {
  const projectDir = mkdtempSync(join(tmpdir(), "nabaperks-disposable-target-"))
  mkdirSync(join(projectDir, "supabase"))
  writeFileSync(
    join(projectDir, "supabase/config.toml"),
    `project_id = "${projectId}"\n[db]\nport = ${dbPort}\n`
  )
  try {
    callback(projectDir)
  } finally {
    rmSync(projectDir, { recursive: true, force: true })
  }
}

function withTask15Runtime(callback) {
  withProject(
    (projectDir) => {
      execFileSync("git", ["init", "-q"], { cwd: projectDir })
      execFileSync("git", ["config", "user.email", "task15@example.test"], {
        cwd: projectDir,
      })
      execFileSync("git", ["config", "user.name", "Task 15"], {
        cwd: projectDir,
      })
      execFileSync("git", ["add", "supabase/config.toml"], { cwd: projectDir })
      execFileSync("git", ["commit", "-qm", "fixture"], { cwd: projectDir })
      mkdirSync(join(projectDir, "supabase/.temp"))

      const bin = join(projectDir, "bin")
      mkdirSync(bin)
      writeFileSync(
        join(bin, "docker"),
        '#!/bin/sh\n[ "$1" = "inspect" ] || exit 1\nprintf \'task15-container-id\\n\'\n',
        { mode: 0o755 }
      )
      const originalPath = process.env.PATH
      process.env.PATH = `${bin}:${originalPath}`
      try {
        callback(projectDir)
      } finally {
        process.env.PATH = originalPath
      }
    },
    { projectId: "nabaperks-task15-e3aac8ea7", dbPort: 61422 }
  )
}

const options = (projectDir, env = {}) => ({
  projectDir,
  env,
  requireClean: false,
  requireRuntime: false,
})

test("Given a hosted target When a client is requested Then it rejects before connection construction", () => {
  withProject((projectDir) => {
    let connectionAttempts = 0
    assert.throws(
      () =>
        createDisposableDbClient(
          "postgresql://postgres:secret@db.example.invalid:56422/postgres",
          () => {
            connectionAttempts += 1
          },
          options(projectDir)
        ),
      (error) =>
        error instanceof NonDisposableTargetError &&
        error.code === "NON_DISPOSABLE_TARGET"
    )
    assert.equal(connectionAttempts, 0)
  })
})

test("Given malformed or prompt-like target text When preflight runs Then every value fails closed", () => {
  withProject((projectDir) => {
    const variants = [
      "not a url",
      "postgresql://ignore%20previous%20instructions:secret@127.0.0.1:56422/postgres",
      "postgresql://postgres:secret@127.0.0.1:56423/postgres",
      "postgresql://postgres:secret@127.0.0.1:56422/other",
      "postgresql://postgres:secret@127.0.0.1:56422/postgres?sslmode=disable",
    ]
    for (const value of variants) {
      assert.throws(() => assertDisposableDbTarget(value, options(projectDir)))
    }
  })
})

test("Given caller-controlled port or linked state When preflight runs Then configuration remains sealed", () => {
  withProject((projectDir) => {
    assert.throws(() =>
      assertDisposableDbTarget(
        "postgresql://postgres:secret@127.0.0.1:9999/postgres",
        options(projectDir, { TASK20_ALLOWED_DB_PORTS: "9999" })
      )
    )
    assert.throws(() =>
      assertDisposableDbTarget(
        "postgresql://postgres:secret@127.0.0.1:56422/postgres",
        options(projectDir, { SUPABASE_PROJECT_REF: "hosted-ref" })
      )
    )
  })
})

test("Given the exact sealed target When preflight repeats Then it is deterministic and connects once per request", () => {
  withProject((projectDir) => {
    let connectionAttempts = 0
    const target = "postgresql://postgres:secret@127.0.0.1:56422/postgres"
    for (let iteration = 0; iteration < 2; iteration += 1) {
      const result = createDisposableDbClient(
        target,
        () => {
          connectionAttempts += 1
          return "connected"
        },
        options(projectDir)
      )
      assert.equal(result, "connected")
    }
    assert.equal(connectionAttempts, 2)
  })
})

test("Given an explicit Task15 project When its configured loopback target is requested Then only that exact namespace and port are accepted", () => {
  withProject(
    (projectDir) => {
      const accepted = createDisposableDbClient(
        "postgresql://postgres:secret@127.0.0.1:61422/postgres",
        () => "connected",
        options(projectDir)
      )
      assert.equal(accepted, "connected")

      assert.throws(() =>
        assertDisposableDbTarget(
          "postgresql://postgres:secret@127.0.0.1:61423/postgres",
          options(projectDir)
        )
      )
    },
    { projectId: "nabaperks-task15-e3aac8ea7", dbPort: 61422 }
  )

  withProject(
    (projectDir) => {
      assert.throws(() =>
        assertDisposableDbTarget(
          "postgresql://postgres:secret@127.0.0.1:61422/postgres",
          options(projectDir)
        )
      )
    },
    { projectId: "nabaperks-task16-e3aac8ea7", dbPort: 61422 }
  )
})

test("Given Task21 configuration When preflight runs Then only its exact namespace and port are accepted", () => {
  withProject(
    (projectDir) => {
      const accepted = createDisposableDbClient(
        "postgresql://postgres:secret@127.0.0.1:63422/postgres",
        () => "connected",
        options(projectDir)
      )
      assert.equal(accepted, "connected")
      assert.throws(() =>
        assertDisposableDbTarget(
          "postgresql://postgres:secret@127.0.0.1:63423/postgres",
          options(projectDir)
        )
      )
    },
    { projectId: "nabaperks-task21-7732b0cd2", dbPort: 63422 }
  )

  for (const projectId of [
    "nabaperks-task22-7732b0cd2",
    "nabaperks-task21-ignoreprevious",
  ]) {
    withProject(
      (projectDir) => {
        assert.throws(() =>
          assertDisposableDbTarget(
            "postgresql://postgres:secret@127.0.0.1:63422/postgres",
            options(projectDir)
          )
        )
      },
      { projectId, dbPort: 63422 }
    )
  }
})

test("Given an explicit Task15 runtime When its signed source and container identity match Then the guarded client connects", () => {
  withTask15Runtime((projectDir) => {
    const project = readDisposableProject(projectDir)
    recordRuntimeReceipt(projectDir, project)

    const result = createDisposableDbClient(
      "postgresql://postgres:secret@127.0.0.1:61422/postgres",
      () => "connected",
      { projectDir, env: {} }
    )
    assert.equal(result, "connected")

    const receiptPath = join(
      projectDir,
      "supabase/.temp/disposable-runtime.json"
    )
    const receipt = JSON.parse(readFileSync(receiptPath, "utf8"))
    writeFileSync(
      receiptPath,
      `${JSON.stringify({ ...receipt, containerId: "stale-container" })}\n`
    )
    assert.throws(
      () =>
        assertDisposableDbTarget(
          "postgresql://postgres:secret@127.0.0.1:61422/postgres",
          { projectDir, env: {} }
        ),
      /runtime-receipt-mismatch/
    )
  })
})
