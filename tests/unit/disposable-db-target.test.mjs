import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

import {
  NonDisposableTargetError,
  assertDisposableDbTarget,
  createDisposableDbClient,
} from "../../scripts/disposable-db-target.mjs"

function withProject(callback) {
  const projectDir = mkdtempSync(join(tmpdir(), "nabaperks-disposable-target-"))
  mkdirSync(join(projectDir, "supabase"))
  writeFileSync(
    join(projectDir, "supabase/config.toml"),
    'project_id = "nabaperks-task20-8bb417294"\n[db]\nport = 56422\n'
  )
  try {
    callback(projectDir)
  } finally {
    rmSync(projectDir, { recursive: true, force: true })
  }
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
