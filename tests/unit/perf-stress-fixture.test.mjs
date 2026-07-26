import assert from "node:assert/strict"
import test from "node:test"

import { parseStressFixture } from "../../scripts/perf-stress-fixture.mjs"

const stressFixture = {
  business_name: "Old Crown Girton",
  owner_email: "priya.patel@example.test",
  members: 10_000,
  events: 50_000,
}

test("uses the authoritative seeded merchant owner instead of a pinned email", () => {
  assert.deepEqual(parseStressFixture(stressFixture), {
    businessName: "Old Crown Girton",
    ownerEmail: "priya.patel@example.test",
    members: 10_000,
    events: 50_000,
  })
})

test("normalises the owner email received at the database boundary", () => {
  assert.equal(
    parseStressFixture({
      ...stressFixture,
      owner_email: "  MIA@OLD-CROWN-GIRTON.TEST ",
    }).ownerEmail,
    "mia@old-crown-girton.test"
  )
})

test("rejects a fixture without an owner email", () => {
  assert.throws(
    () => parseStressFixture({ ...stressFixture, owner_email: null }),
    /has no owner email/
  )
})

test("retains the stress-member precondition", () => {
  assert.throws(
    () => parseStressFixture({ ...stressFixture, members: 999 }),
    /Only 999 members found/
  )
})
