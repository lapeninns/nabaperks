import assert from "node:assert/strict"
import { test } from "node:test"

import {
  dateOfBirthForIndex,
  earnedBusinessDateFor,
  joinedAtForIndex,
  lastVisitAtForIndex,
  parseArgs,
  stampCreatedAtFor,
  stressCustomerId,
  stressDayOffsetFor,
  stressEmail,
  stressMembershipId,
  STRESS_HISTORY_DAYS,
} from "../../scripts/seed-stress.mjs"

test("parseArgs defaults to 10k members with events enabled", () => {
  const args = parseArgs([])

  assert.equal(args.count, 10_000)
  assert.equal(args.batch, 1_000)
  assert.equal(args.stampsPerMember, 1)
  assert.equal(args.withEvents, true)
  assert.equal(args.clean, false)
})

test("parseArgs supports clean-only mode", () => {
  const args = parseArgs(["--clean"])

  assert.equal(args.clean, true)
  assert.equal(args.count, 0)
})

test("stress seed ids and emails are deterministic", () => {
  assert.equal(stressEmail(42), "stress+42@example.test")
  assert.equal(stressCustomerId(1), "a0000000-0000-4000-8000-000000000001")
  assert.equal(stressMembershipId(10), "b0000000-0000-4000-8000-00000000000a")
})

test("stress seed dates spread across the history window", () => {
  assert.equal(STRESS_HISTORY_DAYS, 540)

  const join1 = joinedAtForIndex(1)
  const join2 = joinedAtForIndex(2)
  const joinWide = joinedAtForIndex(999)

  assert.notEqual(join1.toISOString(), join2.toISOString())
  assert.notEqual(join1.getUTCHours(), 12)
  assert.ok(stressDayOffsetFor(999, 0) < STRESS_HISTORY_DAYS)
  assert.ok(joinWide < new Date())

  const stampJoin = stampCreatedAtFor(42, 0, join1)
  const stampReturn = stampCreatedAtFor(42, 1, join1)
  assert.ok(stampJoin >= join1)
  assert.notEqual(
    earnedBusinessDateFor(42, 0),
    earnedBusinessDateFor(42, 1)
  )

  const lastVisit = lastVisitAtForIndex(10, join1, [stampJoin, stampReturn])
  assert.ok(lastVisit >= stampReturn)

  assert.notEqual(dateOfBirthForIndex(1), dateOfBirthForIndex(2))
})
