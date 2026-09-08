import assert from "node:assert/strict"
import fs from "node:fs"
import { syncBuiltinESMExports } from "node:module"
import { execFileSync } from "node:child_process"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { readJournal, withJournal } from "../../ops/factory/journal.mjs"

for (const mode of ["read", "locked"]) {
  test(`${mode} journal reads stay bound to the opened file after pathname replacement`, () => {
    const directory = fs.realpathSync(
      fs.mkdtempSync(join(tmpdir(), "journal-race-"))
    )
    const path = join(directory, "state.json")
    const original = { version: 1, pullRequests: { 284: { repairCycles: 1 } } }
    const originalStat = fs.fstatSync
    let replaced = false
    try {
      fs.writeFileSync(path, JSON.stringify(original))
      fs.writeFileSync(
        join(directory, "replacement.json"),
        JSON.stringify({ version: 1, pullRequests: {} })
      )
      fs.fstatSync = (...args) => {
        const result = originalStat(...args)
        if (!replaced) {
          replaced = true
          fs.renameSync(path, join(directory, "original.json"))
          fs.symlinkSync(join(directory, "replacement.json"), path)
        }
        return result
      }
      syncBuiltinESMExports()
      const value =
        mode === "read"
          ? readJournal(directory)
          : withJournal(directory, (journal) => journal)
      assert.deepEqual(value, original)
      assert.equal(replaced, true)
    } finally {
      fs.fstatSync = originalStat
      syncBuiltinESMExports()
      fs.rmSync(directory, { recursive: true, force: true })
    }
  })
}

test("journal rejects a FIFO promptly and releases lock after invalid JSON", () => {
  const directory = fs.realpathSync(
    fs.mkdtempSync(join(tmpdir(), "journal-types-"))
  )
  const path = join(directory, "state.json")
  try {
    execFileSync("mkfifo", [path])
    assert.throws(() => readJournal(directory), /Invalid factory journal file/)
    assert.throws(
      () => withJournal(directory, () => {}),
      /Invalid factory journal file/
    )
    fs.rmSync(path)
    fs.writeFileSync(path, "{")
    assert.throws(() => withJournal(directory, () => {}), SyntaxError)
    fs.writeFileSync(path, JSON.stringify({ version: 1, pullRequests: {} }))
    withJournal(directory, (journal) => assert.equal(journal.version, 1))
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})
