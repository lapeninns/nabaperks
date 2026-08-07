import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import {
  detectDuplicateVersions,
  findEditedAppliedMigrations,
} from "../../scripts/check-supabase-migrations.mjs"

/**
 * db emergency containment — Blocker 3, tooling half.
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

test("Given an approved migration edit When both hashes match Then the edit is sanctioned", () => {
  const baseline = [{ version: "20260102000000", sha: "bbb" }]
  const current = [{ version: "20260102000000", sha: "CHANGED" }]

  assert.deepEqual(
    findEditedAppliedMigrations({
      baseline,
      current,
      sanctioned: [
        {
          version: "20260102000000",
          baselineSha: "bbb",
          currentSha: "CHANGED",
        },
      ],
    }),
    []
  )
})

test("Given a later migration edit When its hash differs Then the sanction no longer applies", () => {
  const baseline = [{ version: "20260102000000", sha: "bbb" }]
  const current = [{ version: "20260102000000", sha: "LATER-EDIT" }]

  assert.deepEqual(
    findEditedAppliedMigrations({
      baseline,
      current,
      sanctioned: [
        {
          version: "20260102000000",
          baselineSha: "bbb",
          currentSha: "CHANGED",
        },
      ],
    }),
    ["20260102000000"]
  )
})

test("Given a legacy null Stripe status When the pilot backfill runs Then it stays awaiting delivery", () => {
  const migration = readFileSync(
    "supabase/migrations/20260802130000_delivery_anchored_pilot.sql",
    "utf8"
  )

  assert.match(
    migration,
    /when billing\.stripe_subscription_status is null\s+then 'awaiting_delivery'/
  )
})
