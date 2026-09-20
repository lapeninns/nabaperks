import assert from "node:assert/strict"
import { test } from "node:test"

import {
  buildCollectionWindowDrafts,
  collectionWindowError,
  parseCollectionWindows,
  parseVenueClosure,
  quietLunchPreset,
} from "@/lib/merchant/collection-window-fields"

const locationId = "00000000-0000-4000-8000-000000000001"
const upgradeId = "00000000-0000-4000-8000-000000000002"
const window = {
  isodow: 1,
  startsAt: "12:00",
  endsAt: "15:00",
  upgradePoolItemId: upgradeId,
  isActive: true,
}
const closure = {
  locationId,
  startsAt: "2026-07-01T12:00",
  endsAt: "2026-07-03T15:00",
  reason: " Kitchen repair ",
}

test("Given an enabled quarter-hour window When parsed Then the RPC payload retains the upgrade and location", () => {
  assert.deepEqual(parseCollectionWindows([window], locationId), {
    windows: [
      {
        location_id: locationId,
        isodow: 1,
        starts_at: "12:00",
        ends_at: "15:00",
        upgrade_pool_item_id: upgradeId,
        is_active: true,
      },
    ],
  })
})

test("Given a new venue When drafts are built Then all seven days remain disabled", () => {
  const drafts = buildCollectionWindowDrafts([])
  assert.deepEqual(
    drafts.map((row) => row.isodow),
    [1, 2, 3, 4, 5, 6, 7]
  )
  assert.equal(
    drafts.some((row) => row.isActive),
    false
  )
})

test("Given multiple windows on one day When drafts are built Then every active interval is retained", () => {
  const drafts = buildCollectionWindowDrafts([
    {
      id: "first",
      isodow: 1,
      starts_at: "12:00:00",
      ends_at: "15:00:00",
      upgrade_pool_item_id: upgradeId,
      is_active: true,
    },
    {
      id: "second",
      isodow: 1,
      starts_at: "18:00:00",
      ends_at: "21:00:00",
      upgrade_pool_item_id: null,
      is_active: true,
    },
  ])
  assert.deepEqual(
    drafts.filter((row) => row.isodow === 1).map((row) => row.startsAt),
    ["12:00", "18:00"]
  )
})

test("Given the quiet lunch preset When applied Then only Monday to Thursday run from noon to three", () => {
  assert.deepEqual(
    parseCollectionWindows(quietLunchPreset(), locationId).windows?.map(
      (row) => [row.isodow, row.starts_at, row.ends_at]
    ),
    [
      [1, "12:00", "15:00"],
      [2, "12:00", "15:00"],
      [3, "12:00", "15:00"],
      [4, "12:00", "15:00"],
    ]
  )
})

test("Given disabled rows When parsed Then they are omitted so removing every window is supported", () => {
  assert.deepEqual(
    parseCollectionWindows([{ ...window, isActive: false }], locationId),
    { windows: [] }
  )
})

for (const bad of [
  null,
  {},
  [{ ...window, isodow: 0 }],
  [{ ...window, isodow: 8 }],
  [{ ...window, startsAt: "12:07" }],
  [{ ...window, startsAt: "24:00" }],
  [{ ...window, isActive: "false" }],
]) {
  test(`Given malformed window ${JSON.stringify(bad)} When parsed Then NBW02 refuses it`, () => {
    assert.equal(parseCollectionWindows(bad, locationId).code, "NBW02")
  })
}

for (const [startsAt, endsAt] of [
  ["12:00", "12:15"],
  ["12:00", "12:00"],
  ["23:00", "01:00"],
]) {
  test(`Given ${startsAt} to ${endsAt} When parsed Then NBW03 refuses a short or crossing window`, () => {
    assert.equal(
      parseCollectionWindows([{ ...window, startsAt, endsAt }], locationId)
        .code,
      "NBW03"
    )
  })
}

test("Given an overlap on one day When parsed Then NBW01 refuses it", () => {
  assert.equal(
    parseCollectionWindows(
      [window, { ...window, startsAt: "14:45", endsAt: "16:00" }],
      locationId
    ).code,
    "NBW01"
  )
})

test("Given adjacent windows and a midnight end When parsed Then both are allowed", () => {
  assert.equal(
    parseCollectionWindows(
      [window, { ...window, startsAt: "15:00", endsAt: "24:00" }],
      locationId
    ).windows?.length,
    2
  )
})

test("Given an invalid upgrade identifier When parsed Then NBW04 refuses it", () => {
  assert.equal(
    parseCollectionWindows(
      [{ ...window, upgradePoolItemId: "foreign" }],
      locationId
    ).code,
    "NBW04"
  )
})

test("Given a British summer closure When parsed Then UK wall times become UTC and reason is trimmed", () => {
  assert.deepEqual(parseVenueClosure(closure).closure, {
    locationId,
    startsAt: "2026-07-01T11:00:00.000Z",
    endsAt: "2026-07-03T14:00:00.000Z",
    reason: "Kitchen repair",
  })
})

test("Given a winter closure When parsed Then its clock time stays UTC", () => {
  assert.equal(
    parseVenueClosure({
      ...closure,
      startsAt: "2026-12-01T12:00",
      endsAt: "2026-12-02T12:00",
    }).closure?.startsAt,
    "2026-12-01T12:00:00.000Z"
  )
})

for (const startsAt of [
  "2026-03-29T01:30",
  "2026-10-25T01:30",
  "2026-02-30T12:00",
  "invalid",
]) {
  test(`Given invalid or ambiguous UK time ${startsAt} When parsed Then the closure start has an error`, () => {
    assert.ok(parseVenueClosure({ ...closure, startsAt }).errors?.startsAt)
  })
}

for (const overrides of [
  { endsAt: closure.startsAt },
  { reason: " " },
  { reason: "x".repeat(201) },
  { endsAt: "2027-01-01T12:00" },
  { locationId: "other" },
]) {
  test(`Given invalid closure fields ${JSON.stringify(overrides)} When parsed Then saving is refused`, () => {
    assert.ok(parseVenueClosure({ ...closure, ...overrides }).errors)
    assert.equal(
      parseVenueClosure({ ...closure, ...overrides }).closure,
      undefined
    )
  })
}

test("Given an exact 90-day closure When parsed Then the duration is accepted", () => {
  assert.ok(
    parseVenueClosure({
      ...closure,
      startsAt: "2026-01-01T12:00",
      endsAt: "2026-04-01T13:00",
    }).closure
  )
})

test("Given database errors When presented Then every NBW code has distinct actionable feedback", () => {
  const codes = ["NBW01", "NBW02", "NBW03", "NBW04", "NBW05", "NBW06", "NBW07"]
  const messages = codes.map(collectionWindowError)
  assert.equal(new Set(messages).size, codes.length)
  for (const message of messages) assert.ok(message.length > 10)
  assert.ok(collectionWindowError("unexpected"))
})
