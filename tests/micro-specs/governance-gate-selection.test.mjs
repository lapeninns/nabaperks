import assert from "node:assert/strict"
import { test } from "node:test"

import {
  gateUnionForSpecs,
  parseGateRunnerArgs,
  selectGateSpecs,
} from "../../scripts/governance-gate-selection.mjs"

const spec = (id, status, gates = []) => ({
  metadata: {
    spec_id: id,
    status,
    verification_gates: gates,
  },
})

test("Given repeated spec flags When runner arguments are parsed Then every unique spec is selected in request order", () => {
  assert.deepEqual(
    parseGateRunnerArgs([
      "--spec",
      "MS-one",
      "--record",
      "--spec",
      "MS-two",
      "--spec",
      "MS-one",
    ]),
    {
      record: true,
      specIds: ["MS-one", "MS-two"],
    }
  )
})

test("Given no explicit specs When targets are selected Then only active specs are returned", () => {
  const specs = [
    spec("MS-active", "active"),
    spec("MS-implemented", "implemented"),
  ]

  assert.deepEqual(selectGateSpecs(specs, []).map(idOf), ["MS-active"])
})

test("Given explicit specs in different lifecycle states When targets are selected Then request order is preserved", () => {
  const specs = [
    spec("MS-active", "active"),
    spec("MS-implemented", "implemented"),
  ]

  assert.deepEqual(
    selectGateSpecs(specs, ["MS-implemented", "MS-active"]).map(idOf),
    ["MS-implemented", "MS-active"]
  )
})

test("Given an unknown option or incomplete spec flag When arguments are parsed Then usage errors are raised", () => {
  assert.throws(() => parseGateRunnerArgs(["--wat"]), /Unknown option "--wat"/)
  assert.throws(() => parseGateRunnerArgs(["--spec"]), /requires a Micro-Spec id/)
  assert.throws(
    () => parseGateRunnerArgs(["--spec", "--record"]),
    /requires a Micro-Spec id/
  )
})

test("Given an unknown requested spec When targets are selected Then every missing id is reported", () => {
  assert.throws(
    () =>
      selectGateSpecs(
        [spec("MS-known", "implemented")],
        ["MS-missing-one", "MS-known", "MS-missing-two"]
      ),
    /MS-missing-one, MS-missing-two/
  )
})

test("Given overlapping spec gates When their union is built Then exact commands execute once in first-seen order", () => {
  const specs = [
    spec("MS-one", "implemented", ["pnpm test", "pnpm test:e2e -- --grep one"]),
    spec("MS-two", "implemented", [
      "pnpm test",
      "pnpm test:e2e -- --grep two",
      "pnpm typecheck",
    ]),
  ]

  assert.deepEqual(gateUnionForSpecs(specs), [
    "pnpm test",
    "pnpm test:e2e -- --grep one",
    "pnpm test:e2e -- --grep two",
    "pnpm typecheck",
  ])
})

function idOf(value) {
  return value.metadata.spec_id
}
