import assert from "node:assert/strict"
import { test } from "node:test"

import {
  detectDuplicateVersions,
  findEditedAppliedMigrations,
} from "../../scripts/check-supabase-migrations.mjs"

/**
 * MS-db-emergency-containment — Blocker 3, tooling half.
 *
 * The parity checker only compared version-number SETS, so it could not see
 * two files sharing a version, nor an already-applied migration whose body was
 * later edited (exactly how `email_hmac` and the consent ACL drifted). These
 * pure functions add both detections and are unit-covered here.
 */

test("detectDuplicateVersions reports versions used by more than one file", () => {
  assert.deepEqual(detectDuplicateVersions([]), [])
  assert.deepEqual(
    detectDuplicateVersions(["20260101000000", "20260102000000"]),
    []
  )
  assert.deepEqual(
    detectDuplicateVersions([
      "20260101000000",
      "20260101000000",
      "20260102000000",
    ]),
    ["20260101000000"]
  )
})

test("detectDuplicateVersions returns each duplicated version once, sorted", () => {
  assert.deepEqual(
    detectDuplicateVersions([
      "20260103000000",
      "20260101000000",
      "20260103000000",
      "20260101000000",
      "20260101000000",
    ]),
    ["20260101000000", "20260103000000"]
  )
})

test("findEditedAppliedMigrations flags a changed already-applied file", () => {
  const baseline = [
    { version: "20260101000000", sha: "aaa" },
    { version: "20260102000000", sha: "bbb" },
  ]
  const current = [
    { version: "20260101000000", sha: "aaa" },
    { version: "20260102000000", sha: "CHANGED" },
  ]

  assert.deepEqual(
    findEditedAppliedMigrations({ baseline, current, sanctioned: [] }),
    ["20260102000000"]
  )
})

test("findEditedAppliedMigrations ignores new and removed files", () => {
  const baseline = [{ version: "20260101000000", sha: "aaa" }]
  const current = [
    { version: "20260101000000", sha: "aaa" },
    { version: "20260201000000", sha: "new" },
  ]

  assert.deepEqual(
    findEditedAppliedMigrations({ baseline, current, sanctioned: [] }),
    []
  )
})

test("findEditedAppliedMigrations honours the sanctioned-edit allowlist", () => {
  const baseline = [{ version: "20260102000000", sha: "bbb" }]
  const current = [{ version: "20260102000000", sha: "CHANGED" }]

  assert.deepEqual(
    findEditedAppliedMigrations({
      baseline,
      current,
      sanctioned: ["20260102000000"],
    }),
    []
  )
})
