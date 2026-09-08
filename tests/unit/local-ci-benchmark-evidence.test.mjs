import assert from "node:assert/strict"
import { test } from "node:test"
import { collectBrowserEvidence } from "../../ops/local-ci/benchmark.mjs"
import { laneBrowserReports } from "../../ops/local-ci/agent/runner.mjs"
const lanes = [
  {
    id: "e2e-chromium",
    env: { LOCAL_CI_BROWSER_JSON: "1" },
    commands: [
      "node scripts/ci/browser-workload.mjs --project=chromium --shard=1/8",
      "node scripts/ci/browser-workload.mjs --project=chromium --shard=2/8",
    ],
  },
]
const names = lanes.flatMap(laneBrowserReports).map((x) => x.stored)
const valid = JSON.stringify({
  errors: [],
  suites: [
    {
      title: "suite",
      specs: [
        {
          file: "test.ts",
          title: "works",
          tests: [
            {
              projectName: "chromium",
              status: "expected",
              results: [{ status: "passed" }],
            },
          ],
        },
      ],
    },
  ],
})
const collect = (files, read = () => valid) =>
  collectBrowserEvidence({ lanes, names: files, read }).reportEvidence

test("qualification requires every declared report and rejects missing, extra or corrupt evidence", () => {
  assert.equal(collect(names).valid, true)
  for (const files of [
    [],
    names.slice(0, 1),
    [...names, "extra.local-ci-report.json"],
  ])
    assert.equal(collect(files).valid, false)
  for (const body of [
    "{",
    "{}",
    '{"suites":[]}',
    '{"suites":[],"errors":[{}]}',
  ])
    assert.equal(
      collect(names, (name) => (name === names[0] ? body : valid)).valid,
      false
    )
  assert.equal(
    collectBrowserEvidence({ lanes: [], names: [], read: () => valid })
      .reportEvidence.valid,
    false
  )
})
