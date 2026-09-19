import assert from "node:assert/strict"
import { test } from "node:test"

import { ukTodayIso } from "@/lib/customer/uk-calendar"
import * as ukDate from "@/lib/customer/uk-date"

test("the legacy UK date module exposes only the shared London calendar date", () => {
  assert.deepEqual(Object.keys(ukDate), ["ukTodayIso"])
  assert.equal(ukDate.ukTodayIso(), ukTodayIso())
})
