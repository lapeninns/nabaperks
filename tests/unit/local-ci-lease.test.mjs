import assert from "node:assert/strict"
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { acquireControllerLease } from "../../ops/local-ci/agent/lease.mjs"
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "ci-lease-"))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  return join(directory, "controller.lock")
}
test("lease excludes another controller and releases only its own identity", (t) => {
  const path = fixture(t)
  const probe = (pid) => `start-${pid}`
  const first = acquireControllerLease({ path, pid: 11, probe })
  assert.throws(
    () => acquireControllerLease({ path, pid: 12, probe }),
    /already owns/
  )
  first.release()
  acquireControllerLease({ path, pid: 12, probe }).release()
})
test("dead PID and reused PID permit stale recovery, without killing anything", (t) => {
  for (const oldIdentity of [null, "replacement-start"]) {
    const path = fixture(t)
    acquireControllerLease({ path, pid: 11, probe: () => "original-start" })
    const next = acquireControllerLease({
      path,
      pid: 12,
      probe: (pid) => (pid === 11 ? oldIdentity : "new-start"),
    })
    next.release()
  }
})
test("unverifiable owner, interrupted acquisition and recovery guard fail closed", (t) => {
  const path = fixture(t)
  mkdirSync(path)
  assert.throws(() =>
    acquireControllerLease({ path, pid: 12, probe: () => "start" })
  )
  writeFileSync(join(path, "owner.json"), "{}")
  assert.throws(
    () => acquireControllerLease({ path, pid: 12, probe: () => "start" }),
    /Malformed/
  )
  writeFileSync(
    join(path, "owner.json"),
    JSON.stringify({ pid: 11, start: "then", nonce: "abc" })
  )
  assert.throws(
    () =>
      acquireControllerLease({
        path,
        pid: 12,
        probe: (pid) => {
          if (pid === 11) throw new Error("unverifiable")
          return "start"
        },
      }),
    /unverifiable/
  )
  mkdirSync(`${path}.recovery`)
  assert.throws(
    () => acquireControllerLease({ path, pid: 12, probe: () => "start" }),
    { code: "EEXIST" }
  )
})
