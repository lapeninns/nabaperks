import assert from "node:assert/strict"
import { mkdtemp, mkdir, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, test } from "node:test"

import {
  CleanupScopeError,
  CleanupStepTimeoutError,
  cleanupScope,
  runCleanupSteps,
} from "../e2e/helpers/cleanup-lifecycle.ts"

const temporaryPaths = []

afterEach(async () => {
  await Promise.all(
    temporaryPaths
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true }))
  )
})

test("Given acquired resources When LIFO cleanup has multiple failures Then every step runs and every error is retained", async () => {
  // Given
  const fixtureDir = await createFixtureDir("lifo")
  const scope = cleanupScope("customer-lifo-fixture")
  const events = []
  const firstFailure = new Error("first observed cleanup failure")
  const laterFailure = new Error("later cleanup failure")
  await Promise.all(
    ["first", "middle", "last"].map((name) =>
      writeFile(join(fixtureDir, name), name, "utf8")
    )
  )

  // When
  const failure = await runCleanupSteps(
    scope,
    [
      fileRemovalStep(scope, fixtureDir, "first", events, laterFailure),
      fileRemovalStep(scope, fixtureDir, "middle", events),
      fileRemovalStep(scope, fixtureDir, "last", events, firstFailure),
    ],
    "fixture cleanup failed"
  ).then(
    () => undefined,
    (error) => error
  )

  // Then
  assert.deepEqual(events, ["last", "middle", "first"])
  assert.deepEqual(await readdir(fixtureDir), [])
  assert.ok(failure instanceof AggregateError)
  assert.equal(failure.errors.length, 2)
  assert.equal(failure.errors[0].cause, firstFailure)
  assert.equal(failure.errors[1].cause, laterFailure)
})

test("Given customer, public-QR, admin-MFA, and merchant-auth residue When cleanup continues after failure Then final readback is exactly empty", async () => {
  // Given
  const fixtureDir = await createFixtureDir("families")
  const scope = cleanupScope("task15-owned-fixture")
  const resources = [
    "customer-session",
    "public-qr-code",
    "admin-mfa-factor",
    "merchant-auth-fault",
  ]
  await Promise.all(
    resources.map((name) => writeFile(join(fixtureDir, name), name, "utf8"))
  )
  let readback = ["not-run"]

  // When
  const failure = await runCleanupSteps(
    scope,
    [
      {
        label: "exact zero-residue readback",
        run: async () => {
          readback = await readdir(fixtureDir)
          assert.deepEqual(readback, [])
        },
        scope,
      },
      ...resources.map((name) => ({
        label: `${name} restoration`,
        run: async () => {
          await rm(join(fixtureDir, name))
          if (name === "admin-mfa-factor") {
            throw new Error("injected post-removal failure")
          }
        },
        scope,
      })),
    ],
    "owned fixture cleanup failed"
  ).then(
    () => undefined,
    (error) => error
  )

  // Then
  assert.deepEqual(readback, [])
  assert.ok(failure instanceof AggregateError)
  assert.equal(failure.errors.length, 1)
  assert.match(failure.errors[0].label, /admin-mfa-factor/)
})

test("Given a broad or foreign cleanup scope When steps are registered Then owned state is never touched", async () => {
  // Given
  const fixtureDir = await createFixtureDir("ownership")
  const ownedPath = join(fixtureDir, "owned-state")
  await writeFile(ownedPath, "retained", "utf8")
  const owner = cleanupScope("owner-fixture-one")
  const foreign = cleanupScope("owner-fixture-two")

  // When / Then
  for (const broad of ["*", "all", "global", "../foreign", ""]) {
    assert.throws(() => cleanupScope(broad), CleanupScopeError)
  }
  await assert.rejects(
    runCleanupSteps(
      owner,
      [
        {
          label: "foreign deletion",
          run: async () => rm(ownedPath),
          scope: foreign,
        },
      ],
      "foreign cleanup rejected"
    ),
    (error) =>
      error instanceof AggregateError &&
      error.errors[0]?.cause instanceof CleanupScopeError
  )
  assert.deepEqual(await readdir(fixtureDir), ["owned-state"])
})

test("Given a hung cleanup step When its bound expires Then later LIFO teardown still completes", async () => {
  // Given
  const fixtureDir = await createFixtureDir("timeout")
  const scope = cleanupScope("timeout-owned-fixture")
  const removablePath = join(fixtureDir, "removable")
  await writeFile(removablePath, "fixture", "utf8")

  // When
  const failure = await runCleanupSteps(
    scope,
    [
      {
        label: "later LIFO file removal",
        run: async () => rm(removablePath),
        scope,
      },
      {
        label: "hung provider cleanup",
        run: () => new Promise(() => {}),
        scope,
        timeoutMs: 20,
      },
    ],
    "bounded cleanup failed"
  ).then(
    () => undefined,
    (error) => error
  )

  // Then
  assert.deepEqual(await readdir(fixtureDir), [])
  assert.ok(failure instanceof AggregateError)
  assert.ok(failure.errors[0].cause instanceof CleanupStepTimeoutError)
})

async function createFixtureDir(purpose) {
  const root = await mkdtemp(join(tmpdir(), `nabaperks-task15-${purpose}-`))
  temporaryPaths.push(root)
  const fixtureDir = join(root, "state")
  await mkdir(fixtureDir)
  return fixtureDir
}

function fileRemovalStep(scope, fixtureDir, name, events, failure) {
  return {
    label: `${name} cleanup`,
    run: async () => {
      events.push(name)
      await rm(join(fixtureDir, name))
      if (failure) throw failure
    },
    scope,
  }
}
