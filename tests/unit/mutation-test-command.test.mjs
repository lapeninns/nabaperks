import assert from "node:assert/strict"
import { readdirSync } from "node:fs"
import { test } from "node:test"

import { runMutationTests } from "../../scripts/run-mutation-tests.mjs"

test("a survivor is checked against every unit test, including newly added files", () => {
  const commands = []
  const files = [...readdirSync("tests/unit"), "future-coverage.test.mjs"]
  assert.equal(
    runMutationTests({
      list: () => files,
      run: (_command, args) => {
        commands.push(args)
        return { status: 0 }
      },
    }),
    0
  )
  assert.equal(commands.length, 2)
  assert.deepEqual(
    commands[1].filter((arg) => arg.endsWith(".test.mjs")),
    files
      .filter((name) => name.endsWith(".test.mjs"))
      .sort()
      .map((name) => `tests/unit/${name}`)
  )
})

test("an already detected mutant stops without launching the full suite", () => {
  let calls = 0
  assert.equal(
    runMutationTests({
      run: () => {
        calls++
        return { status: 1 }
      },
    }),
    1
  )
  assert.equal(calls, 1)
})

test("a full-suite failure still detects a mutant after focused tests pass", () => {
  let calls = 0
  assert.equal(
    runMutationTests({ run: () => ({ status: ++calls === 1 ? 0 : 1 }) }),
    1
  )
  assert.equal(calls, 2)
})

test("missing tests and interrupted or failed commands never report success", () => {
  assert.throws(() => runMutationTests({ list: () => [] }), /inventory/)
  assert.throws(
    () =>
      runMutationTests({ run: () => ({ error: new Error("spawn failed") }) }),
    /spawn failed/
  )
  assert.equal(
    runMutationTests({ run: () => ({ status: null, signal: "SIGTERM" }) }),
    1
  )
})
